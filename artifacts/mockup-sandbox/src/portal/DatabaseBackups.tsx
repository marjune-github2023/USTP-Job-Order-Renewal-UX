import { useEffect, useState } from "react";

type Preview = {
  created: string;
  digest: string;
  counts: Record<string, number>;
};
type Recovery = { name: string; bytes: number };
const labels: Record<string, string> = {
  portal_users: "User accounts",
  portal_offices: "Offices",
  portal_migrations: "Setup records",
  portal_contract_settings: "Contract settings",
  portal_email_settings: "Email settings",
  applications: "Applications",
  application_documents: "Uploaded documents",
  application_contracts: "Generated contracts",
  application_events: "Review history",
};
export default function DatabaseBackups() {
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [recovery, setRecovery] = useState<Recovery[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [restored, setRestored] = useState(false);
  async function request(
    route: string,
    body?: File,
    extra: Record<string, string> = {},
  ) {
    const response = await fetch(`/api/admin/database${route}`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "X-Requested-With": "USTP-Portal",
        "X-Backup-Password": encodeURIComponent(password),
        ...(body ? { "Content-Type": "application/sql" } : {}),
        ...extra,
      },
      body,
    });
    if (!response.ok)
      throw new Error(
        (await response.json()).error || "Database operation failed.",
      );
    return response;
  }
  async function load() {
    const response = await fetch("/api/admin/database", {
      credentials: "same-origin",
    });
    if (!response.ok)
      throw new Error(
        (await response.json()).error || "Unable to load backups.",
      );
    setRecovery((await response.json()).recovery);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Database operation failed.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void run(load);
  }, []);
  async function download(route: string, filename: string) {
    const response = await request(route);
    const url = URL.createObjectURL(await response.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setNotice(
      "SQL backup downloaded. Check your browser’s Downloads folder and keep a secure copy outside this server.",
    );
  }
  return (
    <section className="p-card p-section p-database-backups">
      <p className="p-eyebrow">HRMO SETTINGS</p>
      <h1>Database backups</h1>
      <p>
        Protect applications, user accounts, offices, settings, review history,
        uploaded documents and generated contracts in one SQL file.
      </p>
      {error && (
        <p role="alert" className="p-alert p-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="p-alert p-success">
          {notice}
        </p>
      )}
      {restored ? (
        <div>
          <p>
            {notice} Current sessions and password reset links have been
            cleared.
          </p>
          <button className="p-primary" onClick={() => location.assign("/")}>
            Go to sign in
          </button>
        </div>
      ) : (
        <>
          <label>
            Current HRMO password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              disabled={busy}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <h2>Download a backup</h2>
          <p className="p-muted">
            The file contains personal records and password hashes. Store it
            securely. Keep the server’s email encryption key separately so
            Google email settings can be recovered.
          </p>
          <button
            className="p-primary"
            disabled={busy || !password}
            onClick={() =>
              void run(() =>
                download(
                  "/download",
                  `USTP-backup-${new Date().toISOString().slice(0, 10)}.sql`,
                ),
              )
            }
          >
            Download SQL backup
          </button>
          <hr />
          <h2>Restore from a backup</h2>
          <p>
            Restore replaces all current portal records with the selected
            backup. Changes made after that backup will be removed. Everyone
            will need to sign in again with an account and password from the
            backup.
          </p>
          <p className="p-muted">
            Only complete SQL files downloaded from this portal are accepted
            here (up to 50 MB). An administrator can restore standard PostgreSQL
            dumps separately. A recovery copy of current records is saved before
            replacement; if restoration fails, current records are kept.
          </p>
          <label>
            SQL backup file
            <input
              type="file"
              accept=".sql,application/sql"
              disabled={busy}
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setPreview(null);
                setConfirmation("");
              }}
            />
          </label>
          <button
            disabled={busy || !password || !file}
            onClick={() =>
              void run(async () => {
                setPreview(null);
                if (
                  !file ||
                  !file.name.toLowerCase().endsWith(".sql") ||
                  file.size > 50 * 1024 * 1024
                )
                  throw new Error("Choose a .sql backup no larger than 50 MB.");
                setPreview(await (await request("/analyze", file)).json());
              })
            }
          >
            Analyze backup
          </button>
          {preview && (
            <div>
              <h3>Backup from {new Date(preview.created).toLocaleString()}</h3>
              <dl>
                {Object.entries(preview.counts).map(([table, count]) => (
                  <div key={table}>
                    <dt>{labels[table] || table}</dt>
                    <dd>{count}</dd>
                  </div>
                ))}
              </dl>
              <p>
                Check the date and record counts. Make sure you know an HRMO
                account’s password from this backup before continuing.
              </p>
              <label>
                Type RESTORE to confirm
                <input
                  value={confirmation}
                  disabled={busy}
                  onChange={(e) => setConfirmation(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <button
                className="p-primary"
                disabled={busy || !password || confirmation !== "RESTORE"}
                onClick={() =>
                  void run(async () => {
                    const result = await (
                      await request("/restore", file!, {
                        "X-Backup-Digest": preview.digest,
                        "X-Restore-Confirmation": confirmation,
                      })
                    ).json();
                    setPassword("");
                    setRestored(true);
                    setNotice(result.message);
                  })
                }
              >
                Replace records and restore
              </button>
            </div>
          )}
          <hr />
          <h2>Recovery copies</h2>
          <p className="p-muted">
            Created automatically before every restore attempt. Download these
            too: copies on this server alone cannot protect against losing the
            server.
          </p>
          <button disabled={busy} onClick={() => void run(load)}>
            Refresh recovery copies
          </button>
          {recovery.length ? (
            <ul>
              {recovery.map((item) => (
                <li key={item.name}>
                  <span>
                    {item.name} · {(item.bytes / 1024 / 1024).toFixed(2)} MB
                  </span>{" "}
                  <button
                    disabled={busy || !password}
                    onClick={() =>
                      void run(() =>
                        download(`/recovery/${item.name}`, item.name),
                      )
                    }
                  >
                    Download
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No recovery copies yet.</p>
          )}
          {busy && (
            <p role="status">
              Working… Keep this page open until the operation finishes.
            </p>
          )}
        </>
      )}
    </section>
  );
}
