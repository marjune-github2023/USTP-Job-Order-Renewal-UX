import { pool } from "@workspace/db";
import { seal, unseal, vaultReady } from "./email-vault";
import { fail } from "./http";
export const gmailScope = "https://www.googleapis.com/auth/gmail.send";
export function publicAppUrl() {
  try {
    const url = new URL(process.env.PUBLIC_APP_URL || "");
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !["https:", "http:"].includes(url.protocol)
    )
      return null;
    if (
      url.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(url.hostname)
    )
      return null;
    return url;
  } catch {
    return null;
  }
}
export function callbackUrl() {
  const app = publicAppUrl();
  return app ? new URL("/api/admin/email/google/callback", app).href : null;
}
export function googleEndpoints() {
  const override = process.env.GOOGLE_EMULATOR_URL;
  if (override) {
    const url = new URL(override);
    if (
      url.protocol !== "http:" ||
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      fail(503, "The Google emulator override must use a local HTTP endpoint.");
    const base = url.origin;
    return {
      authorize: base + "/o/oauth2/v2/auth",
      token: base + "/oauth2/token",
      userinfo: base + "/oauth2/v2/userinfo",
      send: base + "/gmail/v1/users/me/messages/send",
      revoke: base + "/oauth2/revoke",
      local: true,
    };
  }
  return {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    userinfo: "https://www.googleapis.com/oauth2/v2/userinfo",
    send: "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    revoke: "https://oauth2.googleapis.com/revoke",
    local: false,
  };
}
export async function googleSettings() {
  return (
    await pool.query("SELECT * FROM portal_email_settings WHERE singleton")
  ).rows[0];
}
export async function tokenRequest(values: Record<string, string>) {
  const response = await fetch(googleEndpoints().token, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
  });
  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    error?: string;
  };
  if (!response.ok || !data.access_token) {
    const error = new Error("Google authorization failed") as Error & {
      code?: string;
    };
    error.code = data.error === "invalid_grant" ? "reconnect" : "provider";
    throw error;
  }
  return data;
}
export async function googleStatus() {
  const settings = await googleSettings();
  return {
    settings,
    ready: Boolean(
      settings?.provider === "google" &&
      settings.refresh_encrypted &&
      settings.sender &&
      !settings.needs_reconnect &&
      vaultReady() &&
      publicAppUrl(),
    ),
  };
}
export async function sendGoogleMessage(
  to: string,
  subject: string,
  body: string,
) {
  const { settings, ready } = await googleStatus();
  if (!ready)
    fail(503, "Connect a Google sending account in Email settings first.");
  if (
    ![to, settings.sender].every(
      (v) =>
        typeof v === "string" && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v),
    ) ||
    /[\r\n]/.test(subject)
  )
    fail(400, "Invalid email address or subject.");
  try {
    // Refresh on send; access tokens stay in memory and are never exposed to the browser.
    const tokens = await tokenRequest({
      client_id: settings.client_id,
      client_secret: unseal(settings.secret_encrypted, "google-client-secret"),
      refresh_token: unseal(settings.refresh_encrypted, "google-refresh-token"),
      grant_type: "refresh_token",
    });
    if (tokens.refresh_token)
      await pool.query(
        "UPDATE portal_email_settings SET refresh_encrypted=$1 WHERE singleton AND revision=$2",
        [seal(tokens.refresh_token, "google-refresh-token"), settings.revision],
      );
    const mime = [
      `From: ${settings.sender}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(body)
        .toString("base64")
        .match(/.{1,76}/g)!
        .join("\r\n"),
    ].join("\r\n");
    const response = await fetch(googleEndpoints().send, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: Buffer.from(mime).toString("base64url") }),
    });
    if (!response.ok) throw new Error("Gmail could not send the message");
    const receipt = (await response.json()) as { id?: string };
    if (!receipt.id) throw new Error("Missing Gmail receipt");
  } catch (error) {
    if ((error as { code?: string }).code === "reconnect") {
      await pool.query(
        "UPDATE portal_email_settings SET needs_reconnect=true WHERE singleton AND revision=$1",
        [settings.revision],
      );
      fail(
        503,
        "Google authorization has expired or been revoked. Reconnect the sending account in Email settings.",
      );
    }
    fail(
      503,
      "Google could not send the email. Check the Gmail API, account authorization and credentials in Email settings, then try again.",
    );
  }
}
