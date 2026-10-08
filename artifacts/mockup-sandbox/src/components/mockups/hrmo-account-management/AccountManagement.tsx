import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Landmark,
  ListChecks,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

type AccountStatus = "Active" | "Pending" | "Suspended";
type Account = {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  status: AccountStatus;
  initials: string;
};
type Renewal = {
  id: number;
  name: string;
  title: string;
  department: string;
  endDate: string;
  days: number;
  status: "Needs review" | "In progress" | "Completed";
};
type ImportRow = {
  name: string;
  email: string;
  role: string;
  department: string;
  status: string;
  issue: "existing" | "file" | "invalid" | null;
  selected: boolean;
};

const initialAccounts: Account[] = [
  { id: 1, name: "Mara Ellison", email: "mara.ellison@northbridge.edu", role: "HRMO Administrator", department: "Human Resources", status: "Active", initials: "ME" },
  { id: 2, name: "Jonas Reed", email: "jonas.reed@northbridge.edu", role: "Department Coordinator", department: "Arts & Humanities", status: "Active", initials: "JR" },
  { id: 3, name: "Priya Nair", email: "priya.nair@northbridge.edu", role: "HRMO Staff", department: "Human Resources", status: "Active", initials: "PN" },
  { id: 4, name: "Theo Wallace", email: "theo.wallace@northbridge.edu", role: "Department Coordinator", department: "Life Sciences", status: "Pending", initials: "TW" },
  { id: 5, name: "Amara Okafor", email: "amara.okafor@northbridge.edu", role: "HRMO Staff", department: "Faculty Affairs", status: "Active", initials: "AO" },
  { id: 6, name: "Elliot Park", email: "elliot.park@northbridge.edu", role: "Department Coordinator", department: "Student Services", status: "Suspended", initials: "EP" },
  { id: 7, name: "Lena Foster", email: "lena.foster@northbridge.edu", role: "HRMO Staff", department: "Human Resources", status: "Active", initials: "LF" },
];

