import { useEffect, useState } from "react";
type Office = { id: string; name: string; active: boolean };
type Account = { id: string; name: string; email: string; role: string };
type ImportRow = {
  row: number;
  name: string;
  email: string;
  status: string;
  reason: string;
};
type Request = <T>(path: string, method?: string, body?: unknown) => Promise<T>;
export default function AdminPanel({
  section,
  request,
  run,
  busy,
  notice,
}: {
  section: "users" | "offices";
  request: Request;
  run: (action: () => Promise<void>) => Promise<void>;
  busy: boolean;
  notice: (value: string) => void;
}) {
  const [users, setUsers] = useState<Account[]>([]),
    [offices, setOffices] = useState<Office[]>([]);
  const [emailLocal, setEmailLocal] = useState(false);
  const [emailReady, setEmailReady] = useState(false),
    [search, setSearch] = useState("");
  const [officeName, setOfficeName] = useState("");
  const [csv, setCsv] = useState(""),
    [filename, setFilename] = useState("");
  const [analysis, setAnalysis] = useState<{
    rows: ImportRow[];
    digest: string;
  } | null>(null);
  const [result, setResult] = useState("");
  const refresh = async () => {
    if (section === "users") {
      const data = await request<{
        users: Account[];
        email_ready: boolean;
        email_local: boolean;
      }>("/admin/users");
      setUsers(data.users);
      setEmailReady(data.email_ready);
      setEmailLocal(data.email_local);
    } else setOffices(await request<Office[]>("/admin/offices"));
  };
  useEffect(() => {
    void run(refresh);
  }, [section]);
  return (
    <>
      <div className="p-title-row">
        <div>
          <p className="p-eyebrow">HRMO WORKSPACE</p>
          <h1>
            {section === "users" ? "User management" : "Office directory"}
          </h1>
          <p className="p-muted">
            {section === "users"
              ? "Import new applicants and help users regain access to their accounts."
              : "Active offices appear in the applicant’s office dropdown."}
          </p>
        </div>
        <button disabled={busy} onClick={() => void run(refresh)}>
          Refresh
        </button>
      </div>
      {section === "offices" ? (
        <section className="p-card p-section">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await request("/admin/offices", "POST", { name: officeName });
                setOfficeName("");
                await refresh();
                notice("Office added to the applicant dropdown.");
              });
            }}
          >
            <label>
              Office name
              <input
                required
                maxLength={160}
                value={officeName}
                onChange={(e) => setOfficeName(e.target.value)}
                disabled={busy}
              />
            </label>
            <button className="p-primary" disabled={busy}>
              Add office
            </button>
          </form>
          <p className="p-muted">
            Deactivate offices that should no longer be selected. Saved
            applications keep their original office names.
          </p>
          <div className="p-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Office</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {offices.map((o) => (
                  <tr key={o.id}>
                    <td>{o.name}</td>
                    <td>{o.active ? "Active" : "Inactive"}</td>
                    <td>
                      <button
                        disabled={busy}
                        aria-label={`${o.active ? "Deactivate" : "Activate"} ${o.name}`}
                        onClick={() =>
                          void run(async () => {
                            await request(`/admin/offices/${o.id}`, "PATCH", {
                              active: !o.active,
                            });
                            await refresh();
                          })
                        }
                      >
                        {o.active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <>
          <section className="p-card p-section">
            <h2>Import applicants from CSV</h2>
            <p className="p-muted">
              Use two columns: <strong>name,email</strong>. Up to 1,000 rows /
              500 KB. Emails identify users. Existing accounts and duplicate or
              invalid rows are skipped; imported users always receive the
              applicant role.
            </p>
            <a
              download="applicant-import-template.csv"
              href={
                "data:text/csv;charset=utf-8," +
                encodeURIComponent(
                  "name,email\nExample Applicant,applicant@example.test\n",
                )
              }
            >
              Download CSV template
            </a>
            <label>
              CSV file
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setCsv("");
                  setAnalysis(null);
                  setResult("");
                  setFilename(file?.name || "");
                  if (file)
                    void run(async () => {
                      if (file.size > 512000)
                        throw new Error("Choose a CSV up to 500 KB.");
                      setCsv(await file.text());
                    });
                }}
              />
            </label>
            <button
              disabled={busy || !csv}
              onClick={() =>
                void run(async () => {
                  setAnalysis(
                    await request("/admin/users/analyze", "POST", { csv }),
                  );
                  setResult("");
                })
              }
            >
              Analyze CSV
            </button>
            {analysis && (
              <div className="p-import-analysis">
                <h3>Import preview · {filename}</h3>
                <p>
                  {["new", "existing", "duplicate", "invalid"]
                    .map(
                      (status) =>
                        `${analysis.rows.filter((r) => r.status === status).length} ${status}`,
                    )
                    .join(" · ")}
                </p>
                <div className="p-table-wrap p-import-rows">
                  <table>
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.rows.map((r) => (
                        <tr key={r.row}>
                          <td>{r.row}</td>
                          <td>{r.name}</td>
                          <td>{r.email}</td>
                          <td>
                            <strong>{r.status}</strong>
                            <br />
                            {r.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  className="p-primary"
                  disabled={
                    busy || !analysis.rows.some((r) => r.status === "new")
                  }
                  onClick={() =>
                    void run(async () => {
                      const data = await request<{
                        imported: number;
                        skipped: number;
                      }>("/admin/users/import", "POST", {
                        csv,
                        digest: analysis.digest,
                      });
                      setResult(
                        `${data.imported} new applicants imported; ${data.skipped} rows skipped. Send each new user a password reset email to set their password.`,
                      );
                      setAnalysis(null);
                      setCsv("");
                      await refresh();
                    })
                  }
                >
                  Import{" "}
                  {analysis.rows.filter((r) => r.status === "new").length} new
                  applicants
                </button>
              </div>
            )}
            {result && (
              <p role="status" className="p-alert p-success">
                {result}
              </p>
            )}
          </section>
          <section className="p-card p-section">
            <h2>Users</h2>
            <label>
              Search users
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <p className="p-muted p-small">
              Google OAuth is enabled. Users sign in with their @ustp.edu.ph
              Google accounts. HRMO can promote/demote user roles here.
            </p>
            <div className="p-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users
                    .filter((u) =>
                      `${u.name} ${u.email}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((u) => (
                      <tr key={u.id}>
                        <td>{u.name}</td>
                        <td>{u.email}</td>
                        <td>{u.role === "hrmo" ? "HRMO" : "Applicant"}</td>
                        <td>
                          <button
                            disabled={busy}
                            aria-label={`Change role for ${u.email}`}
                            onClick={() =>
                              void run(async () => {
                                await request(`/admin/users/${u.id}/role`, "PATCH", {
                                  role: u.role === "hrmo" ? "applicant" : "hrmo",
                                });
                                await refresh();
                                notice(
                                  `${u.email} is now ${u.role === "hrmo" ? "an applicant" : "an HRMO"}.`,
                                );
                              })
                            }
                          >
                            {u.role === "hrmo" ? "Demote to applicant" : "Promote to HRMO"}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
