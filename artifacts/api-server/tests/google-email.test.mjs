import test from "node:test";
import assert from "node:assert/strict";
import {
  randomUUID,
  randomBytes,
  createHash,
  createDecipheriv,
} from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync, spawn } from "node:child_process";
const require = createRequire(
  new URL("../../../lib/db/package.json", import.meta.url),
);
const { Pool } = require("pg");
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const base = process.env.TEST_API_URL,
  google = process.env.GOOGLE_EMULATOR_URL;
if (
  !base ||
  !google ||
  !["localhost", "127.0.0.1"].includes(new URL(google).hostname)
)
  throw new Error("Use a disposable test API/DB and local Google emulator.");
const clientId = process.env.TEST_GOOGLE_CLIENT_ID,
  secret = process.env.TEST_GOOGLE_CLIENT_SECRET;
if (!clientId || !secret || !process.env.EMAIL_SETTINGS_KEY)
  throw new Error("Load the private Google fixture environment.");
const password = randomBytes(24).toString("hex"),
  tag = randomUUID(),
  email = `google-hrmo-${tag}@example.test`;
execFileSync(process.execPath, ["lib/db/scripts/create-hrmo.mjs"], {
  env: { ...process.env, HRMO_EMAIL: email, HRMO_PASSWORD: password },
  stdio: "pipe",
});
function client(server = base) {
  let cookie = "";
  return async (path, method = "GET", body, expected = 200) => {
    const response = await fetch(server + "/api" + path, {
      method,
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "USTP-Portal",
        Cookie: cookie,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.headers.get("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    const data = response.headers
      .get("content-type")
      ?.includes("application/json")
      ? await response.json()
      : null;
    assert.equal(
      response.status,
      expected,
      `${method} ${path.split("?")[0]} status`,
    );
    return { data, headers: response.headers };
  };
}
const hrmo = client(),
  otherSession = client(),
  applicant = client(),
  anon = client();
let applicantUser;
const settings = async () => (await hrmo("/admin/email")).data;
const saved = async () =>
  (await db.query("SELECT * FROM portal_email_settings WHERE singleton"))
    .rows[0];
const stateHash = (value) => createHash("sha256").update(value).digest("hex");
function decrypt(envelope, purpose) {
  const [, iv, tag, data] = envelope.split(".");
  const d = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(process.env.EMAIL_SETTINGS_KEY, "hex"),
    Buffer.from(iv, "hex"),
  );
  d.setAAD(Buffer.from(purpose));
  d.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([
    d.update(Buffer.from(data, "base64")),
    d.final(),
  ]).toString();
}
async function start() {
  return (await hrmo("/admin/email/google/connect", "POST")).data.url;
}
async function authorize(url, changes = {}) {
  const params = new URL(url).searchParams;
  for (const [k, v] of Object.entries(changes)) params.set(k, v);
  params.set("email", "hrmo-google@example.test");
  const response = await fetch(google + "/o/oauth2/v2/auth/callback", {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  assert.equal(
    response.status,
    302,
    "Google emulator issued an authorization code",
  );
  const callback = new URL(response.headers.get("location"));
  return callback.pathname.replace("/api", "") + callback.search;
}
function assertCallback(response, status) {
  assert.equal(
    new URL(response.headers.get("location")).searchParams.get("email_status"),
    status,
  );
}
async function connect() {
  const callback = await authorize(await start());
  assertCallback(await hrmo(callback, "GET", undefined, 303), "connected");
  return callback;
}
async function accessToken() {
  const row = await saved();
  const response = await fetch(google + "/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: row.client_id,
      client_secret: secret,
      refresh_token: decrypt(row.refresh_encrypted, "google-refresh-token"),
      grant_type: "refresh_token",
    }),
  });
  assert.equal(response.status, 200);
  return (await response.json()).access_token;
}
async function messages() {
  const token = await accessToken(),
    headers = { Authorization: `Bearer ${token}` };
  const response = await (
    await fetch(
      google + "/gmail/v1/users/me/messages?labelIds=SENT&maxResults=100",
      { headers },
    )
  ).json();
  const result = [];
  for (const row of response.messages || []) {
    const detail = await (
      await fetch(google + `/gmail/v1/users/me/messages/${row.id}?format=raw`, {
        headers,
      })
    ).json();
    const raw = Buffer.from(detail.raw, "base64url").toString();
    const body = Buffer.from(
      raw
        .split(/\r?\n\r?\n/)
        .slice(1)
        .join("\r\n"),
      "base64",
    ).toString();
    result.push({ raw, body });
  }
  return result;
}
test("HRMO Google email configuration and OAuth", async (t) => {
  await t.test(
    "settings require HRMO and secrets never read back",
    async () => {
      await hrmo("/auth/login", "POST", { email, password });
      await otherSession("/auth/login", "POST", { email, password });
      applicantUser = (
        await applicant("/auth/register", "POST", {
          name: "Google Reset Applicant",
          email: `google-applicant-${tag}@example.test`,
          password,
        })
      ).data.user;
      await anon("/admin/email", "GET", undefined, 401);
      await applicant("/admin/email", "GET", undefined, 403);
      for (const path of [
        "/admin/email/google/connect",
        "/admin/email/google/test",
        "/admin/email/google/disconnect",
        "/admin/email/default",
      ])
        await applicant(path, "POST", {}, 403);
      const before = await settings();
      await hrmo(
        "/admin/email/google",
        "PUT",
        {
          client_id: "not-a-client",
          client_secret: secret,
          revision: before.revision,
        },
        400,
      );
      await hrmo("/admin/email/google", "PUT", {
        client_id: clientId,
        client_secret: secret,
        revision: before.revision,
      });
      await hrmo(
        "/admin/email/google",
        "PUT",
        {
          client_id: clientId,
          client_secret: secret,
          revision: before.revision,
        },
        409,
      );
      const response = await settings();
      const row = await saved();
      assert.equal(response.has_secret, true);
      assert.equal(response.email_ready, false);
      assert.equal(response.encryption_ready, true);
      assert.ok(!JSON.stringify(response).includes(secret));
      assert.ok(!("secret_encrypted" in response));
      assert.ok(!("refresh_encrypted" in response));
      assert.notEqual(row.secret_encrypted, secret);
      assert.equal(
        decrypt(row.secret_encrypted, "google-client-secret"),
        secret,
      );
      assert.equal(new URL(response.callback_url).origin, base);
      await hrmo("/admin/email/google", "PUT", {
        client_id: clientId,
        client_secret: "",
        revision: response.revision,
      });
      assert.equal((await saved()).secret_encrypted, row.secret_encrypted);
    },
  );
  await t.test(
    "callback state, session, expiry, cancellation and scope protections",
    async () => {
      const url = await start(),
        params = new URL(url).searchParams;
      assert.equal(params.get("code_challenge_method"), "S256");
      assert.equal(params.get("access_type"), "offline");
      assert.ok(params.get("scope").includes("gmail.send"));
      assert.ok(!params.get("scope").includes("gmail.readonly"));
      const callback = await authorize(url);
      assertCallback(
        await otherSession(callback, "GET", undefined, 303),
        "failed",
      );
      assertCallback(await hrmo(callback, "GET", undefined, 303), "connected");
      assertCallback(await hrmo(callback, "GET", undefined, 303), "failed");
      const expired = await start(),
        state = new URL(expired).searchParams.get("state");
      await db.query(
        "UPDATE portal_google_oauth SET expires_at=now()-interval '1 second' WHERE state_hash=$1",
        [stateHash(state)],
      );
      assertCallback(
        await hrmo(await authorize(expired), "GET", undefined, 303),
        "failed",
      );
      const cancelled = await start();
      assertCallback(
        await hrmo(
          "/admin/email/google/callback?error=access_denied&state=" +
            new URL(cancelled).searchParams.get("state"),
          "GET",
          undefined,
          303,
        ),
        "denied",
      );
      assertCallback(
        await hrmo(
          await authorize(await start(), { code_challenge: "wrong-challenge" }),
          "GET",
          undefined,
          303,
        ),
        "failed",
      );
      assertCallback(
        await hrmo(
          await authorize(await start(), { scope: "openid email" }),
          "GET",
          undefined,
          303,
        ),
        "permissions",
      );
      const stale = await start(),
        current = await settings();
      await hrmo("/admin/email/google", "PUT", {
        client_id: clientId,
        client_secret: "",
        revision: current.revision,
      });
      assertCallback(
        await hrmo(await authorize(stale), "GET", undefined, 303),
        "failed",
      );
      await connect();
      const connected = await settings();
      assert.equal(connected.sender, "hrmo-google@example.test");
      assert.equal(connected.email_ready, true);
      const row = await saved();
      assert.ok(row.refresh_encrypted.startsWith("v1."));
      assert.ok(
        !JSON.stringify(connected).includes(
          decrypt(row.refresh_encrypted, "google-refresh-token"),
        ),
      );
    },
  );
  await t.test(
    "Gmail test and actual reset email use refreshed tokens and valid MIME",
    async () => {
      const sent = (await hrmo("/admin/email/google/test", "POST")).data;
      assert.equal(sent.recipient, "hrmo-google@example.test");
      assert.equal(sent.local, true);
      await hrmo("/admin/email/google/test", "POST", undefined, 429);
      let mail = await messages();
      assert.ok(
        mail.some((m) => m.body.includes("Your Google account is connected")),
      );
      await hrmo(`/admin/users/${applicantUser.id}/reset-password`, "POST");
      mail = await messages();
      const reset = mail.find((m) =>
        m.raw.includes(`To: ${applicantUser.email}`),
      );
      assert.ok(reset);
      assert.match(reset.raw, /Content-Type: text\/plain; charset=UTF-8/);
      const resetToken = reset.body.match(/reset-password=([a-f0-9]{64})/)?.[1];
      assert.ok(resetToken);
      await anon("/auth/reset-password", "POST", {
        token: resetToken,
        password: randomBytes(24).toString("hex"),
      });
      await applicant("/auth/me", "GET", undefined, 401);
    },
  );
  await t.test(
    "revoked access requires reconnection and never falls back to another sender",
    async () => {
      const row = await saved();
      await fetch(google + "/oauth2/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: decrypt(row.refresh_encrypted, "google-refresh-token"),
        }),
      });
      await db.query(
        "UPDATE portal_email_settings SET last_test_at=NULL WHERE singleton",
      );
      await hrmo("/admin/email/google/test", "POST", undefined, 503);
      const status = await settings();
      assert.equal(status.needs_reconnect, true);
      assert.equal(status.email_ready, false);
      await connect();
      const current = await settings();
      await hrmo("/admin/email/google/disconnect", "POST", {
        revision: current.revision,
      });
      const disconnected = await settings();
      assert.equal(disconnected.connected, false);
      assert.equal(disconnected.email_ready, false);
      assert.equal(disconnected.sender, "");
      await hrmo("/admin/email/google/test", "POST", undefined, 400);
      await hrmo("/admin/email/default", "POST", {
        revision: disconnected.revision,
      });
      assert.equal((await settings()).provider, "server");
    },
  );
});
test.after(async () => {
  await db.query(
    "UPDATE portal_email_settings SET provider='server',refresh_encrypted='',sender='',needs_reconnect=false WHERE singleton",
  );
  await db.end();
});

test("Google credentials cannot be saved without the server encryption key", async () => {
  const child = spawn(
    process.execPath,
    ["artifacts/api-server/dist/index.mjs"],
    {
      env: { ...process.env, PORT: "5004", EMAIL_SETTINGS_KEY: "" },
      stdio: "ignore",
    },
  );
  try {
    let ready = false;
    for (let n = 0; n < 50; n++) {
      try {
        ready = (await fetch("http://localhost:5004/api/healthz")).ok;
      } catch {}
      if (ready) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(ready);
    const missing = client("http://localhost:5004");
    await missing("/auth/login", "POST", { email, password });
    const current = (await missing("/admin/email")).data;
    assert.equal(current.encryption_ready, false);
    await missing(
      "/admin/email/google",
      "PUT",
      {
        client_id: clientId,
        client_secret: secret,
        revision: current.revision,
      },
      503,
    );
  } finally {
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill("SIGTERM");
    await exited;
  }
});