const dateFromToday = (daysAhead: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const todayLabel = () =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

const initialRenewals: Renewal[] = [
  { id: 101, name: "Leila Brennan", title: "Research Fellow", department: "School of Public Health", endDate: dateFromToday(8), days: 8, status: "Needs review" },
  { id: 102, name: "Marcus Chen", title: "Lecturer, History", department: "Arts & Humanities", endDate: dateFromToday(15), days: 15, status: "In progress" },
  { id: 103, name: "Amina Yusuf", title: "Laboratory Technician", department: "Life Sciences", endDate: dateFromToday(23), days: 23, status: "Needs review" },
  { id: 104, name: "Peter Novak", title: "Program Coordinator", department: "Student Services", endDate: dateFromToday(29), days: 29, status: "Needs review" },
  { id: 105, name: "Sofia Alvarez", title: "Visiting Scholar", department: "Global Studies", endDate: dateFromToday(34), days: 34, status: "Completed" },
];

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");
const initialsFor = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(value.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  row.push(value.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#65736f] transition hover:bg-[#edf1eb] hover:text-[#203d37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7146]">{children}</button>;
}

function StatusPill({ status }: { status: string }) {
  const styles = status === "Active" || status === "Completed"
    ? "bg-[#e7f0e9] text-[#32634b]"
    : status === "Pending" || status === "In progress"
      ? "bg-[#fbf1dc] text-[#8a6025]"
      : status === "Suspended"
        ? "bg-[#f8e8e4] text-[#a14c3f]"
        : "bg-[#f8e8e4] text-[#a14c3f]";
  return <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.01em]", styles)}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />{status}</span>;
}

export function AccountManagement() {
  const [activeTab, setActiveTab] = useState<"Renewals" | "Accounts">("Renewals");
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [renewals, setRenewals] = useState<Renewal[]>(initialRenewals);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountStatus, setAccountStatus] = useState("All statuses");
  const [accountRole, setAccountRole] = useState("All roles");
  const [renewalSearch, setRenewalSearch] = useState("");
  const [renewalFilter, setRenewalFilter] = useState("All renewals");
  const [dialog, setDialog] = useState<"add" | "import" | "renewal" | null>(null);
  const [selectedRenewal, setSelectedRenewal] = useState<Renewal | null>(null);
  const [toast, setToast] = useState("");
  const [formError, setFormError] = useState("");
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "HRMO Staff", department: "" });
  const [importStep, setImportStep] = useState<"select" | "analysis" | "done">("select");
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [importNotice, setImportNotice] = useState("");
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [accountActionId, setAccountActionId] = useState<number | null>(null);

  useEffect(() => {
    if (!dialog) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialog();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [dialog]);

  const filteredAccounts = useMemo(() => accounts.filter((account) => {
    const query = accountSearch.trim().toLowerCase();
    const matchesSearch = !query || `${account.name} ${account.email} ${account.department} ${account.role}`.toLowerCase().includes(query);
    return matchesSearch && (accountStatus === "All statuses" || account.status === accountStatus) && (accountRole === "All roles" || account.role === accountRole);
  }), [accounts, accountSearch, accountStatus, accountRole]);
  const filteredRenewals = useMemo(() => renewals.filter((renewal) => {
    const query = renewalSearch.trim().toLowerCase();
    const matchesSearch = !query || `${renewal.name} ${renewal.title} ${renewal.department}`.toLowerCase().includes(query);
    const matchesFilter = renewalFilter === "All renewals" || (renewalFilter === "Needs review" ? renewal.status === "Needs review" : renewal.status === "In progress");
    return matchesSearch && matchesFilter;
  }), [renewals, renewalSearch, renewalFilter]);
  const activeAccounts = accounts.filter((account) => account.status === "Active").length;
  const dueSoon = renewals.filter((renewal) => renewal.days <= 14 && renewal.status !== "Completed").length;

  const announce = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3400);
  };

  const closeDialog = () => {
    setDialog(null);
    setFormError("");
    setImportError("");
    setImportNotice("");
  };

  const openAdd = () => {
    setNewUser({ name: "", email: "", role: "HRMO Staff", department: "" });
    setFormError("");
    setDialog("add");
  };

  const submitNewUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = newUser.email.trim().toLowerCase();
    if (!newUser.name.trim() || !newUser.department.trim() || !normalizedEmail) {
      setFormError("Complete each field before adding this account.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setFormError("Enter a valid email address.");
      return;
    }
    if (accounts.some((account) => account.email.toLowerCase() === normalizedEmail)) {
      setFormError("An account with this email address already exists.");
      return;
    }
    setAccounts((current) => [{ id: Date.now(), name: newUser.name.trim(), email: normalizedEmail, role: newUser.role, department: newUser.department.trim(), status: "Active", initials: initialsFor(newUser.name) }, ...current]);
    closeDialog();
    announce("Account added to this demo session.");
  };

  const mapRowsToImport = (rawRows: string[][], source: string) => {
    if (rawRows.length < 2) {
      setImportError("We couldn't find any account rows. Add a header row and at least one account.");
      return;
    }
    const headers = rawRows[0].map((cell) => cell.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const findColumn = (names: string[]) => headers.findIndex((header) => names.includes(header));
    const nameIndex = findColumn(["name", "fullname", "displayname"]);
    const emailIndex = findColumn(["email", "emailaddress"]);
    const roleIndex = findColumn(["role", "accessrole"]);
    const departmentIndex = findColumn(["department", "unit", "school"]);
    if (nameIndex < 0 || emailIndex < 0) {
      setImportError("Required columns not found. Include “name” and “email” in the first row.");
      return;
    }
    const existing = new Set(accounts.map((account) => account.email.trim().toLowerCase()));
    const seenInFile = new Set<string>();
    const mapped = rawRows.slice(1).map((cells): ImportRow => {
      const name = cells[nameIndex] ?? "";
      const email = (cells[emailIndex] ?? "").trim();
      const normalizedEmail = email.toLowerCase();
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      let issue: ImportRow["issue"] = null;
      if (!name.trim() || !validEmail) issue = "invalid";
      else if (existing.has(normalizedEmail)) issue = "existing";
      else if (seenInFile.has(normalizedEmail)) issue = "file";
      if (normalizedEmail) seenInFile.add(normalizedEmail);
      return {
        name: name.trim(),
        email,
        role: (roleIndex >= 0 ? cells[roleIndex] : "")?.trim() || "HRMO Staff",
        department: (departmentIndex >= 0 ? cells[departmentIndex] : "")?.trim() || "Unassigned",
        status: "Active",
        issue,
        selected: issue === null,
      };
    }).filter((row) => row.name || row.email);
    if (!mapped.length) {
      setImportError("No account rows were found beneath the header.");
      return;
    }
    setImportRows(mapped);
    setImportFileName(source);
    setImportStep("analysis");
    setImportError("");
    setImportNotice("");
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportError("");
    setImportNotice("");
    setImportFileName(file.name);
    if (/\.xlsx?$/i.test(file.name)) {
      setImportNotice("Excel parsing is not enabled. This file has not been read. You can run a duplicate-analysis demo on synthetic rows below.");
      event.target.value = "";
      return;
    }
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setImportError("Choose a CSV file. Excel files are not parsed in this demo.");
      return;
    }
    try {
      const text = await file.text();
      mapRowsToImport(parseCsv(text.replace(/^\uFEFF/, "")), file.name);
    } catch {
      setImportError("We couldn't read that CSV file. Try another file.");
    } finally {
      event.target.value = "";
    }
  };

  const runSampleSpreadsheet = () => {
    const sample = [
      ["name", "email", "role", "department"],
      ["Nina Patel", "nina.patel@northbridge.edu", "Department Coordinator", "Library Services"],
      ["Omar Bell", "omar.bell@northbridge.edu", "HRMO Staff", "Human Resources"],
      ["Rory James", "rory.james@northbridge.edu", "Department Coordinator", "Arts & Humanities"],
      ["Rory James", "RORY.JAMES@northbridge.edu", "HRMO Staff", "Human Resources"],
      ["Theo Wallace", "theo.wallace@northbridge.edu", "Department Coordinator", "Life Sciences"],
    ];
    mapRowsToImport(sample, "Synthetic spreadsheet demo");
    setImportNotice("Synthetic sample rows only — no Excel file was opened or processed.");
  };

  const toggleImportRow = (index: number) => setImportRows((current) => current.map((row, rowIndex) => rowIndex === index && !row.issue ? { ...row, selected: !row.selected } : row));
  const selectAllImportRows = (selected: boolean) => setImportRows((current) => current.map((row) => row.issue ? row : { ...row, selected }));
  const completeImport = () => {
    const picked = importRows.filter((row) => row.selected && !row.issue);
    if (!picked.length) {
      setImportError("Select at least one eligible account to continue.");
      return;
    }
    setAccounts((current) => {
      const added: Account[] = [];
      const known = new Set(current.map((account) => account.email.toLowerCase()));
      picked.forEach((row) => {
        if (known.has(row.email.toLowerCase())) return;
        known.add(row.email.toLowerCase());
        added.push({ id: Date.now() + added.length, name: row.name, email: row.email.trim().toLowerCase(), role: row.role, department: row.department, status: "Active", initials: initialsFor(row.name) });
      });
      return [...added, ...current];
    });
    setImportStep("done");
    setImportError("");
  };

  const openImport = () => {
    setImportStep("select");
    setImportRows([]);
    setImportFileName("");
    setImportNotice("");
    setImportError("");
    setDialog("import");
  };

  const handleRenewalAction = (renewal: Renewal, action: "complete" | "remind" | "details") => {
    if (action === "complete") {
      setRenewals((current) => current.map((item) => item.id === renewal.id ? { ...item, status: "Completed" } : item));
      announce(`${renewal.name}'s renewal marked complete in this demo.`);
    } else if (action === "remind") announce(`Reminder queued for ${renewal.name} in this demo.`);
    else {
      setSelectedRenewal(renewal);
      setDialog("renewal");
    }
  };

  const downloadTemplate = () => {
    const template = "name,email,role,department\nAvery Morgan,avery.morgan@northbridge.edu,HRMO Staff,Human Resources";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([template], { type: "text/csv" }));
    link.download = "hrmo-account-template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
    announce("CSV template downloaded.");
  };

  const inputClass = "mt-1.5 h-11 w-full rounded-xl border border-[#dce3db] bg-[#fffefa] px-3.5 text-sm text-[#263a36] outline-none transition placeholder:text-[#a1aaa4] focus:border-[#678779] focus:ring-4 focus:ring-[#678779]/10";
  const selectClass = "h-10 rounded-xl border border-[#dce3db] bg-[#fffefa] px-3 text-sm text-[#46554f] outline-none transition focus:border-[#678779] focus:ring-4 focus:ring-[#678779]/10";

  return (
    <div className="min-h-screen bg-[#f3f4ee] text-[#263a36] antialiased">
      <style>{`
        @keyframes enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .hrmo-enter { animation: enter .38s cubic-bezier(.2,.7,.2,1) both; }
        .hrmo-enter-1 { animation-delay: 55ms; }
        .hrmo-enter-2 { animation-delay: 105ms; }
        .hrmo-enter-3 { animation-delay: 155ms; }
        .hrmo-scroll::-webkit-scrollbar { height: 7px; width: 7px; }
        .hrmo-scroll::-webkit-scrollbar-thumb { background: #cbd4ca; border-radius: 99px; }
      `}</style>
      <div className="mx-auto min-h-screen max-w-[1600px] lg:flex">
        <aside className="hidden w-[248px] shrink-0 flex-col border-r border-[#e0e5dc] bg-[#f8f8f3] px-5 py-6 lg:flex">
          <div className="flex items-center gap-3 px-1">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-[#23463d] text-[#f3e6c9] shadow-[0_5px_14px_rgba(35,70,61,.18)]">
              <Landmark size={22} strokeWidth={1.7} />
              <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-[#f8f8f3] bg-[#bd925c]" />
            </div>
            <div>
              <p className="font-['DM_Sans'] text-[15px] font-bold tracking-[-0.03em] text-[#203d37]">Northbridge</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#87918a]">People operations</p>
            </div>
          </div>
          <div className="mt-10 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9aa39b]">Workspace</div>
          <nav aria-label="Main navigation" className="mt-3 space-y-1">
            <button onClick={() => setActiveTab("Renewals")} className={cx("flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition", activeTab === "Renewals" ? "bg-[#e8eee8] text-[#23483e]" : "text-[#68756e] hover:bg-[#eef1eb] hover:text-[#30453d]")}>
              <CalendarDays size={17} strokeWidth={1.8} /> Renewals
              <span className="ml-auto rounded-full bg-[#f8f8f3] px-2 py-0.5 text-[10px] font-bold text-[#587368]">{renewals.filter((item) => item.status !== "Completed").length}</span>
            </button>
            <button onClick={() => setActiveTab("Accounts")} className={cx("flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition", activeTab === "Accounts" ? "bg-[#e8eee8] text-[#23483e]" : "text-[#68756e] hover:bg-[#eef1eb] hover:text-[#30453d]")}>
              <UsersRound size={17} strokeWidth={1.8} /> Accounts
              <span className="ml-auto rounded-full bg-[#f8f8f3] px-2 py-0.5 text-[10px] font-bold text-[#587368]">{accounts.length}</span>
            </button>
          </nav>
          <div className="mt-auto">
            <div className="rounded-2xl border border-[#e4e8df] bg-[#f1f3eb] p-4">
              <div className="flex items-center gap-2 text-[#60756b]"><ShieldCheck size={16} /><span className="text-xs font-semibold">A steady hand</span></div>
              <p className="mt-2 text-[12px] leading-[1.6] text-[#79847c]">Keep renewals moving and account access in good order.</p>
            </div>
            <div className="mt-5 flex items-center gap-3 border-t border-[#e3e7df] pt-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dbe5dc] text-xs font-bold text-[#34574a]">ME</div>
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#334740]">Mara Ellison</p><p className="mt-0.5 text-[10px] text-[#8a958c]">HRMO administrator</p></div>
              <IconButton label="Account help" onClick={() => announce("You're viewing a standalone HRMO prototype.")}><CircleHelp size={16} /></IconButton>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-[#e2e6df] bg-[#f8f8f4]/95 px-4 py-3 backdrop-blur-md sm:px-7 lg:px-10">
            <div className="mx-auto flex max-w-[1190px] items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#23463d] text-[#f3e6c9] lg:hidden"><Landmark size={18} /></div>
                <div className="flex items-center gap-2 text-[12px] text-[#9aa29a]"><span className="hidden sm:inline">People operations</span><ChevronRight size={14} className="hidden sm:block" /><span className="font-semibold text-[#496157]">HRMO workspace</span></div>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-2 rounded-full border border-[#e5e8e1] bg-[#fbfbf7] px-3 py-1.5 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#c18e4f]" /><span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#866a43]">Demo workspace</span></div>
                <IconButton label="Notifications" onClick={() => announce("You’re all caught up.")}><Bell size={17} /></IconButton>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dce5dc] text-[10px] font-bold text-[#34574a] lg:hidden">ME</div>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1190px] px-4 pb-12 pt-7 sm:px-7 sm:pt-9 lg:px-10">
            <div className="hrmo-enter flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9a7c53]"><span className="h-px w-5 bg-[#c09b69]" />Human resources · operations</div>
                <h1 className="font-['DM_Sans'] text-[30px] font-semibold tracking-[-0.055em] text-[#203d37] sm:text-[38px]">Good morning, Mara<span className="text-[#b78a51]">.</span></h1>
                <p className="mt-2 text-sm text-[#78857c]">A clear view of what needs your attention today.</p>
              </div>
              <div className="flex items-center gap-2 self-start rounded-xl border border-[#e2e6de] bg-[#fbfbf7] px-3.5 py-2.5 md:self-auto">
                 <CalendarDays size={15} className="text-[#849187]" /><span className="text-xs font-medium text-[#64736b]">{todayLabel()}</span>
              </div>
            </div>

            <div className="hrmo-enter hrmo-enter-1 mt-7 rounded-2xl border border-[#e1e6dd] bg-[#fbfbf7] p-1.5 shadow-[0_8px_30px_rgba(44,64,53,.035)]">
              <div className="flex max-w-[390px] gap-1" role="tablist" aria-label="HRMO work areas">
                {(["Renewals", "Accounts"] as const).map((tab) => (
                  <button key={tab} role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={cx("flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7146]", activeTab === tab ? "bg-[#23463d] text-[#f7f4e9] shadow-[0_5px_12px_rgba(35,70,61,.16)]" : "text-[#718078] hover:bg-[#f0f2ec] hover:text-[#365247]")}>
                    {tab === "Renewals" ? <CalendarDays size={16} /> : <UsersRound size={16} />}{tab}
                    {tab === "Renewals" && <span className={cx("rounded-full px-1.5 py-0.5 text-[10px]", activeTab === tab ? "bg-white/15 text-white" : "bg-[#e8ede7] text-[#687970]")}>{renewals.filter((item) => item.status !== "Completed").length}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-[#e9dfc9] bg-[#f8f2e7] px-3.5 py-3 text-[11px] leading-relaxed text-[#796b54] sm:items-center">
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#a17d48] sm:mt-0" />
              <p><strong className="font-semibold text-[#69583e]">Standalone demo.</strong> Sample records only. Changes stay in this browser session and are discarded when you refresh. No backend or university database is connected.</p>
            </div>

            {activeTab === "Renewals" ? (
              <section role="tabpanel" aria-label="Renewals" className="hrmo-enter hrmo-enter-2 mt-7">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[#e2e6dd] bg-[#fbfbf7] p-4 sm:p-5"><div className="flex items-start justify-between"><span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#88948b]">Open renewals</span><div className="rounded-xl bg-[#edf1eb] p-2 text-[#527065]"><ListChecks size={17} /></div></div><div className="mt-3 flex items-end gap-2"><span className="font-['DM_Sans'] text-3xl font-semibold tracking-[-0.06em] text-[#29483f]">{renewals.filter((item) => item.status !== "Completed").length}</span><span className="mb-1 text-[11px] text-[#8a958d]">awaiting attention</span></div></div>
                  <div className="rounded-2xl border border-[#e2e6dd] bg-[#fbfbf7] p-4 sm:p-5"><div className="flex items-start justify-between"><span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#88948b]">Due in 14 days</span><div className="rounded-xl bg-[#fbf0dc] p-2 text-[#9b753e]"><Clock3 size={17} /></div></div><div className="mt-3 flex items-end gap-2"><span className="font-['DM_Sans'] text-3xl font-semibold tracking-[-0.06em] text-[#29483f]">{dueSoon}</span><span className="mb-1 text-[11px] text-[#8a958d]">early review recommended</span></div></div>
                  <div className="rounded-2xl border border-[#e2e6dd] bg-[#fbfbf7] p-4 sm:p-5"><div className="flex items-start justify-between"><span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#88948b]">Completed this cycle</span><div className="rounded-xl bg-[#e7f0e9] p-2 text-[#49755a]"><CheckCircle2 size={17} /></div></div><div className="mt-3 flex items-end gap-2"><span className="font-['DM_Sans'] text-3xl font-semibold tracking-[-0.06em] text-[#29483f]">{renewals.filter((item) => item.status === "Completed").length}</span><span className="mb-1 text-[11px] text-[#8a958d]">of {renewals.length} sample cases</span></div></div>
                </div>
                <div className="mt-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                  <div><h2 className="font-['DM_Sans'] text-[20px] font-semibold tracking-[-0.035em] text-[#2a433b]">Renewal queue</h2><p className="mt-1 text-xs text-[#89948c]">A sample of upcoming contract end dates</p></div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[200px] flex-1 sm:flex-none"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a097]" /><input aria-label="Search renewals" value={renewalSearch} onChange={(event) => setRenewalSearch(event.target.value)} placeholder="Search people or departments" className="h-10 w-full rounded-xl border border-[#dfe4dc] bg-[#fbfbf7] pl-9 pr-3 text-xs outline-none transition placeholder:text-[#a5aea6] focus:border-[#789387] focus:ring-4 focus:ring-[#678779]/10 sm:w-[225px]" /></div>
                    <select aria-label="Filter renewals" className={selectClass} value={renewalFilter} onChange={(event) => setRenewalFilter(event.target.value)}><option>All renewals</option><option>Needs review</option><option>In progress</option></select>
                  </div>
                </div>
                <div className="hrmo-scroll mt-4 overflow-x-auto rounded-2xl border border-[#e0e5dc] bg-[#fbfbf7] shadow-[0_8px_24px_rgba(44,64,53,.035)]">
                  <table className="w-full min-w-[820px] border-collapse text-left">
                    <thead><tr className="border-b border-[#e9ece5] bg-[#f5f6f1] text-[10px] font-bold uppercase tracking-[0.12em] text-[#89958c]"><th className="px-5 py-3.5">Person</th><th className="px-4 py-3.5">Department</th><th className="px-4 py-3.5">Contract ends</th><th className="px-4 py-3.5">Status</th><th className="px-4 py-3.5 text-right">Next step</th></tr></thead>
                    <tbody>{filteredRenewals.map((renewal) => <tr key={renewal.id} className="group border-b border-[#edf0e9] last:border-0 hover:bg-[#f8f9f5]">
                      <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e9eee7] text-[10px] font-bold text-[#557365]">{initialsFor(renewal.name)}</div><div><p className="text-[13px] font-semibold text-[#34483f]">{renewal.name}</p><p className="mt-0.5 text-[11px] text-[#929b93]">{renewal.title}</p></div></div></td>
                      <td className="px-4 py-4 text-xs text-[#65736b]">{renewal.department}</td>
                      <td className="px-4 py-4"><p className="text-xs font-semibold text-[#51635a]">{renewal.endDate}</p><p className={cx("mt-1 text-[10px]", renewal.days <= 14 && renewal.status !== "Completed" ? "font-semibold text-[#a77739]" : "text-[#9ba39c]")}>{renewal.days} days remaining</p></td>
                      <td className="px-4 py-4"><StatusPill status={renewal.status} /></td>
                      <td className="px-4 py-4"><div className="flex items-center justify-end gap-1.5">{renewal.status !== "Completed" && <button onClick={() => handleRenewalAction(renewal, "complete")} className="rounded-lg border border-[#d9e3d8] bg-[#f8faf6] px-3 py-2 text-[11px] font-semibold text-[#4f6d5d] transition hover:border-[#b8ccb9] hover:bg-[#eaf1e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7146]">Mark done</button>}<IconButton label={`View ${renewal.name} renewal details`} onClick={() => handleRenewalAction(renewal, "details")}><MoreHorizontal size={17} /></IconButton></div></td>
                    </tr>)}
                    {filteredRenewals.length === 0 && <tr><td colSpan={5} className="px-6 py-14 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eff2ec] text-[#809085]"><Search size={18} /></div><p className="mt-3 text-sm font-semibold text-[#52645a]">No renewals match this view</p><p className="mt-1 text-xs text-[#929c93]">Try a different search or filter.</p></td></tr>}</tbody>
                  </table>
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-[#98a198]"><span>Showing {filteredRenewals.length} of {renewals.length} sample renewals</span><span className="flex items-center gap-1.5"><Activity size={12} /> Refreshed just now</span></div>
              </section>
            ) : (
              <section role="tabpanel" aria-label="Accounts" className="hrmo-enter hrmo-enter-2 mt-7">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                  <div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9a7c53]"><UsersRound size={13} /> Access administration</div><h2 className="font-['DM_Sans'] text-[25px] font-semibold tracking-[-0.05em] text-[#203d37]">Account directory</h2><p className="mt-1.5 max-w-lg text-xs leading-relaxed text-[#818c83]">Manage who can access HRMO services across the university.</p></div>
                  <div className="flex items-center gap-2"><button onClick={openImport} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#dce3da] bg-[#fbfbf7] px-3.5 text-xs font-semibold text-[#52685d] transition hover:border-[#b6c7ba] hover:bg-[#f1f4ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7146]"><Upload size={15} />Import users</button><button onClick={openAdd} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#23463d] px-4 text-xs font-semibold text-[#f6f3e8] shadow-[0_4px_12px_rgba(35,70,61,.15)] transition hover:bg-[#30594d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7146] focus-visible:ring-offset-2"><Plus size={15} />Add user</button></div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_1.15fr]">
                  <div className="relative overflow-hidden rounded-2xl border border-[#dfe6dd] bg-[#e9f0e9] p-4"><div className="absolute -right-3 -top-5 h-24 w-24 rounded-full border-[14px] border-[#dce8dc]" /><p className="relative text-[10px] font-bold uppercase tracking-[0.12em] text-[#688071]">Active accounts</p><div className="relative mt-2 flex items-baseline gap-2"><span className="font-['DM_Sans'] text-3xl font-semibold tracking-[-0.06em] text-[#29483f]">{activeAccounts}</span><span className="text-[10px] text-[#788e80]">of {accounts.length} total</span></div></div>
                  <div className="rounded-2xl border border-[#e5e3d8] bg-[#f8f5eb] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9c8055]">Pending access</p><div className="mt-2 flex items-baseline gap-2"><span className="font-['DM_Sans'] text-3xl font-semibold tracking-[-0.06em] text-[#705a39]">{accounts.filter((account) => account.status === "Pending").length}</span><span className="text-[10px] text-[#a59170]">awaiting setup</span></div></div>
                  <div className="flex items-center gap-3 rounded-2xl border border-[#e2e6dd] bg-[#fbfbf7] p-4"><div className="rounded-xl bg-[#f0eee4] p-2.5 text-[#8c7957]"><ShieldCheck size={17} /></div><div><p className="text-xs font-semibold text-[#54675c]">Access, at a glance</p><p className="mt-1 text-[10px] text-[#919b92]">User details are sample records</p></div><span className="ml-auto text-[10px] font-semibold text-[#8a9b8e]">LOCAL ONLY</span></div>
                </div>

                <div className="mt-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div><h3 className="font-['DM_Sans'] text-[19px] font-semibold tracking-[-0.04em] text-[#2a433b]">All accounts <span className="ml-1 text-sm font-medium text-[#a2aaa1]">{filteredAccounts.length}</span></h3><p className="mt-1 text-[11px] text-[#929b93]">Search or narrow by role and status</p></div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[190px] flex-1 sm:flex-none"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a097]" /><input aria-label="Search accounts" value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} placeholder="Name, email, department" className="h-10 w-full rounded-xl border border-[#dfe4dc] bg-[#fbfbf7] pl-9 pr-3 text-xs outline-none transition placeholder:text-[#a5aea6] focus:border-[#789387] focus:ring-4 focus:ring-[#678779]/10 sm:w-[230px]" /></div>
                    <button aria-expanded={showFilters} onClick={() => setShowFilters((value) => !value)} className={cx("inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7146]", showFilters || accountStatus !== "All statuses" || accountRole !== "All roles" ? "border-[#b9c9bc] bg-[#edf2ec] text-[#3b5b4d]" : "border-[#dfe4dc] bg-[#fbfbf7] text-[#68766e] hover:bg-[#f2f4ef]")}><SlidersHorizontal size={14} />Filters<ChevronDown size={13} className={cx("transition", showFilters && "rotate-180")} /></button>
                  </div>
                </div>
                {showFilters && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#e4e8e0] bg-[#f8f9f5] p-3 hrmo-enter"><Filter size={14} className="mr-1 text-[#829087]" /><label className="sr-only" htmlFor="status-filter">Filter by status</label><select id="status-filter" className={selectClass} value={accountStatus} onChange={(event) => setAccountStatus(event.target.value)}><option>All statuses</option><option>Active</option><option>Pending</option><option>Suspended</option></select><label className="sr-only" htmlFor="role-filter">Filter by role</label><select id="role-filter" className={selectClass} value={accountRole} onChange={(event) => setAccountRole(event.target.value)}><option>All roles</option><option>HRMO Administrator</option><option>HRMO Staff</option><option>Department Coordinator</option></select>{(accountStatus !== "All statuses" || accountRole !== "All roles") && <button onClick={() => { setAccountStatus("All statuses"); setAccountRole("All roles"); }} className="px-2 text-xs font-semibold text-[#527365] hover:underline">Clear filters</button>}</div>}
                <div className="hrmo-scroll mt-4 overflow-x-auto rounded-2xl border border-[#e0e5dc] bg-[#fbfbf7] shadow-[0_8px_24px_rgba(44,64,53,.035)]">
                  <table className="w-full min-w-[800px] border-collapse text-left">
                    <thead><tr className="border-b border-[#e9ece5] bg-[#f5f6f1] text-[10px] font-bold uppercase tracking-[0.12em] text-[#89958c]"><th className="px-5 py-3.5"><span className="inline-flex items-center gap-1.5">User <ArrowDownUp size={11} /></span></th><th className="px-4 py-3.5">Role</th><th className="px-4 py-3.5">Department</th><th className="px-4 py-3.5">Status</th><th className="px-4 py-3.5 text-right">Actions</th></tr></thead>
                    <tbody>{filteredAccounts.map((account, index) => <tr key={account.id} className="group border-b border-[#edf0e9] last:border-0 transition-colors hover:bg-[#f8f9f5]">
                      <td className="px-5 py-4"><div className="flex items-center gap-3"><div className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold", index % 3 === 0 ? "bg-[#e7ece5] text-[#577163]" : index % 3 === 1 ? "bg-[#f0eadc] text-[#90754a]" : "bg-[#e9ebee] text-[#667380]")}>{account.initials}</div><div><p className="text-[13px] font-semibold text-[#34483f]">{account.name}</p><p className="mt-0.5 text-[11px] text-[#929b93]">{account.email}</p></div></div></td>
                      <td className="px-4 py-4 text-xs text-[#637269]">{account.role}</td><td className="px-4 py-4 text-xs text-[#637269]">{account.department}</td><td className="px-4 py-4"><StatusPill status={account.status} /></td><td className="px-4 py-4"><div className="relative flex items-center justify-end gap-1"><IconButton label={`Send a demo invitation to ${account.name}`} onClick={() => announce(`Demo invitation prepared for ${account.email}.`)}><Mail size={15} /></IconButton><button type="button" aria-label={`More actions for ${account.name}`} aria-haspopup="menu" aria-expanded={accountActionId === account.id} onClick={() => setAccountActionId((current) => current === account.id ? null : account.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#65736f] transition hover:bg-[#edf1eb] hover:text-[#203d37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7146]"><MoreHorizontal size={17} /></button>{accountActionId === account.id && <div role="menu" className="absolute right-0 top-10 z-10 w-40 rounded-xl border border-[#e0e5dc] bg-[#fffefa] p-1.5 shadow-[0_12px_28px_rgba(35,57,47,.14)]"><button role="menuitem" onClick={() => { const nextStatus = account.status === "Suspended" ? "Active" : "Suspended"; setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, status: nextStatus } : item)); setAccountActionId(null); announce(nextStatus === "Active" ? `${account.name} access restored in this demo.` : `${account.name} access suspended in this demo.`); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-[#53675c] hover:bg-[#f1f4ee]">{account.status === "Suspended" ? "Restore access" : "Suspend access"}</button><button role="menuitem" onClick={() => { setAccountActionId(null); announce(`Sample account: ${account.name} · ${account.role} · ${account.department}.`); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-[#53675c] hover:bg-[#f1f4ee]">View account details</button></div>}</div></td>
                    </tr>)}
                    {filteredAccounts.length === 0 && <tr><td colSpan={5} className="px-6 py-14 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eff2ec] text-[#809085]"><UserRound size={18} /></div><p className="mt-3 text-sm font-semibold text-[#52645a]">No accounts found</p><p className="mt-1 text-xs text-[#929c93]">Adjust your search or filters, or add a user.</p><button onClick={openAdd} className="mt-4 text-xs font-semibold text-[#456b59] hover:underline">Add a user</button></td></tr>}</tbody>
                  </table>
                </div>
                <div className="mt-3 flex flex-col justify-between gap-1 text-[10px] text-[#98a198] sm:flex-row"><span>Showing {filteredAccounts.length} of {accounts.length} accounts · Synthetic data</span><span>Created and imported records are held in component state only.</span></div>
              </section>
            )}
            <footer className="mt-10 flex flex-col justify-between gap-2 border-t border-[#e0e5dd] pt-4 text-[10px] text-[#a0a89f] sm:flex-row"><span>Northbridge University · People Operations <span className="text-[#c1a26f]">/</span> HRMO workspace</span><span className="flex items-center gap-1.5"><ShieldCheck size={12} />Demo environment · No connected services</span></footer>
          </div>
        </main>
      </div>

      {toast && <div role="status" aria-live="polite" className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-[#29483f] px-4 py-3 text-xs font-medium text-[#f6f3e8] shadow-[0_10px_30px_rgba(24,54,45,.24)]"><CheckCircle2 size={15} className="text-[#b9d2b7]" />{toast}</div>}

      {dialog && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#1d302b]/45 p-3 backdrop-blur-[3px] sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="my-auto w-full max-w-[540px] overflow-hidden rounded-[22px] border border-[#e6e8df] bg-[#fbfbf7] shadow-[0_26px_80px_rgba(23,43,36,.25)] hrmo-enter">
          <div className="flex items-start justify-between border-b border-[#e9ece5] px-5 py-5 sm:px-7">
            <div><div className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#9b7c4e]">{dialog === "add" ? <><UserRound size={12} />Manual entry</> : dialog === "import" ? <><Upload size={12} />Account import</> : <><CalendarDays size={12} />Renewal detail</>}</div><h2 id="dialog-title" className="font-['DM_Sans'] text-[20px] font-semibold tracking-[-0.04em] text-[#243e36]">{dialog === "add" ? "Add an account" : dialog === "import" ? importStep === "select" ? "Import users" : importStep === "analysis" ? "Review duplicate analysis" : "Import complete" : selectedRenewal?.name}</h2><p className="mt-1 text-xs text-[#89938b]">{dialog === "add" ? "Create a sample account for this session." : dialog === "import" ? importStep === "select" ? "Bring a CSV list into your local demo workspace." : importStep === "analysis" ? "Resolve duplicates before adding eligible rows." : "Records were added to this session only." : "Sample renewal record · No connected services"}</p></div>
            <IconButton label="Close dialog" onClick={closeDialog}><X size={17} /></IconButton>
          </div>

          {dialog === "add" && <form onSubmit={submitNewUser} className="space-y-4 px-5 py-5 sm:px-7 sm:py-6">
            <label className="block text-xs font-semibold text-[#50645a]">Full name<input autoFocus className={inputClass} value={newUser.name} onChange={(event) => setNewUser((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Avery Morgan" /></label>
            <label className="block text-xs font-semibold text-[#50645a]">University email<input className={inputClass} type="email" value={newUser.email} onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))} placeholder="name@northbridge.edu" /></label>
            <div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-semibold text-[#50645a]">Role<select className={inputClass} value={newUser.role} onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value }))}><option>HRMO Staff</option><option>HRMO Administrator</option><option>Department Coordinator</option></select></label><label className="block text-xs font-semibold text-[#50645a]">Department<input className={inputClass} value={newUser.department} onChange={(event) => setNewUser((current) => ({ ...current, department: event.target.value }))} placeholder="e.g. Human Resources" /></label></div>
            {formError && <p role="alert" className="flex items-center gap-2 rounded-xl bg-[#fbefec] px-3 py-2.5 text-xs text-[#a04d40]"><AlertCircle size={14} />{formError}</p>}
            <div className="flex items-center justify-between border-t border-[#e9ece5] pt-4"><span className="text-[10px] text-[#9aa39a]">Changes are not saved beyond this session.</span><div className="flex gap-2"><button type="button" onClick={closeDialog} className="rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#718077] hover:bg-[#f0f2ec]">Cancel</button><button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-[#23463d] px-4 py-2.5 text-xs font-semibold text-[#f6f3e8] transition hover:bg-[#30594d]"><Plus size={14} />Add account</button></div></div>
          </form>}

          {dialog === "import" && <>
            {importStep === "select" && <div className="px-5 py-5 sm:px-7 sm:py-6">
              <div className="rounded-2xl border border-dashed border-[#cbd6cb] bg-[#f5f7f1] px-5 py-6 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e5ede5] text-[#557465]"><FileSpreadsheet size={20} /></div>
                <p className="mt-3 text-sm font-semibold text-[#40584d]">Choose a CSV file</p><p className="mt-1 text-[11px] leading-relaxed text-[#89958c]">The file is read locally in your browser for this demo. Nothing is uploaded.</p>
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,text/csv" onChange={handleFileChange} className="sr-only" aria-label="Select a CSV or Excel file" />
                <button onClick={() => fileInputRef.current?.click()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#23463d] px-4 py-2.5 text-xs font-semibold text-[#f6f3e8] hover:bg-[#30594d]"><Upload size={14} />Browse files</button>
                <p className="mt-2 text-[10px] text-[#a2aaa1]">CSV supported · XLSX parsing not enabled</p>
              </div>
              {importNotice && <div role="status" className="mt-3 rounded-xl border border-[#e8ddc5] bg-[#faf3e4] p-3 text-[11px] leading-relaxed text-[#806a45]">{importNotice}</div>}
              {importFileName && importNotice && <p className="mt-2 text-[10px] text-[#929b92]">Selected file: {importFileName} · Not processed</p>}
              {importError && <p role="alert" className="mt-3 flex items-center gap-2 rounded-xl bg-[#fbefec] px-3 py-2.5 text-xs text-[#a04d40]"><AlertCircle size={14} />{importError}</p>}
              <div className="mt-4 rounded-xl border border-[#e7e8df] bg-[#f8f8f3] p-3.5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-[#4d6157]">Want to see the duplicate check?</p><p className="mt-1 text-[10px] leading-relaxed text-[#919a91]">Run the built-in demo on synthetic rows, including duplicate examples.</p></div><button onClick={runSampleSpreadsheet} className="shrink-0 rounded-lg border border-[#dce4db] bg-[#fffefa] px-3 py-2 text-[10px] font-semibold text-[#557363] hover:bg-[#edf3ec]">Run sample</button></div></div>
              <button onClick={downloadTemplate} className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#567466] hover:text-[#294c3e] hover:underline"><Download size={13} />Download CSV template</button>
              <div className="mt-5 flex justify-end border-t border-[#e9ece5] pt-4"><button onClick={closeDialog} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-[#718077] hover:bg-[#f0f2ec]">Close</button></div>
            </div>}
            {importStep === "analysis" && <div className="px-5 py-5 sm:px-7 sm:py-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e4e8df] bg-[#f5f7f1] px-3.5 py-3"><div className="flex items-center gap-2.5"><FileText size={16} className="text-[#728678]" /><div><p className="text-xs font-semibold text-[#4d6157]">{importFileName}</p><p className="mt-0.5 text-[10px] text-[#929b92]">{importRows.length} rows checked · local analysis</p></div></div><span className="rounded-full bg-[#e5eee5] px-2.5 py-1 text-[10px] font-semibold text-[#477052]">{importRows.filter((row) => !row.issue).length} ready</span></div>
              {importNotice && <div role="status" className="mt-3 rounded-lg bg-[#faf3e4] px-3 py-2 text-[10px] leading-relaxed text-[#806a45]">{importNotice}</div>}
              <div className="mt-3 grid grid-cols-3 gap-2"><div className="rounded-xl bg-[#eaf1e9] px-3 py-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-[#77907d]">Ready</p><p className="mt-1 text-lg font-semibold text-[#3f664e]">{importRows.filter((row) => !row.issue).length}</p></div><div className="rounded-xl bg-[#f8f0df] px-3 py-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-[#9b7c4a]">Already exist</p><p className="mt-1 text-lg font-semibold text-[#8b6a34]">{importRows.filter((row) => row.issue === "existing").length}</p></div><div className="rounded-xl bg-[#f7e9e5] px-3 py-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-[#aa7062]">File duplicates / invalid</p><p className="mt-1 text-lg font-semibold text-[#9c5c4d]">{importRows.filter((row) => row.issue === "file" || row.issue === "invalid").length}</p></div></div>
              <div className="hrmo-scroll mt-4 max-h-[260px] overflow-auto rounded-xl border border-[#e4e8df]">
                <table className="w-full min-w-[510px] text-left"><thead className="sticky top-0 bg-[#f4f6f0]"><tr className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#8b968d]"><th className="px-3 py-2.5"><input aria-label="Select all eligible rows" type="checkbox" checked={importRows.filter((row) => !row.issue).length > 0 && importRows.filter((row) => !row.issue).every((row) => row.selected)} onChange={(event) => selectAllImportRows(event.target.checked)} className="accent-[#315d4d]" /></th><th className="px-2 py-2.5">Name / email</th><th className="px-2 py-2.5">Result</th></tr></thead><tbody>{importRows.map((row, index) => <tr key={`${row.email}-${index}`} className="border-t border-[#edf0e9]"><td className="px-3 py-2.5"><input aria-label={`Select ${row.name || row.email}`} type="checkbox" checked={row.selected} disabled={!!row.issue} onChange={() => toggleImportRow(index)} className="accent-[#315d4d] disabled:opacity-30" /></td><td className="px-2 py-2.5"><p className="text-[11px] font-semibold text-[#4b5e54]">{row.name || "Name missing"}</p><p className="mt-0.5 text-[10px] text-[#97a097]">{row.email || "Email missing"}</p></td><td className="px-2 py-2.5">{row.issue === "existing" ? <span className="text-[10px] font-semibold text-[#94703b]">Account exists</span> : row.issue === "file" ? <span className="text-[10px] font-semibold text-[#a5654e]">Duplicate in file</span> : row.issue === "invalid" ? <span className="text-[10px] font-semibold text-[#a5654e]">Check name or email</span> : <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#558064]"><Check size={12} />Ready to add</span>}</td></tr>)}</tbody></table>
              </div>
              {importError && <p role="alert" className="mt-3 text-xs text-[#a04d40]">{importError}</p>}
              <div className="mt-5 flex items-center justify-between border-t border-[#e9ece5] pt-4"><button onClick={() => { setImportStep("select"); setImportError(""); }} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-[#718077] hover:bg-[#f0f2ec]"><ArrowLeft size={14} />Back</button><button onClick={completeImport} className="inline-flex items-center gap-2 rounded-xl bg-[#23463d] px-4 py-2.5 text-xs font-semibold text-[#f6f3e8] hover:bg-[#30594d]">Add selected accounts<ArrowRight size={14} /></button></div>
              <p className="mt-3 text-center text-[9px] text-[#a0a79f]">No data leaves this browser. Refreshing will discard these changes.</p>
            </div>}
            {importStep === "done" && <div className="px-6 py-10 text-center sm:px-9"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e6f0e8] text-[#4f795d]"><CheckCircle2 size={25} /></div><h3 className="mt-4 font-['DM_Sans'] text-lg font-semibold text-[#304b40]">{importRows.filter((row) => row.selected && !row.issue).length} sample accounts added</h3><p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-[#89948b]">They are now visible in the account directory for this browser session only. Refreshing the page discards all demo changes.</p><button onClick={() => { closeDialog(); setActiveTab("Accounts"); }} className="mt-6 rounded-xl bg-[#23463d] px-5 py-2.5 text-xs font-semibold text-[#f6f3e8] hover:bg-[#30594d]">View account directory</button></div>}
          </>}

          {dialog === "renewal" && selectedRenewal && <div className="px-5 py-5 sm:px-7 sm:py-6">
            <div className="rounded-xl border border-[#e5e9e1] bg-[#f6f7f2] p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-[#3d554a]">{selectedRenewal.title}</p><p className="mt-1 text-xs text-[#8b968d]">{selectedRenewal.department}</p></div><StatusPill status={renewals.find((item) => item.id === selectedRenewal.id)?.status ?? selectedRenewal.status} /></div><div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#e4e8df] pt-4"><div><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#9aa39b]">Contract end</p><p className="mt-1 text-xs font-semibold text-[#55685d]">{selectedRenewal.endDate}</p></div><div><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#9aa39b]">Time remaining</p><p className="mt-1 text-xs font-semibold text-[#55685d]">{selectedRenewal.days} days</p></div></div></div><p className="mt-4 text-xs leading-relaxed text-[#828e85]">This is a sample workflow record. Actions below update only the visible demo state.</p><div className="mt-5 flex justify-between border-t border-[#e9ece5] pt-4"><button onClick={() => handleRenewalAction(selectedRenewal, "remind")} className="inline-flex items-center gap-2 rounded-xl border border-[#dce3da] px-3 py-2.5 text-xs font-semibold text-[#566b60] hover:bg-[#f0f3ee]"><Mail size={14} />Send reminder</button><div className="flex gap-2"><button onClick={closeDialog} className="rounded-xl px-3 py-2.5 text-xs font-semibold text-[#718077] hover:bg-[#f0f2ec]">Close</button>{selectedRenewal.status !== "Completed" && <button onClick={() => { handleRenewalAction(selectedRenewal, "complete"); closeDialog(); }} className="rounded-xl bg-[#23463d] px-4 py-2.5 text-xs font-semibold text-[#f6f3e8] hover:bg-[#30594d]">Mark complete</button>}</div></div>
          </div>}
        </section>
      </div>}
    </div>
  );
}
