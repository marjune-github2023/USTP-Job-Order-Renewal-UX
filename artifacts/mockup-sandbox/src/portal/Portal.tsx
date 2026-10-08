import DatabaseBackups from "./DatabaseBackups";
import EmailSettings from "./EmailSettings";
import ContractSettings from "./ContractSettings";
import AdminPanel from "./AdminPanel";
import ResetPassword from "./ResetPassword";
import ApplicationWizard, { ApplicationReview } from "./ApplicationWizard";
import { blankTor, type TorSection } from "./TorEditor";
import ContractPanel, {
  emptyContract,
  type ContractDetails,
} from "./ContractPanel";
import { useEffect, useState, type FormEvent } from "react";
import {
  Building2,
  FileText,
  LogOut,
  Plus,
  ArrowLeft,
  CheckCircle2,
  Upload,
  RefreshCw,
} from "lucide-react";
import "./portal.css";

type User = {
  id: string;
  name: string;
  email: string;
  role: "applicant" | "hrmo";
};
type Document = { id: string; name: string; kind: string; size: number };
type Event = {
  id: number;
  status: string;
  note: string;
  actor: string;
  created_at: string;
};
type Application = {
  id: string;
  applicant_name: string;
  applicant_email: string;
  position: string;
  office: string;
  start_date: string;
  end_date: string;
  tor: string;
  tor_sections: TorSection[];
  form_version: number;
  tor_items: string[];
  personal_details: Record<string, string>;
  contract_details: Partial<ContractDetails>;
  education_details: Record<string, string>;
  contact_details: Record<string, string>;
  wizard_step: number;
  contract?: { generated_at: string } | null;
  status: string;
  version: number;
  updated_at: string;
  documents?: Document[];
  events?: Event[];
};
const statuses: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  returned: "Returned for corrections",
  approved: "Approved",
  rejected: "Rejected",
  contract_generated: "Contract generated",
};
const date = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "USTP-Portal",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The request failed.");
  return data;
}
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? Object.fromEntries(
          Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)),
        )
      : entry,
  );
}
function Badge({ status }: { status: string }) {
  return <span className={`p-badge p-${status}`}>{statuses[status]}</span>;
}
export default function Portal() {
  const [section, setSection] = useState<
    "applications" | "users" | "offices" | "settings" | "email" | "database"
  >(() =>
    new URLSearchParams(location.search).has("email_status")
      ? "email"
      : "applications",
  );
  const [resetToken, setResetToken] = useState(
    () =>
      new URLSearchParams(window.location.hash.slice(1)).get(
        "reset-password",
      ) || "",
  );
  useEffect(() => {
    const receiveResetLink = () => {
      const value = new URLSearchParams(window.location.hash.slice(1)).get(
        "reset-password",
      );
      if (value) {
        setResetToken(value);
        window.history.replaceState(null, "", window.location.pathname);
      }
    };
    receiveResetLink();
    window.addEventListener("hashchange", receiveResetLink);
    return () => window.removeEventListener("hashchange", receiveResetLink);
  }, []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [applications, setApplications] = useState<Application[]>([]);
  const [selected, setSelected] = useState<Application | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [renewSource, setRenewSource] = useState("");
  const approved = applications
    .filter((a) => a.status === "approved")
    .sort(
      (a, b) =>
        b.end_date.localeCompare(a.end_date) ||
        b.updated_at.localeCompare(a.updated_at),
    );
  async function createBlank() {
    const a = await api<Application>("/applications", "POST");
    setShowNew(false);
    await open(a.id);
    await refresh();
  }
  async function renew(sourceId: string) {
    const result = await api<{ application: Application; reused: boolean }>(
      `/applications/${sourceId}/renew`,
      "POST",
    );
    setShowNew(false);
    await open(result.application.id);
    await refresh();
    setNotice(
      result.reused
        ? "Your existing renewal draft has been reopened. Continue where you left off."
        : "Your information and TOR have been copied. Enter the new contract dates, check what changed, then review and submit.",
    );
  }
  async function refresh() {
    setApplications(await api<Application[]>("/applications"));
  }
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then(async (response) => {
        if (response.status === 401) return;
        if (!response.ok)
          throw new Error("Unable to connect. Please refresh the page.");
        const data = await response.json();
        setUser(data.user);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (user) void refresh().catch((e) => setError(e.message));
  }, [user]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }
  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await run(async () => {
      const result = await api<{ user: User }>(`/auth/${mode}`, "POST", data);
      setUser(result.user);
    });
  }
  async function open(id: string) {
    setSelected(await api<Application>(`/applications/${id}`));
  }
  const visible = applications.filter(
    (a) =>
      (filter === "all" || a.status === filter) &&
      `${a.position} ${a.office} ${a.applicant_name} ${a.id}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="portal">
      <header className="p-header">
        <a href="/" className="p-brand">
          <span className="p-mark">
            <Building2 size={26} />
          </span>
          <span>
            <strong>USTP</strong>
            <small>JOB ORDER RENEWAL</small>
          </span>
        </a>
        <div className="p-identity">
          {user ? (
            <>
              <span>
                {user.name}
                <small>
                  {user.role === "hrmo" ? "HRMO office" : "Applicant"}
                </small>
              </span>
              <button
                className="p-icon"
                aria-label="Sign out"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await api("/auth/logout", "POST");
                    setUser(null);
                    setSelected(null);
                    setApplications([]);
                    setSection("applications");
                    setShowNew(false);
                  })
                }
              >
                <LogOut size={20} />
              </button>
            </>
          ) : (
            <span>Personnel services</span>
          )}
        </div>
      </header>
      <main className="p-main">
        {error && (
          <div className="p-alert p-error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="p-alert p-success" role="status">
            {notice}
          </div>
        )}
        {user?.role === "hrmo" && !selected && !resetToken && (
          <nav className="p-admin-nav" aria-label="HRMO navigation">
            {(
              [
                "applications",
                "offices",
                "users",
                "settings",
                "email",
                "database",
              ] as const
            ).map((tab) => (
              <button
                key={tab}
                aria-current={section === tab ? "page" : undefined}
                disabled={busy}
                onClick={() => {
                  setSection(tab);
                  setError("");
                  setNotice("");
                }}
              >
                {tab === "applications"
                  ? "Applications"
                  : tab === "offices"
                    ? "Offices"
                    : tab === "users"
                      ? "Users"
                      : tab === "settings"
                        ? "Contract settings"
                        : tab === "email"
                          ? "Email settings"
                          : "Database backups"}
              </button>
            ))}
          </nav>
        )}
        {resetToken ? (
          <ResetPassword
            token={resetToken}
            onDone={() => {
              setResetToken("");
              setUser(null);
              setSelected(null);
              setMode("login");
            }}
          />
        ) : loading ? (
          <p role="status">Loading your workspace…</p>
        ) : !user ? (
          <div className="p-auth-layout">
            <section className="p-intro">
              <p className="p-eyebrow">PERSONNEL SERVICES · USTP</p>
              <h1>
                Your next chapter
                <br />
                <em>starts here.</em>
              </h1>
              <p>
                Prepare your job order renewal, submit your documents, and
                follow your application from submission to decision.
              </p>
              <div className="p-intro-step">
                <span>01</span>
                <div>
                  <strong>Prepare your application</strong>
                  <p>Save your progress and return when you’re ready.</p>
                </div>
              </div>
              <div className="p-intro-step">
                <span>02</span>
                <div>
                  <strong>Submit for review</strong>
                  <p>Your documents go directly to the HRMO office.</p>
                </div>
              </div>
              <div className="p-intro-step">
                <span>08</span>
                <div>
                  <strong>Stay informed</strong>
                  <p>View decisions and respond to correction requests.</p>
                </div>
              </div>
            </section>
            <section className="p-card p-auth">
              <p className="p-eyebrow">WELCOME TO THE RENEWAL PORTAL</p>
              <h2>
                {mode === "login"
                  ? "Sign in to your account"
                  : "Create an applicant account"}
              </h2>
              <p className="p-muted">
                {mode === "login"
                  ? "Applicants and HRMO staff sign in here."
                  : "Use your own email address to track your renewals."}
              </p>
              <form onSubmit={authenticate} key={mode}>
                {mode === "register" && (
                  <label>
                    Full name
                    <input
                      name="name"
                      autoComplete="name"
                      required
                      maxLength={120}
                    />
                  </label>
                )}
                <label>
                  Email address
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                  />
                </label>
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    minLength={mode === "register" ? 12 : undefined}
                    maxLength={128}
                    required
                  />
                </label>
                {mode === "register" && (
                  <p className="p-muted p-small">Use at least 12 characters.</p>
                )}
                <button className="p-primary p-wide" disabled={busy}>
                  {busy
                    ? "Please wait…"
                    : mode === "login"
                      ? "Sign in"
                      : "Create account"}
                </button>
              </form>
              <p className="p-auth-switch">
                {mode === "login" ? "New applicant?" : "Already registered?"}{" "}
                <button
                  disabled={busy}
                  onClick={() => {
                    setMode(mode === "login" ? "register" : "login");
                    setError("");
                  }}
                >
                  {mode === "login" ? "Create an account" : "Sign in"}
                </button>
              </p>
            </section>
          </div>
        ) : user.role === "hrmo" && section === "database" ? (
          <DatabaseBackups />
        ) : user.role === "hrmo" && section === "email" ? (
          <EmailSettings
            request={api}
            run={run}
            busy={busy}
            notice={setNotice}
          />
        ) : user.role === "hrmo" && section === "settings" ? (
          <ContractSettings
            request={api}
            run={run}
            busy={busy}
            notice={setNotice}
          />
        ) : user.role === "hrmo" &&
          (section === "users" || section === "offices") ? (
          <AdminPanel
            key={section}
            section={section}
            request={api}
            run={run}
            busy={busy}
            notice={setNotice}
          />
        ) : selected ? (
          <ApplicationDetail
            key={selected.id}
            application={selected}
            user={user}
            busy={busy}
            run={run}
            onBack={() => {
              setSelected(null);
              void run(refresh);
            }}
            onReload={() => open(selected.id)}
            onNotice={setNotice}
          />
        ) : (
          <>
            <div className="p-title-row">
              <div>
                <p className="p-eyebrow">
                  {user.role === "hrmo"
                    ? "HRMO WORKSPACE"
                    : "APPLICANT WORKSPACE"}
                </p>
                <h1>
                  {user.role === "hrmo"
                    ? "Applications queue"
                    : "My applications"}
                </h1>
                <p className="p-muted">
                  {user.role === "hrmo"
                    ? "Review renewal requests, supporting documents, and applicant updates."
                    : "Prepare your renewal and keep track of every step."}
                </p>
              </div>
              <div className="p-actions">
                <button disabled={busy} onClick={() => void run(refresh)}>
                  <RefreshCw size={16} /> Refresh
                </button>
                {user.role === "applicant" && (
                  <button
                    className="p-primary"
                    disabled={busy}
                    onClick={() => {
                      if (approved.length) {
                        setRenewSource(approved[0].id);
                        setShowNew(true);
                      } else void run(createBlank);
                    }}
                  >
                    <Plus size={18} /> New application
                  </button>
                )}
              </div>
            </div>
            {user.role === "applicant" && showNew && (
              <section
                className="p-card p-section p-renewal-choice"
                aria-label="Start an application"
              >
                <h2>Reuse your previous application</h2>
                <p>
                  Keep your personal details, education, contacts, compensation,
                  office and TOR. Enter the new contract dates and update only
                  what changed.
                </p>
                <label>
                  Previous approved application
                  <select
                    value={renewSource}
                    disabled={busy}
                    onChange={(e) => setRenewSource(e.target.value)}
                  >
                    {approved.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.start_date} to {a.end_date} · {a.position} ·{" "}
                        {a.id.slice(0, 8).toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="p-muted">
                  An existing unfinished renewal will be reopened. Each new
                  renewal still goes to HRMO for review.
                </p>
                <div className="p-actions">
                  <button
                    className="p-primary"
                    disabled={busy || !renewSource}
                    onClick={() => void run(() => renew(renewSource))}
                  >
                    Reuse and start renewal
                  </button>
                  <button disabled={busy} onClick={() => void run(createBlank)}>
                    Start with a blank form
                  </button>
                  <button disabled={busy} onClick={() => setShowNew(false)}>
                    Cancel
                  </button>
                </div>
              </section>
            )}
            <div className="p-stats">
              {(user.role === "hrmo"
                ? ["submitted", "under_review", "approved"]
                : ["draft", "submitted", "returned"]
              ).map((status) => (
                <div className="p-card" key={status}>
                  <span>{statuses[status]}</span>
                  <strong>
                    {applications.filter((a) => a.status === status).length}
                  </strong>
                </div>
              ))}
            </div>
            <section className="p-card p-list">
              <div className="p-toolbar">
                <label className="p-search">
                  Search applications
                  <input
                    type="search"
                    placeholder="Search name, position or office…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label>
                  Status
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">All statuses</option>
                    {Object.entries(statuses)
                      .filter(
                        ([key]) =>
                          key !== "contract_generated" &&
                          (user.role !== "hrmo" || key !== "draft"),
                      )
                      .map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              {!visible.length ? (
                <div className="p-empty">
                  <FileText size={36} />
                  <h2>
                    {applications.length
                      ? "No matching applications"
                      : "No applications yet"}
                  </h2>
                  <p>
                    {user.role === "hrmo"
                      ? "Submitted applications will appear here."
                      : "Start a new application to prepare your renewal."}
                  </p>
                </div>
              ) : (
                <div className="p-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>
                          {user.role === "hrmo" ? "Applicant" : "Reference"}
                        </th>
                        <th>Position / office</th>
                        <th>Contract period</th>
                        <th>Status</th>
                        <th>Updated</th>
                        <th>
                          <span className="sr-only">Action</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((a) => (
                        <tr key={a.id}>
                          <td>
                            <strong>
                              {user.role === "hrmo"
                                ? a.applicant_name
                                : a.id.slice(0, 8).toUpperCase()}
                            </strong>
                            {user.role === "hrmo" && (
                              <small>{a.applicant_email}</small>
                            )}
                          </td>
                          <td>
                            {a.position || "Not specified"}
                            <small>{a.office || "Draft application"}</small>
                          </td>
                          <td>
                            {a.start_date || "—"}
                            <small>{a.end_date || "—"}</small>
                          </td>
                          <td>
                            <Badge status={a.status} />
                          </td>
                          <td>{date(a.updated_at)}</td>
                          <td>
                            <button
                              disabled={busy}
                              onClick={() => void run(() => open(a.id))}
                            >
                              Open{" "}
                              <span className="sr-only">
                                {a.id.slice(0, 8)}
                              </span>
                            </button>
                            {user.role === "applicant" &&
                              a.status === "approved" && (
                                <button
                                  className="p-renew-action"
                                  disabled={busy}
                                  aria-label={`Renew application ${a.id.slice(0, 8)}`}
                                  onClick={() => void run(() => renew(a.id))}
                                >
                                  Renew
                                </button>
                              )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
      <footer className="p-footer">
        University of Science and Technology of Southern Philippines{" "}
        <span>Job Order Renewal Portal</span>
      </footer>
    </div>
  );
}
function ApplicationDetail({
  application: a,
  user,
  busy,
  run,
  onBack,
  onReload,
  onNotice,
}: {
  application: Application;
  user: User;
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
  onBack: () => void;
  onReload: () => Promise<void>;
  onNotice: (s: string) => void;
}) {
  const normalize = (value: Application): Application => ({
    ...value,
    contract_details: { ...emptyContract(), ...value.contract_details },
    education_details: {
      highest_education: "",
      school: "",
      course: "",
      graduation_year: "",
      ...value.education_details,
    },
    contact_details: {
      email: value.applicant_email || "",
      phone: "",
      ...value.contact_details,
    },
    tor_items: value.tor_items?.length ? value.tor_items : [""],
    tor_sections: value.tor_sections?.length ? value.tor_sections : blankTor(),
    personal_details: {
      full_name: value.applicant_name || "",
      nationality: "Filipino",
      civil_status: "",
      address: "",
      valid_id: "",
      ...value.personal_details,
    },
  });
  const [form, setForm] = useState(() => normalize(a));
  const [step, setStep] = useState(a.wizard_step || 1);
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState("under_review");
  const [kind, setKind] = useState("tor");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  useEffect(() => {
    setForm(normalize(a));
    setStep(a.wizard_step || 1);
    setConfirmSubmit(false);
  }, [a]);
  useEffect(() => {
    if (a.status === "under_review") setDecision("approved");
    if (a.status === "approved") setDecision("returned");
  }, [a.status]);
  const editable =
    user.role === "applicant" && ["draft", "returned"].includes(a.status);
  const dirty =
    editable &&
    [
      "position",
      "office",
      "start_date",
      "end_date",
      "personal_details",
      "tor_sections",
      "tor_items",
      "contract_details",
      "education_details",
      "contact_details",
    ].some(
      (key) =>
        stableJson(form[key as keyof Application]) !==
        stableJson(a[key as keyof Application]),
    );
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  async function save(targetStep = step) {
    return api<Application>(`/applications/${a.id}`, "PUT", {
      ...form,
      wizard_step: targetStep,
      version: a.version,
    });
  }
  async function upload() {
    if (!file) throw new Error("Choose a document first.");
    if (file.size > 5 * 1024 * 1024)
      throw new Error("Choose a file no larger than 5 MB.");
    if (dirty) await save();
    const response = await fetch(`/api/applications/${a.id}/documents`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Requested-With": "USTP-Portal",
        "X-File-Name": encodeURIComponent(file.name),
        "X-Document-Kind": kind,
      },
      body: file,
    });
    const result = await response.json();
    await onReload();
    if (!response.ok) throw new Error(result.error || "Upload failed.");
    setFile(null);
    setFileKey((k) => k + 1);
    onNotice("Document uploaded.");
  }
  return (
    <>
      <button
        className="p-back"
        disabled={busy}
        onClick={() => {
          if (!dirty || window.confirm("Discard your unsaved changes?"))
            onBack();
        }}
      >
        <ArrowLeft size={16} /> All applications
      </button>
      <div className="p-title-row">
        <div>
          <p className="p-eyebrow">
            RENEWAL · {a.id.slice(0, 8).toUpperCase()}
          </p>
          <h1>
            {editable ? "Prepare your application" : "Application details"}
          </h1>
          <p className="p-muted">
            {a.applicant_name} · {a.applicant_email}
          </p>
        </div>
        <Badge status={a.status} />
      </div>
      {editable &&
        a.events?.some(
          (e) =>
            e.status === "draft" &&
            /^Renewal created from application [a-f0-9-]{36}\.$/.test(e.note),
        ) && (
          <div className="p-alert">
            Your previous information and TOR are filled in. Enter the new
            contract dates, update anything that changed and check the Review
            step before submitting. An inactive office must be selected again.
            Add any supporting files needed for this period; previous uploads
            and signed/generated contracts stay with the original application.
          </div>
        )}
      {a.status === "returned" && (
        <div className="p-alert">
          HRMO has requested corrections. Review the notes below, update your
          application, and resubmit.
        </div>
      )}
      <div className="p-detail-grid">
        <div>
          {editable ? (
            <ApplicationWizard
              data={form}
              onChange={(value) => setForm({ ...form, ...value })}
              step={step}
              busy={busy}
              dirty={dirty}
              onSave={() =>
                void run(async () => {
                  await save();
                  await onReload();
                  onNotice("Draft saved.");
                })
              }
              onMove={(target) =>
                void run(async () => {
                  await save(target);
                  await onReload();
                })
              }
            />
          ) : (
            <section className="p-card p-section">
              <h2>Submitted application</h2>
              <p className="p-muted">
                Review the applicant's details below. Request corrections if
                anything needs to change.
              </p>
              <ApplicationReview data={a} />
            </section>
          )}
          {(!editable || step === 8) && (
            <>
              <section className="p-card p-section">
                <div className="p-section-heading">
                  <span>08</span>
                  <div>
                    <h2>Supporting documents</h2>
                    <p>
                      Optional supporting files. Your TOR is entered above. PDF,
                      PNG or JPEG; up to 5 MB each, 10 files total.
                    </p>
                  </div>
                </div>
                {a.documents?.length ? (
                  <ul className="p-documents">
                    {a.documents.map((doc) => (
                      <li key={doc.id}>
                        <FileText size={22} />
                        <div>
                          <a
                            href={`/api/applications/${a.id}/documents/${doc.id}`}
                          >
                            {doc.name}
                          </a>
                          <small>
                            {doc.kind === "tor"
                              ? "Terms of Reference"
                              : "Supporting document"}{" "}
                            · {Math.ceil(doc.size / 1024)} KB
                          </small>
                        </div>
                        {editable && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                if (!window.confirm(`Remove ${doc.name}?`))
                                  return;
                                if (dirty) await save();
                                await api(
                                  `/applications/${a.id}/documents/${doc.id}`,
                                  "DELETE",
                                );
                                await onReload();
                              })
                            }
                          >
                            Remove
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="p-muted">No documents uploaded.</p>
                )}
                {editable && (
                  <div className="p-upload">
                    <label>
                      Document type
                      <select
                        disabled={busy}
                        value={kind}
                        onChange={(e) => setKind(e.target.value)}
                      >
                        <option value="tor">Terms of Reference</option>
                        <option value="supporting">Supporting document</option>
                      </select>
                    </label>
                    <label>
                      Choose document
                      <input
                        key={fileKey}
                        disabled={busy}
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    <button
                      disabled={busy || !file}
                      onClick={() => void run(upload)}
                    >
                      <Upload size={16} /> Upload document
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
        <aside>
          {!editable && (
            <ContractPanel
              id={a.id}
              status={a.status}
              version={a.version}
              contract={a.contract}
              hrmo={user.role === "hrmo"}
              busy={busy}
              run={run}
              reload={onReload}
              request={api}
              notice={onNotice}
            />
          )}
          <section className="p-card p-section">
            <h2>Application status</h2>
            <div className="p-status-line">
              <Badge status={a.status} />
            </div>
            <p className="p-muted p-small">Last updated {date(a.updated_at)}</p>
            <button
              disabled={busy}
              onClick={() => {
                if (
                  !dirty ||
                  window.confirm("Refresh and discard unsaved changes?")
                )
                  void run(onReload);
              }}
            >
              <RefreshCw size={15} /> Refresh status
            </button>
            {editable && step === 8 && (
              <div className="p-submit-box">
                <p>
                  Check your personal details and complete your numbered TOR
                  before submitting. Submitted applications are locked during
                  review.
                </p>
                {confirmSubmit ? (
                  <>
                    <p>
                      <strong>Ready to send this application to HRMO?</strong>
                    </p>
                    <button
                      className="p-primary p-wide"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const latest = dirty ? await save() : a;
                          try {
                            await api(`/applications/${a.id}/submit`, "POST", {
                              version: latest.version,
                            });
                          } finally {
                            await onReload();
                          }
                          onNotice("Application submitted to HRMO.");
                        })
                      }
                    >
                      <CheckCircle2 size={17} /> Confirm submission
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => setConfirmSubmit(false)}
                    >
                      Keep editing
                    </button>
                  </>
                ) : (
                  <button
                    className="p-primary p-wide"
                    disabled={busy}
                    onClick={() => setConfirmSubmit(true)}
                  >
                    {a.status === "returned"
                      ? "Resubmit application"
                      : "Submit application"}
                  </button>
                )}
              </div>
            )}
            {user.role === "hrmo" &&
              ["submitted", "under_review", "approved"].includes(a.status) && (
                <form
                  className="p-review"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(async () => {
                      await api(`/applications/${a.id}/review`, "POST", {
                        status: decision,
                        note,
                        version: a.version,
                      });
                      await onReload();
                      setNote("");
                      onNotice("Review decision saved.");
                    });
                  }}
                >
                  <h3>HRMO review</h3>
                  <label>
                    Decision
                    <select
                      disabled={busy}
                      value={decision}
                      onChange={(e) => setDecision(e.target.value)}
                    >
                      {a.status === "submitted" && (
                        <option value="under_review">Start review</option>
                      )}
                      {a.status !== "approved" && (
                        <option value="approved">Approve</option>
                      )}
                      <option value="returned">Return for corrections</option>
                      {a.status !== "approved" && (
                        <option value="rejected">Reject</option>
                      )}
                    </select>
                  </label>
                  <label>
                    Notes to applicant
                    <textarea
                      disabled={busy}
                      required={["returned", "rejected"].includes(decision)}
                      maxLength={3000}
                      rows={4}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Explain any corrections or your decision."
                    />
                  </label>
                  <button className="p-primary p-wide" disabled={busy}>
                    Save review decision
                  </button>
                </form>
              )}
          </section>
          <section className="p-card p-section">
            <h2>Status history</h2>
            {a.events?.length ? (
              <ol className="p-timeline">
                {a.events.map((event) => (
                  <li key={event.id}>
                    <strong>{statuses[event.status]}</strong>
                    <small>
                      {event.actor} · {date(event.created_at)}
                    </small>
                    {event.note && <p>{event.note}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="p-muted">
                Your submission and review updates will appear here.
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
