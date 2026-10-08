import { useEffect, useState } from "react";
type Settings = {
  provider: string;
  client_id: string;
  has_secret: boolean;
  sender: string;
  connected: boolean;
  needs_reconnect: boolean;
  revision: number;
  encryption_ready: boolean;
  callback_url: string | null;
  local: boolean;
  email_ready: boolean;
  server_ready: boolean;
};
export default function EmailSettings({
  request,
  run,
  busy,
  notice,
}: {
  request: <T>(path: string, method?: string, body?: unknown) => Promise<T>;
  run: (action: () => Promise<void>) => Promise<void>;
  busy: boolean;
  notice: (s: string) => void;
}) {
  const [settings, setSettings] = useState<Settings | null>(null),
    [clientId, setClientId] = useState(""),
    [secret, setSecret] = useState("");
  const [callbackStatus] = useState(() =>
    new URLSearchParams(location.search).get("email_status"),
  );
  const load = async () => {
    const value = await request<Settings>("/admin/email");
    setSettings(value);
    setClientId(value.client_id);
    setSecret("");
  };
  useEffect(() => {
    void run(load);
    const url = new URL(location.href);
    if (url.searchParams.has("email_status")) {
      url.searchParams.delete("email_status");
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
  }, []);
  const dirty =
    settings && (clientId !== settings.client_id || Boolean(secret));
  return (
    <section className="p-card p-section p-email-settings">
      <div className="p-title-row">
        <div>
          <p className="p-eyebrow">HRMO SETTINGS</p>
          <h1>Email delivery</h1>
        </div>
        <button disabled={busy} onClick={() => void run(load)}>
          Refresh
        </button>
      </div>
      <p className="p-muted">
        Connect the Gmail or Google Workspace account HRMO will use to send
        password reset emails.
      </p>
      {callbackStatus && (
        <p
          role={callbackStatus === "connected" ? "status" : "alert"}
          className={`p-alert ${callbackStatus === "connected" ? "p-success" : "p-error"}`}
        >
          {callbackStatus === "connected"
            ? "Google account connected. You can send a test email below."
            : callbackStatus === "denied"
              ? "Google authorization was cancelled. Connect again when you’re ready."
              : callbackStatus === "permissions"
                ? "Google did not grant email sending and offline access. Connect again and allow the requested permissions."
                : "Google connection could not be completed. Check the credentials and callback URL, then connect again from this browser."}
        </p>
      )}
      {settings && (
        <>
          {settings.local && (
            <p className="p-alert">
              Local Google simulation is active. Use synthetic credentials only;
              messages stay in this sandbox. The server administrator must turn
              off simulation before you enter real Google credentials.
            </p>
          )}
          {(!settings.encryption_ready || !settings.callback_url) && (
            <p className="p-alert p-error">
              Server setup is incomplete. Ask the server administrator to
              configure {!settings.encryption_ready ? "the encryption key" : ""}
              {!settings.encryption_ready && !settings.callback_url
                ? " and "
                : ""}
              {!settings.callback_url ? "the public portal URL" : ""}. HRMO can
              manage Google credentials here once that is ready.
            </p>
          )}
          <h2>1. Create Google credentials</h2>
          <ol className="p-email-instructions">
            <li>
              Open{" "}
              <a
                href="https://console.cloud.google.com/apis/library/gmail.googleapis.com"
                target="_blank"
                rel="noreferrer"
              >
                Google Cloud Console
              </a>
              , select your project, and enable the Gmail API.
            </li>
            <li>
              Configure Google Auth Platform’s consent screen. For a university
              Workspace project, choose Internal if available. Otherwise
              configure the appropriate audience and add the sending account as
              a test user while testing.
            </li>
            <li>
              Create an OAuth client with application type{" "}
              <strong>Web application</strong>. Add this exact Authorized
              redirect URI:
              <code className="p-callback-url">
                {settings.callback_url || "Waiting for the portal URL"}
              </code>
            </li>
            <li>
              Copy the Client ID and Client Secret into the fields below. Do not
              enter a Gmail password or an API key.
            </li>
          </ol>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await request("/admin/email/google", "PUT", {
                  client_id: clientId,
                  client_secret: secret,
                  revision: settings.revision,
                });
                setSecret("");
                await load();
                notice(
                  "Google credentials saved. Connect the sending account next.",
                );
              });
            }}
          >
            <fieldset
              disabled={
                busy || !settings.encryption_ready || !settings.callback_url
              }
            >
              <div className="p-form-grid">
                <label>
                  Google OAuth Client ID
                  <input
                    required
                    maxLength={255}
                    value={clientId}
                    autoComplete="off"
                    onChange={(e) => setClientId(e.target.value)}
                  />
                </label>
                <label>
                  Google OAuth Client Secret
                  <input
                    type="password"
                    required={
                      !settings.has_secret || clientId !== settings.client_id
                    }
                    maxLength={512}
                    autoComplete="new-password"
                    value={secret}
                    placeholder={
                      settings.has_secret
                        ? "Saved securely; leave blank to keep"
                        : "Enter client secret"
                    }
                    onChange={(e) => setSecret(e.target.value)}
                  />
                </label>
              </div>
              <p className="p-muted p-small">
                The secret is encrypted on the server and never shown again.
                Saving credentials requires reconnecting the sending account.
              </p>
              <button className="p-primary" disabled={busy}>
                Save Google credentials
              </button>
            </fieldset>
          </form>
          <h2>2. Connect the sending account</h2>
          <p>
            {settings.sender
              ? `Sending account: ${settings.sender}`
              : "No Google sending account connected."}{" "}
            {settings.needs_reconnect
              ? "Google access has expired or been revoked; reconnect below."
              : settings.provider === "google" && settings.email_ready
                ? "Google email delivery is active."
                : settings.provider === "server"
                  ? "The server-configured email service is currently selected."
                  : "Google email delivery is not ready yet."}
          </p>
          <div className="p-actions">
            <button
              className="p-primary"
              disabled={
                busy ||
                Boolean(dirty) ||
                !settings.has_secret ||
                settings.provider !== "google" ||
                !settings.encryption_ready ||
                !settings.callback_url
              }
              onClick={() =>
                void run(async () => {
                  const data = await request<{ url: string }>(
                    "/admin/email/google/connect",
                    "POST",
                  );
                  window.location.assign(data.url);
                })
              }
            >
              {settings.connected
                ? "Reconnect Google account"
                : "Connect Google account"}
            </button>
            {settings.connected && (
              <button
                disabled={busy || Boolean(dirty)}
                onClick={() =>
                  void run(async () => {
                    const result = await request<{ revoked: boolean }>(
                      "/admin/email/google/disconnect",
                      "POST",
                      { revision: settings.revision },
                    );
                    await load();
                    notice(
                      result.revoked
                        ? "Google account disconnected."
                        : "Disconnected from this portal. Google revocation was unavailable; remove the app in your Google account’s third-party connections as well.",
                    );
                  })
                }
              >
                Disconnect Google account
              </button>
            )}
          </div>
          <p className="p-muted p-small">
            Google asks permission to identify the sending account and send
            email. HRMO’s portal account and permissions stay the same. External
            apps in Google’s Testing mode may need reconnection after seven
            days; Workspace administrators may also need to allow the app.
          </p>
          <h2>3. Test email delivery</h2>
          <p>
            A test message will be sent to the connected Google account itself.
          </p>
          <button
            disabled={
              busy ||
              Boolean(dirty) ||
              settings.provider !== "google" ||
              !settings.email_ready
            }
            onClick={() =>
              void run(async () => {
                const result = await request<{
                  recipient: string;
                  local: boolean;
                }>("/admin/email/google/test", "POST");
                notice(
                  result.local
                    ? `Test email captured locally for ${result.recipient}.`
                    : `Google accepted the test email for ${result.recipient}. Check that inbox.`,
                );
              })
            }
          >
            Send test email
          </button>
          {settings.server_ready && settings.provider !== "server" && (
            <p>
              <button
                disabled={busy || Boolean(dirty)}
                onClick={() =>
                  void run(async () => {
                    await request("/admin/email/default", "POST", {
                      revision: settings.revision,
                    });
                    await load();
                    notice("The server-configured email service is selected.");
                  })
                }
              >
                Use server-configured email service
              </button>
            </p>
          )}
        </>
      )}
    </section>
  );
}
