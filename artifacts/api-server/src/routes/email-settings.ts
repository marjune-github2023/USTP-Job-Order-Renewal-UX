import { Router } from "express";
import { randomBytes, createHash } from "node:crypto";
import { pool } from "@workspace/db";
import { fail, field } from "../lib/http";
import { hash } from "../lib/security";
import { seal, unseal, vaultReady } from "../lib/email-vault";
import {
  callbackUrl,
  publicAppUrl,
  gmailScope,
  googleEndpoints,
  googleSettings,
  tokenRequest,
  sendGoogleMessage,
} from "../lib/google-email";
import { emailStatus } from "../lib/email";
const router = Router(); // Mounted inside the authenticated HRMO router.
router.get("/", async (_req, res) => {
  const settings = await googleSettings();
  res.json({
    provider: settings.provider,
    client_id: settings.client_id,
    has_secret: Boolean(settings.secret_encrypted),
    sender: settings.sender,
    connected: Boolean(settings.refresh_encrypted),
    needs_reconnect: settings.needs_reconnect,
    revision: settings.revision,
    encryption_ready: vaultReady(),
    callback_url: callbackUrl(),
    local: googleEndpoints().local,
    ...(await emailStatus()),
  });
});
router.put("/google", async (req, res) => {
  if (!vaultReady())
    fail(
      503,
      "The server administrator must configure EMAIL_SETTINGS_KEY first.",
    );
  if (!callbackUrl())
    fail(503, "The server administrator must configure PUBLIC_APP_URL first.");
  const clientId = field(req.body?.client_id, "Google client ID", 255);
  if (!/^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/.test(clientId))
    fail(
      400,
      "Enter a Google Web application OAuth Client ID ending in .apps.googleusercontent.com.",
    );
  const secret = field(
    req.body?.client_secret ?? "",
    "Google client secret",
    512,
    false,
  );
  if (secret && /\s/.test(secret))
    fail(400, "The client secret cannot contain whitespace.");
  const current = await googleSettings();
  if (!secret && (current.client_id !== clientId || !current.secret_encrypted))
    fail(400, "Enter the client secret for this OAuth client.");
  const encrypted = secret
    ? seal(secret, "google-client-secret")
    : current.secret_encrypted;
  const updated = await pool.query(
    "UPDATE portal_email_settings SET provider='google',client_id=$1,secret_encrypted=$2,refresh_encrypted='',sender='',needs_reconnect=false,revision=revision+1,updated_by=$3,updated_at=now() WHERE singleton AND revision=$4 RETURNING revision",
    [clientId, encrypted, res.locals.user.id, req.body?.revision],
  );
  if (!updated.rowCount)
    fail(409, "Email settings changed. Refresh before saving.");
  res.json({ ok: true });
});
router.post("/google/connect", async (_req, res) => {
  const settings = await googleSettings(),
    redirect = callbackUrl();
  if (
    !vaultReady() ||
    !redirect ||
    !settings.client_id ||
    !settings.secret_encrypted ||
    settings.provider !== "google"
  )
    fail(400, "Save the Google credentials before connecting an account.");
  unseal(settings.secret_encrypted, "google-client-secret");
  const state = randomBytes(32).toString("hex"),
    verifier = randomBytes(32).toString("base64url");
  await pool.query("DELETE FROM portal_google_oauth WHERE expires_at < now()");
  await pool.query(
    "INSERT INTO portal_google_oauth (state_hash,user_id,session_hash,settings_revision,verifier_encrypted,expires_at) VALUES ($1,$2,$3,$4,$5,now()+interval '10 minutes')",
    [
      hash(state),
      res.locals.user.id,
      res.locals.sessionHash,
      settings.revision,
      seal(verifier, "google-pkce"),
    ],
  );
  const url = new URL(googleEndpoints().authorize);
  url.search = new URLSearchParams({
    client_id: settings.client_id,
    redirect_uri: redirect,
    response_type: "code",
    scope: `openid email ${gmailScope}`,
    access_type: "offline",
    prompt: "consent select_account",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  res.json({ url: url.href });
});
router.get("/google/callback", async (req, res) => {
  const app = publicAppUrl();
  if (!app) fail(503, "PUBLIC_APP_URL is not configured.");
  res.setHeader("Referrer-Policy", "no-referrer");
  let status = "failed";
  try {
    const state = req.query.state;
    if (typeof state !== "string" || !/^[a-f0-9]{64}$/.test(state))
      throw new Error("Invalid state");
    // Atomic consumption binds this callback to the exact initiating HRMO session.
    const claimed = await pool.query(
      "DELETE FROM portal_google_oauth WHERE state_hash=$1 AND user_id=$2 AND session_hash=$3 AND expires_at>now() RETURNING *",
      [hash(state), res.locals.user.id, res.locals.sessionHash],
    );
    if (!claimed.rowCount)
      throw new Error("Expired or mismatched authorization");
    if (req.query.error) {
      status = "denied";
      throw new Error("Authorization denied");
    }
    const settings = await googleSettings();
    if (
      settings.revision !== claimed.rows[0].settings_revision ||
      settings.provider !== "google"
    )
      throw new Error("Settings changed");
    if (typeof req.query.code !== "string" || req.query.code.length > 4096)
      throw new Error("Missing authorization code");
    const tokens = await tokenRequest({
      client_id: settings.client_id,
      client_secret: unseal(settings.secret_encrypted, "google-client-secret"),
      code: req.query.code,
      redirect_uri: callbackUrl()!,
      grant_type: "authorization_code",
      code_verifier: unseal(claimed.rows[0].verifier_encrypted, "google-pkce"),
    });
    if (
      !tokens.refresh_token ||
      !tokens.scope?.split(" ").includes(gmailScope)
    ) {
      status = "permissions";
      throw new Error("Missing offline send permission");
    }
    const userResponse = await fetch(googleEndpoints().userinfo, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!userResponse.ok) throw new Error("Unable to verify Google account");
    const profile = (await userResponse.json()) as {
      email?: string;
      verified_email?: boolean;
      email_verified?: boolean;
    };
    if (
      !profile.email ||
      profile.email.length > 254 ||
      !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(profile.email) ||
      !(profile.verified_email === true || profile.email_verified === true)
    )
      throw new Error("Unverified Google email");
    const saved = await pool.query(
      "UPDATE portal_email_settings SET refresh_encrypted=$1,sender=$2,needs_reconnect=false,revision=revision+1,updated_by=$3,updated_at=now() WHERE singleton AND revision=$4 AND provider='google' RETURNING revision",
      [
        seal(tokens.refresh_token, "google-refresh-token"),
        profile.email.toLowerCase(),
        res.locals.user.id,
        settings.revision,
      ],
    );
    if (!saved.rowCount)
      throw new Error("Settings changed during authorization");
    status = "connected";
  } catch {
    /* Never put provider responses, codes or credentials in redirects/logs. */
  }
  app.searchParams.set("email_status", status);
  res.redirect(303, app.href);
});
router.post("/google/test", async (_req, res) => {
  const settings = await googleSettings();
  if (
    !settings.sender ||
    !settings.refresh_encrypted ||
    settings.provider !== "google"
  )
    fail(400, "Connect the Google sending account first.");
  const limited = await pool.query(
    "UPDATE portal_email_settings SET last_test_at=now() WHERE singleton AND (last_test_at IS NULL OR last_test_at<now()-interval '1 minute') RETURNING revision",
  );
  if (!limited.rowCount)
    fail(429, "Wait one minute before sending another test email.");
  await sendGoogleMessage(
    settings.sender,
    "USTP portal email connection test",
    "Your Google account is connected to the USTP renewal portal. HRMO can now send password reset emails from this account.",
  );
  res.json({
    ok: true,
    recipient: settings.sender,
    local: googleEndpoints().local,
  });
});
router.post("/google/disconnect", async (req, res) => {
  // Remove access locally even if Google's revocation endpoint is unavailable.
  const settings = await googleSettings();
  const updated = await pool.query(
    "UPDATE portal_email_settings SET refresh_encrypted='',sender='',needs_reconnect=false,revision=revision+1,updated_by=$1,updated_at=now() WHERE singleton AND revision=$2 RETURNING revision",
    [res.locals.user.id, req.body?.revision],
  );
  if (!updated.rowCount)
    fail(409, "Email settings changed. Refresh before disconnecting.");
  let revoked = true;
  if (settings.refresh_encrypted) {
    try {
      const result = await fetch(googleEndpoints().revoke, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: unseal(settings.refresh_encrypted, "google-refresh-token"),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      revoked = result.ok;
    } catch {
      revoked = false;
    }
  }
  res.json({ ok: true, revoked });
});
router.post("/default", async (req, res) => {
  const result = await pool.query(
    "UPDATE portal_email_settings SET provider='server',revision=revision+1,updated_by=$1,updated_at=now() WHERE singleton AND revision=$2 RETURNING revision",
    [res.locals.user.id, req.body?.revision],
  );
  if (!result.rowCount) fail(409, "Email settings changed. Refresh first.");
  res.json({ ok: true });
});
export default router;
