import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Download,
  FileSpreadsheet,
  KeyRound,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";

type AccountRole = "Personnel" | "Supervisor" | "HRMO administrator";
type AccountStatus = "Active" | "Invitation pending" | "Suspended";

type Account = {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  office: string;
  role: AccountRole;
  status: AccountStatus;
  lastSignIn: string;
  lastReset?: string;
};

type ImportResult = "new" | "existing" | "review";

type ImportRow = {
  employeeId: string;
  name: string;
  email: string;
  office: string;
  role: AccountRole;
  result: ImportResult;
  reason: string;
};

type Confirmation =
  | { kind: "reset"; account: Account }
  | { kind: "suspend"; account: Account }
  | { kind: "restore"; account: Account }
  | null;

const ROLE_OPTIONS: AccountRole[] = ["Personnel", "Supervisor", "HRMO administrator"];

const STARTER_ACCOUNTS: Account[] = [
  {
    id: "sample-1",
    employeeId: "JO-CLV-041",
    name: "Mara Villanueva",
    email: "mara.villanueva@example.org",
    office: "Student Services",
    role: "Personnel",
    status: "Active",
    lastSignIn: "Today · 9:14 AM",
  },
  {
    id: "sample-2",
    employeeId: "JO-CLV-038",
    name: "Nico Reyes",
    email: "nico.reyes@example.org",
    office: "Campus Operations",
    role: "Supervisor",
    status: "Active",
    lastSignIn: "Yesterday · 3:16 PM",
  },
  {
    id: "sample-3",
    employeeId: "JO-CLV-044",
    name: "Lina Ramos",
    email: "lina.ramos@example.org",
    office: "Library",
    role: "Personnel",
    status: "Invitation pending",
    lastSignIn: "Not signed in",
  },
  {
    id: "sample-4",
    employeeId: "JO-CLV-027",
    name: "Omar Dizon",
    email: "omar.dizon@example.org",
    office: "General Services",
    role: "Personnel",
    status: "Suspended",
    lastSignIn: "12 Oct · 11:08 AM",
  },
  {
    id: "sample-5",
    employeeId: "JO-CLV-019",
    name: "Tessa Flores",
    email: "tessa.flores@example.org",
    office: "Research Office",
    role: "HRMO administrator",
    status: "Active",
    lastSignIn: "Today · 8:42 AM",
    lastReset: "04 Oct 2026",
  },
];

const SAMPLE_IMPORT = [
  "Employee ID,Full Name,Login Email,Office,Role",
  "JO-CLV-041,Mara Villanueva,mara.villanueva@example.org,Student Services,Personnel",
  "JO-CLV-055,Aria Navarro,aria.navarro@example.org,Student Affairs,Personnel",
  "JO-CLV-056,Devon Reyes,,Campus Operations,Personnel",
].join("\r\n");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeId(value: string) {
  return value.trim().toLocaleUpperCase();
}

function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase();
}

function parseCsvRecords(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(value.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  row.push(value.trim());
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}

function statusClass(status: AccountStatus) {
  if (status === "Active") return "ua-status ua-status-active";
  if (status === "Invitation pending") return "ua-status ua-status-pending";
  return "ua-status ua-status-suspended";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
  return `${visible}${"•".repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

function saveCsvTemplate() {
  const content = "Employee ID,Full Name,Email,Office,Role\r\n";
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ustp-personnel-account-template.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function UserAccounts() {
  const [accounts, setAccounts] = useState(STARTER_ACCOUNTS);
  const [searchText, setSearchText] = useState("");
  const [roleFilter, setRoleFilter] = useState("All roles");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createForm, setCreateForm] = useState({
    employeeId: "",
    name: "",
    email: "",
    office: "",
    role: "Personnel" as AccountRole,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roleDraft, setRoleDraft] = useState<AccountRole>("Personnel");
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importStage, setImportStage] = useState<"upload" | "review" | "complete">("upload");
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importName, setImportName] = useState("");
  const [importError, setImportError] = useState("");
  const [importingFile, setImportingFile] = useState(false);
  const [notice, setNotice] = useState("");

  const selectedAccount = accounts.find((account) => account.id === selectedId);
  const filteredAccounts = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase();
    return accounts.filter((account) => {
      const matchesQuery =
        !query ||
        [account.name, account.employeeId, account.email, account.office]
          .some((value) => value.toLocaleLowerCase().includes(query));
      const matchesRole = roleFilter === "All roles" || account.role === roleFilter;
      const matchesStatus = statusFilter === "All statuses" || account.status === statusFilter;
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [accounts, roleFilter, searchText, statusFilter]);

  const pendingCount = accounts.filter((account) => account.status === "Invitation pending").length;
  const suspendedCount = accounts.filter((account) => account.status === "Suspended").length;
  const newCount = importRows.filter((row) => row.result === "new").length;
  const existingCount = importRows.filter((row) => row.result === "existing").length;
  const reviewCount = importRows.filter((row) => row.result === "review").length;

  const announce = (message: string) => setNotice(message);

  const resetImport = () => {
    setImportOpen(false);
    setImportStage("upload");
    setImportRows([]);
    setImportName("");
    setImportError("");
    setImportingFile(false);
  };

  const analyzeCsv = (source: string, fileName: string) => {
    const records = parseCsvRecords(source.replace(/^\uFEFF/, ""));
    if (records.length < 2) {
      setImportError("This file has a header but no personnel rows to review.");
      setImportRows([]);
      setImportStage("upload");
      return;
    }

    const headers = records[0].map((header) => header.toLocaleLowerCase().replace(/[^a-z0-9]/g, ""));
    const findHeader = (pattern: RegExp) => headers.findIndex((header) => pattern.test(header));
    const employeeIdIndex = findHeader(/^(employeeid|employeeno|staffid|personnelid|idnumber|joid)$/);
    const fullNameIndex = findHeader(/^(fullname|personnelname|employeename|name)$/);
    const firstNameIndex = findHeader(/^(firstname|givenname)$/);
    const lastNameIndex = findHeader(/^(lastname|surname|familyname)$/);
    const emailIndex = findHeader(/(email|username|loginid)/);
    const officeIndex = findHeader(/(office|unit|department)/);
    const roleIndex = findHeader(/(role|accesslevel|accounttype)/);

    const nameColumnsPresent =
      fullNameIndex >= 0 || (firstNameIndex >= 0 && lastNameIndex >= 0);
    if (employeeIdIndex < 0 || !nameColumnsPresent || emailIndex < 0) {
      setImportError(
        "We could not match the required columns. Include Employee ID, Full Name (or First Name and Last Name), and Email. Download the blank template to get started.",
      );
      setImportRows([]);
      setImportStage("upload");
      return;
    }

    const knownIds = new Set(accounts.map((account) => normalizeId(account.employeeId)));
    const knownEmails = new Set(accounts.map((account) => normalizeEmail(account.email)));
    const batchIds = new Set<string>();
    const batchEmails = new Set<string>();
    const preview: ImportRow[] = records.slice(1).map((cells) => {
      const employeeId = (cells[employeeIdIndex] ?? "").trim();
      const name =
        fullNameIndex >= 0
          ? (cells[fullNameIndex] ?? "").trim()
          : `${cells[firstNameIndex] ?? ""} ${cells[lastNameIndex] ?? ""}`.trim();
      const email = normalizeEmail(cells[emailIndex] ?? "");
      const office = officeIndex >= 0 ? (cells[officeIndex] ?? "").trim() : "Unassigned";
      const roleValue = roleIndex >= 0 ? (cells[roleIndex] ?? "").trim().toLocaleLowerCase() : "";
      const role: AccountRole = roleValue.includes("supervisor") ? "Supervisor" : "Personnel";
      const idKey = normalizeId(employeeId);
      const invalid = !employeeId || !name || !EMAIL_PATTERN.test(email);

      if (invalid) {
        return {
          employeeId: employeeId || "—",
          name: name || "Name missing",
          email: email || "—",
          office: office || "Unassigned",
          role,
          result: "review",
          reason: !employeeId ? "Employee ID required" : !name ? "Name required" : "Valid email required",
        };
      }

      if (knownIds.has(idKey) || knownEmails.has(email)) {
        return {
          employeeId,
          name,
          email,
          office: office || "Unassigned",
          role,
          result: "existing",
          reason: "Already in the directory",
        };
      }

      if (batchIds.has(idKey) || batchEmails.has(email)) {
        return {
          employeeId,
          name,
          email,
          office: office || "Unassigned",
          role,
          result: "existing",
          reason: "Repeated in this file",
        };
      }

      batchIds.add(idKey);
      batchEmails.add(email);
      return {
        employeeId,
        name,
        email,
        office: office || "Unassigned",
        role,
        result: "new",
        reason: "Ready to add",
      };
    });

    setImportName(fileName);
    setImportRows(preview);
    setImportError("");
    setImportStage("review");
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setImportName(file.name);
    setImportError("");
    setImportRows([]);
    const extension = file.name.toLocaleLowerCase().split(".").pop();

    if (extension !== "csv") {
      setImportError(
        "Excel workbook parsing is not connected in this visual preview. Choose a CSV to run a real, local duplicate check. A production XLSX importer should validate the workbook before creating accounts.",
      );
      return;
    }

    setImportingFile(true);
    try {
      const contents = await file.text();
      analyzeCsv(contents, file.name);
    } catch {
      setImportError("We could not read that file. Check that it is a UTF-8 CSV and try again.");
    } finally {
      setImportingFile(false);
    }
  };

  const useSampleImport = () => analyzeCsv(SAMPLE_IMPORT, "sample-personnel-roster.csv");

  const handleCreateAccount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError("");
    const employeeId = createForm.employeeId.trim();
    const email = normalizeEmail(createForm.email);
    const name = createForm.name.trim();

    if (
      accounts.some(
        (account) =>
          normalizeId(account.employeeId) === normalizeId(employeeId) ||
          normalizeEmail(account.email) === email,
      )
    ) {
      setCreateError("That employee ID or login email is already in the directory.");
      return;
    }

    setAccounts((current) => [
      {
        id: `local-${Date.now()}`,
        employeeId,
        name,
        email,
        office: createForm.office.trim() || "Unassigned",
        role: createForm.role,
        status: "Invitation pending",
        lastSignIn: "Not signed in",
      },
      ...current,
    ]);
    setCreateOpen(false);
    setCreateForm({ employeeId: "", name: "", email: "", office: "", role: "Personnel" });
    announce("Account added to this preview. No invitation email was sent.");
  };

  const openAccount = (account: Account) => {
    setSelectedId(account.id);
    setRoleDraft(account.role);
  };

  const saveRole = () => {
    if (!selectedAccount) return;
    setAccounts((current) =>
      current.map((account) =>
        account.id === selectedAccount.id ? { ...account, role: roleDraft } : account,
      ),
    );
    setSelectedId(null);
    announce("Role updated in this preview. No identity provider was changed.");
  };

  const confirmAction = () => {
    if (!confirmation) return;
    const { account } = confirmation;

    if (confirmation.kind === "reset") {
      setAccounts((current) =>
        current.map((item) =>
          item.id === account.id ? { ...item, lastReset: "Just now" } : item,
        ),
      );
      announce(`Reset link prepared for ${maskEmail(account.email)}. No email was sent in this preview.`);
    } else if (confirmation.kind === "suspend") {
      setAccounts((current) =>
        current.map((item) =>
          item.id === account.id ? { ...item, status: "Suspended" } : item,
        ),
      );
      announce("Account access paused in this preview. No identity provider was changed.");
    } else {
      setAccounts((current) =>
        current.map((item) =>
          item.id === account.id ? { ...item, status: "Active" } : item,
        ),
      );
      announce("Account access restored in this preview. No identity provider was changed.");
    }

    setConfirmation(null);
  };

  const importNewAccounts = () => {
    const eligible = importRows.filter((row) => row.result === "new");
    if (eligible.length === 0) return;

    const additions: Account[] = eligible.map((row, index) => ({
      id: `import-${Date.now()}-${index}`,
      employeeId: row.employeeId,
      name: row.name,
      email: row.email,
      office: row.office,
      role: row.role,
      status: "Invitation pending",
      lastSignIn: "Not signed in",
    }));
    setAccounts((current) => [...additions, ...current]);
    setImportStage("complete");
    announce(
      `${additions.length} new ${additions.length === 1 ? "account" : "accounts"} added to this preview. Existing and incomplete rows were skipped.`,
    );
  };

  return (
    <div className="ua-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');
        .ua-page {
          --ua-paper: #f3f2e9;
          --ua-paper-deep: #e9eadd;
          --ua-surface: #fffef8;
          --ua-ink: #203638;
          --ua-muted: #6d7d78;
          --ua-line: #d9dfd5;
          --ua-teal: #275d5a;
          --ua-teal-deep: #173f43;
          --ua-teal-pale: #e8f0e9;
          --ua-clay: #a8583e;
          --ua-amber: #a46e2e;
          --ua-font: 'DM Sans', sans-serif;
          --ua-display: 'Instrument Serif', Georgia, serif;
          --ua-mono: 'DM Mono', monospace;
          min-height: 100dvh;
          background:
            radial-gradient(ellipse at 89% 4%, rgba(203, 174, 117, .12), transparent 34rem),
            var(--ua-paper);
          color: var(--ua-ink);
          font-family: var(--ua-font);
          padding-bottom: 48px;
          position: relative;
          overflow: hidden;
        }
        .ua-page, .ua-page * { box-sizing: border-box; }
        .ua-topbar {
          height: 68px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 0 clamp(18px, 4vw, 64px);
          color: #f6f4e9;
          background: var(--ua-teal-deep);
          border-bottom: 3px solid #caa56b;
        }
        .ua-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .ua-brand-mark {
          display: grid; place-items: center; width: 34px; height: 34px;
          border: 1px solid rgba(239, 230, 198, .52); border-radius: 50%;
          color: #ead7ad; font-family: var(--ua-display); font-size: 19px;
        }
        .ua-brand-title { font-size: 12px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; }
        .ua-brand-subtitle { margin-top: 2px; color: #b8c8bc; font-size: 11px; letter-spacing: .025em; }
        .ua-top-meta { display: flex; align-items: center; gap: 14px; }
        .ua-preview-badge {
          padding: 6px 9px; border: 1px solid rgba(234, 215, 173, .35);
          border-radius: 3px; color: #e5d4ac; font: 10px var(--ua-mono); letter-spacing: .05em;
        }
        .ua-admin-chip { display: flex; align-items: center; gap: 9px; color: #d6e0d8; font-size: 12px; }
        .ua-admin-avatar {
          width: 30px; height: 30px; display: grid; place-items: center;
          color: var(--ua-teal-deep); border-radius: 50%; background: #e5d2aa;
          font-size: 11px; font-weight: 700;
        }
        .ua-main { width: min(1320px, 100%); margin: 0 auto; padding: 30px clamp(18px, 4vw, 56px) 0; }
        .ua-breadcrumb {
          display: flex; align-items: center; gap: 9px; margin-bottom: 23px;
          color: var(--ua-muted); font-size: 11px; letter-spacing: .035em;
        }
        .ua-breadcrumb .ua-slash { color: #aab5a8; }
        .ua-breadcrumb strong { color: var(--ua-teal); font-weight: 700; }
        .ua-heading-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; }
        .ua-eyebrow {
          margin: 0 0 8px; color: var(--ua-clay); font: 10px var(--ua-mono);
          letter-spacing: .17em; text-transform: uppercase;
        }
        .ua-title {
          margin: 0; color: var(--ua-teal-deep); font: 400 clamp(36px, 4vw, 51px)/.98 var(--ua-display);
          letter-spacing: -.015em;
        }
        .ua-intro { max-width: 510px; margin: 11px 0 0; color: #687873; font-size: 13px; line-height: 1.65; }
        .ua-heading-actions { display: flex; align-items: center; gap: 9px; padding-bottom: 2px; }
        .ua-button {
          min-height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          border: 1px solid transparent; border-radius: 4px; padding: 0 15px;
          font: 600 12px var(--ua-font); cursor: pointer;
          transition: transform .16s ease, background-color .16s ease, border-color .16s ease, color .16s ease;
        }
        .ua-button:hover { transform: translateY(-1px); }
        .ua-button:focus-visible, .ua-icon-button:focus-visible, .ua-page input:focus-visible, .ua-page select:focus-visible {
          outline: 3px solid rgba(191, 145, 79, .44); outline-offset: 2px;
        }
        .ua-button-primary { color: #fffdf4; background: var(--ua-teal); border-color: var(--ua-teal); }
        .ua-button-primary:hover { background: #1e4b4a; }
        .ua-button-secondary { color: var(--ua-teal-deep); background: rgba(255, 254, 248, .76); border-color: #cbd5cd; }
        .ua-button-secondary:hover { border-color: var(--ua-teal); background: var(--ua-surface); }
        .ua-button-quiet { color: #667873; background: transparent; border-color: transparent; }
        .ua-button-quiet:hover { color: var(--ua-teal); background: var(--ua-teal-pale); }
        .ua-button-danger { color: #fffaf4; background: var(--ua-clay); border-color: var(--ua-clay); }
        .ua-button-danger:hover { background: #904632; }
        .ua-button:disabled { opacity: .48; cursor: not-allowed; transform: none; }
        .ua-overview {
          display: grid; grid-template-columns: minmax(0, 1fr) 286px; gap: 15px;
          margin-top: 27px;
        }
        .ua-stat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 11px; }
        .ua-stat {
          min-height: 116px; padding: 16px 17px; position: relative; overflow: hidden;
          background: rgba(255, 254, 248, .84); border: 1px solid var(--ua-line); border-radius: 5px;
        }
        .ua-stat::after {
          content: ""; position: absolute; width: 90px; height: 90px; right: -40px; bottom: -50px;
          border: 1px solid rgba(39, 93, 90, .11); border-radius: 50%;
          box-shadow: 0 0 0 12px rgba(39, 93, 90, .025), 0 0 0 24px rgba(39, 93, 90, .02);
        }
        .ua-stat-label { color: #74827b; font-size: 10px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; }
        .ua-stat-line { display: flex; align-items: baseline; gap: 9px; margin-top: 9px; }
        .ua-stat-value { color: var(--ua-teal-deep); font: 400 34px/.9 var(--ua-display); }
        .ua-stat-note { color: #74827b; font-size: 11px; }
        .ua-stat-accent { width: 22px; height: 2px; margin-top: 12px; background: var(--ua-teal); }
        .ua-stat.pending .ua-stat-accent { background: #bf9355; }
        .ua-stat.suspended .ua-stat-accent { background: #ae6b54; }
        .ua-security-card {
          min-height: 116px; padding: 15px 17px; display: flex; gap: 12px;
          border-radius: 5px; border: 1px solid #d9c7a4;
          background: linear-gradient(115deg, #f4ecda, #f7f3e7);
        }
        .ua-security-icon {
          flex: 0 0 auto; width: 34px; height: 34px; display: grid; place-items: center;
          color: #8a6232; border: 1px solid #d6c09a; border-radius: 50%; background: rgba(255,255,255,.36);
        }
        .ua-security-title { margin: 1px 0 5px; color: #554a35; font-size: 12px; font-weight: 700; }
        .ua-security-copy { margin: 0; color: #72674f; font-size: 11px; line-height: 1.55; }
        .ua-directory {
          margin-top: 24px; border: 1px solid var(--ua-line); border-radius: 6px;
          background: rgba(255, 254, 248, .93); overflow: hidden;
          box-shadow: 0 12px 30px rgba(36, 66, 61, .035);
        }
        .ua-directory-head {
          min-height: 70px; display: flex; justify-content: space-between; align-items: center;
          gap: 16px; padding: 15px 19px; border-bottom: 1px solid var(--ua-line);
        }
        .ua-section-title { margin: 0; color: var(--ua-teal-deep); font: 400 23px/1.1 var(--ua-display); }
        .ua-section-note { margin: 5px 0 0; color: var(--ua-muted); font-size: 11px; }
        .ua-count-pill {
          display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; padding: 4px 8px;
          border-radius: 99px; color: #52655f; background: #edf1e8; font: 10px var(--ua-mono);
          vertical-align: 3px;
        }
        .ua-directory-tools {
          min-height: 59px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
          padding: 10px 18px; background: #faf9f2; border-bottom: 1px solid var(--ua-line);
        }
        .ua-search-wrap { min-width: min(300px, 100%); flex: 1; position: relative; }
        .ua-search-icon { position: absolute; top: 50%; left: 11px; color: #809089; transform: translateY(-50%); pointer-events: none; }
        .ua-search-input, .ua-select, .ua-field input, .ua-field select {
          width: 100%; min-height: 37px; border: 1px solid #d6ddd5; border-radius: 4px;
          color: var(--ua-ink); background: #fffef9; font: 12px var(--ua-font);
        }
        .ua-search-input { padding: 0 12px 0 34px; }
        .ua-search-input::placeholder { color: #98a39b; }
        .ua-select { width: auto; min-width: 132px; padding: 0 30px 0 11px; }
        .ua-directory-tools .ua-select { appearance: none; }
        .ua-select-wrap { position: relative; }
        .ua-select-wrap > svg { position: absolute; top: 50%; right: 10px; color: #75847d; transform: translateY(-50%); pointer-events: none; }
        .ua-results-label { margin-left: auto; color: #7c8a82; font: 10px var(--ua-mono); white-space: nowrap; }
        .ua-table-wrap { width: 100%; overflow-x: auto; }
        .ua-table { width: 100%; border-collapse: collapse; text-align: left; }
        .ua-table thead { background: #f6f6ef; }
        .ua-table th {
          height: 39px; padding: 0 13px; color: #75827b; font: 10px var(--ua-mono);
          letter-spacing: .055em; text-transform: uppercase; white-space: nowrap;
        }
        .ua-table td { padding: 11px 13px; border-top: 1px solid #e7e9e0; vertical-align: middle; }
        .ua-table tr:hover td { background: #fbfbf5; }
        .ua-person { display: flex; align-items: center; gap: 10px; min-width: 180px; }
        .ua-person-avatar {
          flex: 0 0 auto; width: 34px; height: 34px; display: grid; place-items: center;
          border-radius: 50%; color: #315954; background: #e5ede5; font: 600 10px var(--ua-mono);
        }
        .ua-person-name { display: block; color: #294142; font-size: 12px; font-weight: 700; }
        .ua-person-id { display: block; margin-top: 3px; color: #829087; font: 10px var(--ua-mono); }
        .ua-email { color: #465d58; font-size: 11px; white-space: nowrap; }
        .ua-office { margin-top: 3px; color: #89958d; font-size: 10px; }
        .ua-role { display: inline-flex; padding: 5px 8px; border: 1px solid #dce2d8; border-radius: 3px; color: #5b6c64; background: #f4f6ef; font-size: 10px; white-space: nowrap; }
        .ua-last-seen { color: #64746d; font-size: 10px; white-space: nowrap; }
        .ua-status {
          display: inline-flex; align-items: center; gap: 6px; padding: 5px 8px;
          border: 1px solid transparent; border-radius: 99px; font-size: 10px; white-space: nowrap;
        }
        .ua-status::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .ua-status-active { color: #37685a; border-color: #d4e5d9; background: #edf5ee; }
        .ua-status-pending { color: #91682f; border-color: #e8d9b9; background: #fbf4e6; }
        .ua-status-suspended { color: #975d4b; border-color: #ead6cc; background: #fbefeb; }
        .ua-row-actions { display: flex; align-items: center; justify-content: flex-end; gap: 5px; white-space: nowrap; }
        .ua-row-action {
          min-height: 30px; display: inline-flex; align-items: center; gap: 5px; padding: 0 8px;
          border: 1px solid transparent; border-radius: 3px; color: #55706a; background: transparent;
          font: 600 10px var(--ua-font); cursor: pointer;
          transition: background-color .16s ease, color .16s ease, border-color .16s ease;
        }
        .ua-row-action:hover { color: var(--ua-teal-deep); border-color: #d6e1d8; background: #eef3ec; }
        .ua-row-action:disabled { opacity: .4; cursor: not-allowed; }
        .ua-empty {
          padding: 48px 20px 52px; display: grid; justify-items: center; text-align: center;
          color: #72817a;
        }
        .ua-empty-icon {
          width: 46px; height: 46px; display: grid; place-items: center; margin-bottom: 12px;
          border-radius: 50%; color: #52736b; background: #edf2e9;
        }
        .ua-empty strong { color: #38524e; font: 400 22px var(--ua-display); }
        .ua-empty p { max-width: 350px; margin: 6px 0 0; font-size: 12px; line-height: 1.55; }
        .ua-directory-foot {
          min-height: 42px; display: flex; justify-content: space-between; align-items: center; gap: 12px;
          padding: 0 17px; border-top: 1px solid #e6e9e0; color: #849189; font: 10px var(--ua-mono);
        }
        .ua-mobile-list { display: none; }
        .ua-footer-note {
          display: flex; align-items: flex-start; gap: 9px; margin: 16px 2px 0;
          color: #78877e; font-size: 10px; line-height: 1.55;
        }
        .ua-footer-note svg { flex: 0 0 auto; margin-top: 1px; color: #a27a45; }
        .ua-overlay {
          position: fixed; inset: 0; z-index: 80; display: flex; justify-content: center; align-items: center;
          padding: 20px; background: rgba(19, 43, 43, .55); backdrop-filter: blur(3px);
        }
        .ua-modal {
          width: min(100%, 590px); max-height: min(92dvh, 880px); overflow: auto;
          border: 1px solid #d7ded4; border-radius: 7px; background: var(--ua-surface);
          box-shadow: 0 28px 90px rgba(10, 37, 36, .24);
        }
        .ua-modal-wide { width: min(100%, 850px); }
        .ua-modal-head {
          display: flex; align-items: flex-start; justify-content: space-between; gap: 18px;
          padding: 19px 22px 16px; border-bottom: 1px solid #e4e8df;
        }
        .ua-modal-kicker { margin: 0 0 5px; color: var(--ua-clay); font: 10px var(--ua-mono); letter-spacing: .12em; text-transform: uppercase; }
        .ua-modal-title { margin: 0; color: var(--ua-teal-deep); font: 400 28px/1 var(--ua-display); }
        .ua-modal-copy { margin: 7px 0 0; color: #76847d; font-size: 11px; line-height: 1.55; }
        .ua-icon-button {
          flex: 0 0 auto; width: 32px; height: 32px; display: grid; place-items: center;
          border: 1px solid #dce2d9; border-radius: 50%; color: #63756d; background: transparent; cursor: pointer;
          transition: background-color .16s ease, color .16s ease;
        }
        .ua-icon-button:hover { color: var(--ua-teal-deep); background: #edf2e9; }
        .ua-modal-body { padding: 19px 22px 22px; }
        .ua-modal-foot {
          display: flex; justify-content: space-between; align-items: center; gap: 12px;
          padding: 14px 22px; border-top: 1px solid #e4e8df; background: #faf9f3;
        }
        .ua-modal-foot-right { display: flex; justify-content: flex-end; gap: 8px; margin-left: auto; }
        .ua-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 13px; }
        .ua-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .ua-field-wide { grid-column: 1 / -1; }
        .ua-field label { color: #556a63; font-size: 10px; font-weight: 700; letter-spacing: .045em; }
        .ua-field input, .ua-field select { padding: 0 11px; }
        .ua-field input::placeholder { color: #a0aaa1; }
        .ua-field-hint { color: #89958d; font-size: 10px; line-height: 1.45; }
        .ua-security-inline {
          display: flex; align-items: flex-start; gap: 10px; padding: 12px;
          color: #6f634a; border: 1px solid #e4d9c2; border-radius: 4px; background: #f8f3e8;
          font-size: 10px; line-height: 1.55;
        }
        .ua-security-inline svg { flex: 0 0 auto; color: #a27a45; }
        .ua-form-error {
          margin: 14px 0 0; padding: 10px 11px; color: #914d3c; border: 1px solid #ead0c4;
          border-radius: 3px; background: #fcf0e9; font-size: 11px; line-height: 1.45;
        }
        .ua-import-steps { display: flex; align-items: center; gap: 7px; padding: 14px 22px 0; }
        .ua-step {
          display: flex; align-items: center; gap: 7px; color: #8a9690; font: 10px var(--ua-mono);
          text-transform: uppercase; letter-spacing: .06em;
        }
        .ua-step-dot {
          width: 22px; height: 22px; display: grid; place-items: center;
          border: 1px solid #d5ded4; border-radius: 50%; color: #73827a; background: #fafaf5; font-size: 9px;
        }
        .ua-step.active { color: var(--ua-teal); }
        .ua-step.active .ua-step-dot { color: #fff; border-color: var(--ua-teal); background: var(--ua-teal); }
        .ua-step.done .ua-step-dot { color: #fff; border-color: #678678; background: #678678; }
        .ua-step-rule { flex: 0 1 58px; height: 1px; background: #dfe4dc; }
        .ua-upload-zone {
          min-height: 178px; display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 19px; border: 1px dashed #b9c8bd; border-radius: 5px; background: #f7f8f0;
          text-align: center;
        }
        .ua-upload-icon {
          width: 42px; height: 42px; display: grid; place-items: center; margin-bottom: 10px;
          color: #3f6d62; border: 1px solid #cbd9cb; border-radius: 50%; background: #edf3e9;
        }
        .ua-upload-title { margin: 0; color: #38524d; font-size: 13px; font-weight: 700; }
        .ua-upload-copy { margin: 5px 0 12px; color: #819087; font-size: 10px; }
        .ua-file-input {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
        }
        .ua-upload-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 7px; }
        .ua-template-row {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          margin-top: 13px; padding: 10px 0; color: #7a8980; font-size: 10px;
        }
        .ua-template-row button {
          display: inline-flex; align-items: center; gap: 6px; padding: 4px 0; border: 0;
          color: var(--ua-teal); background: transparent; font: 600 10px var(--ua-font); cursor: pointer;
        }
        .ua-template-row button:hover { color: #183f40; text-decoration: underline; }
        .ua-import-warning {
          display: flex; align-items: flex-start; gap: 9px; margin-top: 12px; padding: 11px 12px;
          color: #79592f; border: 1px solid #ebd8b3; border-radius: 4px; background: #fbf5e8;
          font-size: 10px; line-height: 1.55;
        }
        .ua-import-warning svg { flex: 0 0 auto; margin-top: 1px; }
        .ua-import-error {
          margin-top: 12px; padding: 11px 12px; color: #914d3c; border: 1px solid #ead0c4;
          border-radius: 4px; background: #fcf0e9; font-size: 10px; line-height: 1.55;
        }
        .ua-import-file {
          display: flex; align-items: center; gap: 9px; margin-bottom: 11px; padding: 10px 12px;
          border: 1px solid #dce5d9; border-radius: 4px; background: #f6f7ef; color: #526b61;
          font-size: 11px; font-weight: 600;
        }
        .ua-import-file svg { color: #4f7664; }
        .ua-review-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 13px; }
        .ua-review-count { padding: 10px 11px; border: 1px solid #dfe5dc; border-radius: 4px; background: #fafaf5; }
        .ua-review-count strong { display: block; color: var(--ua-teal-deep); font: 400 24px/1 var(--ua-display); }
        .ua-review-count span { display: block; margin-top: 4px; color: #78877e; font-size: 9px; font-weight: 700; letter-spacing: .065em; text-transform: uppercase; }
        .ua-review-count.is-new { background: #eff5ed; border-color: #d5e4d5; }
        .ua-review-count.is-skip { background: #f8f3e7; border-color: #e9dec5; }
        .ua-review-count.is-attention { background: #fbf0eb; border-color: #ead8ce; }
        .ua-import-table-wrap { overflow: auto; max-height: 280px; border: 1px solid #e1e5dd; border-radius: 4px; }
        .ua-import-table { width: 100%; border-collapse: collapse; text-align: left; }
        .ua-import-table th { position: sticky; top: 0; z-index: 1; padding: 9px 10px; color: #76837d; background: #f4f5ee; font: 9px var(--ua-mono); text-transform: uppercase; }
        .ua-import-table td { padding: 9px 10px; border-top: 1px solid #e9ebe4; color: #52645c; font-size: 10px; }
        .ua-import-table td:nth-child(2) { color: #7c8982; font-family: var(--ua-mono); font-size: 9px; }
        .ua-import-table td:nth-child(3) { word-break: break-word; }
        .ua-import-table td:last-child { white-space: nowrap; }
        .ua-row-result { display: inline-flex; align-items: center; gap: 5px; font-size: 9px; font-weight: 700; }
        .ua-row-result.new { color: #397057; }
        .ua-row-result.existing { color: #8b6c36; }
        .ua-row-result.review { color: #985943; }
        .ua-import-commit-note { margin: 11px 0 0; color: #718079; font-size: 10px; line-height: 1.55; }
        .ua-import-complete { padding: 23px 10px 25px; text-align: center; }
        .ua-complete-mark {
          width: 50px; height: 50px; display: grid; place-items: center; margin: 0 auto 12px;
          border: 1px solid #c9dfcd; border-radius: 50%; color: #37745e; background: #edf6ec;
        }
        .ua-import-complete h3 { margin: 0; color: var(--ua-teal-deep); font: 400 29px/1 var(--ua-display); }
        .ua-import-complete p { max-width: 410px; margin: 8px auto 0; color: #77857c; font-size: 11px; line-height: 1.55; }
        .ua-profile-top { display: flex; align-items: center; gap: 13px; padding-bottom: 16px; border-bottom: 1px solid #e7eae2; }
        .ua-profile-avatar {
          width: 46px; height: 46px; display: grid; place-items: center; border-radius: 50%;
          color: #315954; background: #e5ede5; font: 500 14px var(--ua-mono);
        }
        .ua-profile-name { margin: 0; color: var(--ua-teal-deep); font: 400 25px/1 var(--ua-display); }
        .ua-profile-id { margin: 5px 0 0; color: #809087; font: 10px var(--ua-mono); }
        .ua-profile-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 13px; padding: 16px 0; }
        .ua-profile-field span { display: block; color: #86928a; font: 9px var(--ua-mono); text-transform: uppercase; letter-spacing: .06em; }
        .ua-profile-field strong { display: block; margin-top: 5px; color: #425b54; font-size: 11px; font-weight: 600; overflow-wrap: anywhere; }
        .ua-profile-actions { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 14px; border-top: 1px solid #e7eae2; }
        .ua-toast {
          position: fixed; right: 23px; bottom: 22px; z-index: 100; max-width: min(460px, calc(100vw - 36px));
          display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px;
          color: #f5f3e8; border: 1px solid #416a62; border-radius: 5px; background: #1d4949;
          box-shadow: 0 12px 32px rgba(20, 53, 49, .2); font-size: 11px; line-height: 1.5;
        }
        .ua-toast svg { flex: 0 0 auto; margin-top: 1px; color: #c7d9ba; }
        .ua-toast button { border: 0; color: #d2dfd3; background: transparent; font: 600 10px var(--ua-font); cursor: pointer; }
        @media (max-width: 900px) {
          .ua-main { padding-left: 23px; padding-right: 23px; }
          .ua-overview { grid-template-columns: 1fr; }
          .ua-security-card { min-height: auto; }
          .ua-table th, .ua-table td { padding-left: 10px; padding-right: 10px; }
          .ua-table th:nth-child(4), .ua-table td:nth-child(4) { display: none; }
        }
        @media (max-width: 650px) {
          .ua-topbar { height: 60px; padding: 0 16px; }
          .ua-preview-badge { display: none; }
          .ua-brand-subtitle { font-size: 10px; }
          .ua-main { padding: 22px 15px 0; }
          .ua-breadcrumb { margin-bottom: 18px; }
          .ua-heading-row { display: block; }
          .ua-title { font-size: 43px; }
          .ua-intro { margin-top: 8px; font-size: 12px; }
          .ua-heading-actions { margin-top: 17px; }
          .ua-heading-actions .ua-button { flex: 1; padding: 0 10px; }
          .ua-overview { margin-top: 19px; gap: 10px; }
          .ua-stat-grid { gap: 7px; }
          .ua-stat { min-height: 98px; padding: 12px 11px; }
          .ua-stat-label { font-size: 8px; letter-spacing: .045em; }
          .ua-stat-value { font-size: 30px; }
          .ua-stat-note { font-size: 9px; }
          .ua-security-card { padding: 12px; }
          .ua-directory { margin-top: 17px; }
          .ua-directory-head { align-items: flex-start; padding: 14px 13px; }
          .ua-section-title { font-size: 21px; }
          .ua-count-pill { margin-left: 4px; padding: 3px 6px; font-size: 9px; }
          .ua-directory-tools { padding: 10px 12px; gap: 7px; }
          .ua-search-wrap { min-width: 100%; }
          .ua-search-input { min-height: 39px; }
          .ua-select { flex: 1; min-width: 0; }
          .ua-results-label { margin-left: auto; }
          .ua-table-wrap { display: none; }
          .ua-mobile-list { display: grid; gap: 0; }
          .ua-mobile-account { padding: 13px 13px 12px; border-top: 1px solid #e7e9e0; }
          .ua-mobile-account-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
          .ua-mobile-account .ua-person { min-width: 0; }
          .ua-mobile-account .ua-person-name { font-size: 11px; }
          .ua-mobile-account .ua-person-avatar { width: 31px; height: 31px; }
          .ua-mobile-detail { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 10px 0 10px 41px; }
          .ua-mobile-detail span { color: #74837a; font-size: 10px; }
          .ua-mobile-actions { display: flex; justify-content: flex-end; border-top: 1px solid #eef0e9; padding-top: 7px; }
          .ua-directory-foot { padding: 0 12px; font-size: 9px; }
          .ua-footer-note { margin-top: 13px; font-size: 9px; }
          .ua-overlay { align-items: flex-end; padding: 8px; }
          .ua-modal { max-height: 94dvh; border-radius: 9px 9px 5px 5px; }
          .ua-modal-head { padding: 16px 16px 13px; }
          .ua-modal-body { padding: 16px; }
          .ua-modal-foot { padding: 12px 16px; }
          .ua-import-steps { padding: 12px 16px 0; }
          .ua-step { gap: 5px; font-size: 8px; }
          .ua-step-rule { flex-basis: 20px; }
          .ua-review-summary { gap: 5px; }
          .ua-review-count { padding: 8px; }
          .ua-review-count strong { font-size: 21px; }
          .ua-review-count span { font-size: 8px; }
          .ua-import-table th, .ua-import-table td { padding: 8px 7px; }
          .ua-import-table th:nth-child(2), .ua-import-table td:nth-child(2) { display: none; }
          .ua-form-grid { grid-template-columns: 1fr; gap: 12px; }
          .ua-field-wide { grid-column: auto; }
          .ua-toast { right: 10px; bottom: 10px; }
        }
      `}</style>

      <header className="ua-topbar">
        <div className="ua-brand">
          <div className="ua-brand-mark" aria-hidden="true">C</div>
          <div>
            <div className="ua-brand-title">USTP · Claveria</div>
            <div className="ua-brand-subtitle">Human Resource Management Office</div>
          </div>
        </div>
        <div className="ua-top-meta">
          <span className="ua-preview-badge">DESIGN PREVIEW</span>
          <div className="ua-admin-chip">
            <span>HRMO administrator</span>
            <span className="ua-admin-avatar" aria-label="HRMO administrator">HR</span>
          </div>
        </div>
      </header>

      <main className="ua-main">
        <div className="ua-breadcrumb" aria-label="Breadcrumb">
          <span>Personnel services</span><span className="ua-slash">/</span><strong>Account directory</strong>
        </div>

        <section className="ua-heading-row">
          <div>
            <p className="ua-eyebrow">ACCESS ADMINISTRATION · 01</p>
            <h1 className="ua-title">User accounts</h1>
            <p className="ua-intro">
              Keep personnel access in good order. Add a person, review their account, or send a secure password link.
            </p>
          </div>
          <div className="ua-heading-actions">
            <button className="ua-button ua-button-secondary" type="button" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet size={15} strokeWidth={1.8} /> Import roster
            </button>
            <button className="ua-button ua-button-primary" type="button" onClick={() => { setCreateError(""); setCreateOpen(true); }}>
              <UserPlus size={15} strokeWidth={1.8} /> Add account
            </button>
          </div>
        </section>

        <section className="ua-overview" aria-label="Account overview">
          <div className="ua-stat-grid">
            <article className="ua-stat">
              <div className="ua-stat-label">In the directory</div>
              <div className="ua-stat-line"><span className="ua-stat-value">{accounts.length}</span><span className="ua-stat-note">personnel accounts</span></div>
              <div className="ua-stat-accent" />
            </article>
            <article className="ua-stat pending">
              <div className="ua-stat-label">Awaiting setup</div>
              <div className="ua-stat-line"><span className="ua-stat-value">{pendingCount}</span><span className="ua-stat-note">one-time invites</span></div>
              <div className="ua-stat-accent" />
            </article>
            <article className="ua-stat suspended">
              <div className="ua-stat-label">Access paused</div>
              <div className="ua-stat-line"><span className="ua-stat-value">{suspendedCount}</span><span className="ua-stat-note">suspended accounts</span></div>
              <div className="ua-stat-accent" />
            </article>
          </div>
          <aside className="ua-security-card">
            <div className="ua-security-icon"><ShieldCheck size={17} strokeWidth={1.8} /></div>
            <div>
              <h2 className="ua-security-title">Passwords stay with the user</h2>
              <p className="ua-security-copy">HRMO sends a time-limited setup or reset link. No one can view or email a user’s password.</p>
            </div>
          </aside>
        </section>

        <section className="ua-directory" aria-labelledby="directory-title">
          <div className="ua-directory-head">
            <div>
              <h2 className="ua-section-title" id="directory-title">
                Personnel directory <span className="ua-count-pill">{accounts.length} accounts</span>
              </h2>
              <p className="ua-section-note">Search by name, employee ID, email, or office.</p>
            </div>
            <button className="ua-button ua-button-quiet" type="button" onClick={saveCsvTemplate}>
              <Download size={14} /> Blank template
            </button>
          </div>

          <div className="ua-directory-tools">
            <label className="ua-search-wrap">
              <Search size={15} className="ua-search-icon" />
              <input
                className="ua-search-input"
                type="search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Find a person or employee ID"
                aria-label="Search user accounts"
              />
            </label>
            <label className="ua-select-wrap">
              <select className="ua-select" aria-label="Filter by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <option>All roles</option>
                {ROLE_OPTIONS.map((role) => <option key={role}>{role}</option>)}
              </select>
              <ChevronDown size={13} />
            </label>
            <label className="ua-select-wrap">
              <select className="ua-select" aria-label="Filter by account status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option>All statuses</option>
                <option>Active</option>
                <option>Invitation pending</option>
                <option>Suspended</option>
              </select>
              <ChevronDown size={13} />
            </label>
            <span className="ua-results-label">{filteredAccounts.length} shown</span>
          </div>

          {filteredAccounts.length > 0 ? (
            <>
              <div className="ua-table-wrap">
                <table className="ua-table">
                  <thead>
                    <tr>
                      <th scope="col">Personnel</th>
                      <th scope="col">Login email</th>
                      <th scope="col">Access role</th>
                      <th scope="col">Last sign-in</th>
                      <th scope="col">Account status</th>
                      <th scope="col" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.map((account) => (
                      <tr key={account.id}>
                        <td>
                          <div className="ua-person">
                            <span className="ua-person-avatar">{initials(account.name)}</span>
                            <span><span className="ua-person-name">{account.name}</span><span className="ua-person-id">{account.employeeId}</span></span>
                          </div>
                        </td>
                        <td><div className="ua-email">{account.email}</div><div className="ua-office">{account.office}</div></td>
                        <td><span className="ua-role">{account.role}</span></td>
                        <td><span className="ua-last-seen">{account.lastSignIn}</span></td>
                        <td><span className={statusClass(account.status)}>{account.status}</span></td>
                        <td>
                          <div className="ua-row-actions">
                            <button
                              className="ua-row-action"
                              type="button"
                              disabled={account.status === "Suspended"}
                              title={account.status === "Suspended" ? "Restore account access before sending a reset link" : "Send password reset link"}
                              onClick={() => setConfirmation({ kind: "reset", account })}
                            >
                              <KeyRound size={13} /> Reset
                            </button>
                            <button className="ua-row-action" type="button" onClick={() => openAccount(account)}>Manage</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="ua-mobile-list">
                {filteredAccounts.map((account) => (
                  <article className="ua-mobile-account" key={`mobile-${account.id}`}>
                    <div className="ua-mobile-account-head">
                      <div className="ua-person">
                        <span className="ua-person-avatar">{initials(account.name)}</span>
                        <span><span className="ua-person-name">{account.name}</span><span className="ua-person-id">{account.employeeId}</span></span>
                      </div>
                      <span className={statusClass(account.status)}>{account.status}</span>
                    </div>
                    <div className="ua-mobile-detail">
                      <span>{account.email}</span><span>{account.role}</span><span>{account.office}</span>
                    </div>
                    <div className="ua-mobile-actions">
                      <button className="ua-row-action" type="button" disabled={account.status === "Suspended"} onClick={() => setConfirmation({ kind: "reset", account })}>
                        <KeyRound size={13} /> Reset password
                      </button>
                      <button className="ua-row-action" type="button" onClick={() => openAccount(account)}>Manage</button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="ua-empty">
              <div className="ua-empty-icon"><Users size={20} strokeWidth={1.6} /></div>
              <strong>No accounts found</strong>
              <p>Try another name or clear one of the filters to see more personnel.</p>
              <button className="ua-button ua-button-secondary" type="button" onClick={() => { setSearchText(""); setRoleFilter("All roles"); setStatusFilter("All statuses"); }}>
                Clear filters
              </button>
            </div>
          )}

          <div className="ua-directory-foot">
            <span>Showing {filteredAccounts.length} of {accounts.length}</span>
            <span>Directory actions are local to this preview</span>
          </div>
        </section>

        <p className="ua-footer-note">
          <CircleAlert size={13} />
          <span>Sample names and activity are illustrative. Account creation, directory changes, invitations, and reset emails are not connected to a live HR system.</span>
        </p>
      </main>

      {createOpen && (
        <div className="ua-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false); }}>
          <section className="ua-modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
            <div className="ua-modal-head">
              <div>
                <p className="ua-modal-kicker">DIRECTORY · NEW PERSON</p>
                <h2 className="ua-modal-title" id="create-title">Add an account</h2>
                <p className="ua-modal-copy">Enter the employee’s directory details. They create their own password from a one-time link.</p>
              </div>
              <button className="ua-icon-button" type="button" aria-label="Close add account" onClick={() => setCreateOpen(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateAccount}>
              <div className="ua-modal-body">
                <div className="ua-form-grid">
                  <div className="ua-field">
                    <label htmlFor="new-employee-id">Employee ID <span aria-hidden="true">*</span></label>
                    <input id="new-employee-id" required value={createForm.employeeId} onChange={(event) => { setCreateForm({ ...createForm, employeeId: event.target.value }); setCreateError(""); }} placeholder="e.g. JO-CLV-058" />
                  </div>
                  <div className="ua-field">
                    <label htmlFor="new-full-name">Full name <span aria-hidden="true">*</span></label>
                    <input id="new-full-name" required value={createForm.name} onChange={(event) => { setCreateForm({ ...createForm, name: event.target.value }); setCreateError(""); }} placeholder="As shown on the personnel record" />
                  </div>
                  <div className="ua-field ua-field-wide">
                    <label htmlFor="new-email">Institutional login email <span aria-hidden="true">*</span></label>
                    <input id="new-email" type="email" required value={createForm.email} onChange={(event) => { setCreateForm({ ...createForm, email: event.target.value }); setCreateError(""); }} placeholder="name@ustp.edu.ph" />
                    <span className="ua-field-hint">This address receives the secure setup and password-reset links.</span>
                  </div>
                  <div className="ua-field">
                    <label htmlFor="new-office">Office or unit</label>
                    <input id="new-office" value={createForm.office} onChange={(event) => setCreateForm({ ...createForm, office: event.target.value })} placeholder="e.g. Student Services" />
                  </div>
                  <div className="ua-field">
                    <label htmlFor="new-role">Account role</label>
                    <select id="new-role" value={createForm.role} onChange={(event) => setCreateForm({ ...createForm, role: event.target.value as AccountRole })}>
                      {ROLE_OPTIONS.map((role) => <option key={role}>{role}</option>)}
                    </select>
                  </div>
                  <div className="ua-field ua-field-wide">
                    <div className="ua-security-inline">
                      <ShieldCheck size={15} />
                      <span><strong>Secure setup, not a shared password.</strong> The invitation flow should deliver a single-use, expiring setup link. HRMO never handles or emails the user’s password.</span>
                    </div>
                  </div>
                </div>
                {createError && <p className="ua-form-error" role="alert">{createError}</p>}
              </div>
              <div className="ua-modal-foot">
                <span className="ua-field-hint">Required fields are marked with *.</span>
                <div className="ua-modal-foot-right">
                  <button className="ua-button ua-button-quiet" type="button" onClick={() => setCreateOpen(false)}>Cancel</button>
                  <button className="ua-button ua-button-primary" type="submit"><Mail size={14} /> Add account</button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}

      {importOpen && (
        <div className="ua-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) resetImport(); }}>
          <section className="ua-modal ua-modal-wide" role="dialog" aria-modal="true" aria-labelledby="import-title">
            <div className="ua-modal-head">
              <div>
                <p className="ua-modal-kicker">DIRECTORY · BULK INTAKE</p>
                <h2 className="ua-modal-title" id="import-title">Import personnel</h2>
                <p className="ua-modal-copy">Check the roster against existing accounts first. Only new, complete rows can be added.</p>
              </div>
              <button className="ua-icon-button" type="button" aria-label="Close import" onClick={resetImport}><X size={16} /></button>
            </div>

            {importStage !== "complete" && (
              <div className="ua-import-steps" aria-label="Import progress">
                <span className={`ua-step ${importStage === "upload" ? "active" : "done"}`}><span className="ua-step-dot">{importStage === "upload" ? "01" : <Check size={12} />}</span>Upload</span>
                <span className="ua-step-rule" />
                <span className={`ua-step ${importStage === "review" ? "active" : ""}`}><span className="ua-step-dot">02</span>Review matches</span>
                <span className="ua-step-rule" />
                <span className="ua-step"><span className="ua-step-dot">03</span>Add new only</span>
              </div>
            )}

            {importStage === "upload" && (
              <div className="ua-modal-body">
                <div
                  className="ua-upload-zone"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => { event.preventDefault(); void handleFile(event.dataTransfer.files[0]); }}
                >
                  <div className="ua-upload-icon"><Upload size={18} strokeWidth={1.8} /></div>
                  <p className="ua-upload-title">Choose a personnel roster</p>
                  <p className="ua-upload-copy">CSV or Excel workbook · headers in the first row · files stay in this browser preview</p>
                  <div className="ua-upload-actions">
                    <label className="ua-button ua-button-primary" htmlFor="roster-upload">
                      <Upload size={14} /> Choose file
                    </label>
                    <input className="ua-file-input" id="roster-upload" type="file" accept=".csv,.xlsx,.xls" onChange={(event) => void handleFile(event.target.files?.[0])} />
                    <button className="ua-button ua-button-secondary" type="button" onClick={useSampleImport}>Use sample roster</button>
                  </div>
                </div>
                <div className="ua-template-row">
                  <span>Expected: employee ID, full name, email. Office and role are optional.</span>
                  <button type="button" onClick={saveCsvTemplate}><Download size={13} /> Download blank template</button>
                </div>
                <div className="ua-import-warning">
                  <ShieldCheck size={14} />
                  <span>Passwords are never accepted from a roster. Imported accounts should receive a separate, one-time setup email after HRMO review.</span>
                </div>
                {importingFile && <p className="ua-import-file"><FileSpreadsheet size={15} /> Reading roster in this browser…</p>}
                {importName && importError && <p className="ua-import-file"><FileSpreadsheet size={15} /> {importName}</p>}
                {importError && <div className="ua-import-error" role="alert">{importError}</div>}
              </div>
            )}

            {importStage === "review" && (
              <>
                <div className="ua-modal-body">
                  <div className="ua-import-file"><FileSpreadsheet size={15} /><span>{importName}</span></div>
                  <div className="ua-review-summary">
                    <div className="ua-review-count is-new"><strong>{newCount}</strong><span>New · eligible</span></div>
                    <div className="ua-review-count is-skip"><strong>{existingCount}</strong><span>Already listed · skipped</span></div>
                    <div className="ua-review-count is-attention"><strong>{reviewCount}</strong><span>Needs attention</span></div>
                  </div>
                  <div className="ua-import-table-wrap">
                    <table className="ua-import-table">
                      <thead><tr><th>Name</th><th>Employee ID</th><th>Login email</th><th>Result</th></tr></thead>
                      <tbody>
                        {importRows.map((row, index) => (
                          <tr key={`${row.employeeId}-${index}`}>
                            <td>{row.name}<br /><span style={{ color: "#8c9990" }}>{row.reason}</span></td>
                            <td>{row.employeeId}</td>
                            <td>{row.email}</td>
                            <td>
                              {row.result === "new" ? <span className="ua-row-result new"><CheckCircle2 size={12} /> New</span> : null}
                              {row.result === "existing" ? <span className="ua-row-result existing"><CheckCircle2 size={12} /> Skip</span> : null}
                              {row.result === "review" ? <span className="ua-row-result review"><CircleAlert size={12} /> Review</span> : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="ua-import-commit-note">
                    Duplicate employee IDs or emails are excluded automatically. Incomplete rows are never added. New accounts enter as invitation-pending; no emails are sent in this preview.
                  </p>
                </div>
                <div className="ua-modal-foot">
                  <button className="ua-button ua-button-quiet" type="button" onClick={() => { setImportStage("upload"); setImportRows([]); setImportName(""); setImportError(""); }}>Choose another file</button>
                  <div className="ua-modal-foot-right">
                    <button className="ua-button ua-button-quiet" type="button" onClick={resetImport}>Cancel</button>
                    <button className="ua-button ua-button-primary" type="button" disabled={newCount === 0} onClick={importNewAccounts}>
                      <Plus size={14} /> Add {newCount} new {newCount === 1 ? "account" : "accounts"}
                    </button>
                  </div>
                </div>
              </>
            )}

            {importStage === "complete" && (
              <>
                <div className="ua-modal-body">
                  <div className="ua-import-complete">
                    <div className="ua-complete-mark"><CheckCircle2 size={23} /></div>
                    <h3>{newCount} new {newCount === 1 ? "account" : "accounts"} added</h3>
                    <p>{existingCount} existing duplicate{existingCount === 1 ? "" : "s"} and {reviewCount} incomplete row{reviewCount === 1 ? "" : "s"} were skipped. Accounts are held as invitations in this local preview.</p>
                  </div>
                  <div className="ua-import-warning"><Mail size={14} /><span>No invitation email was sent. Connect the approved account-provisioning service before using this flow with personnel records.</span></div>
                </div>
                <div className="ua-modal-foot">
                  <span className="ua-field-hint">Import review complete</span>
                  <div className="ua-modal-foot-right"><button className="ua-button ua-button-primary" type="button" onClick={resetImport}>Return to directory</button></div>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {selectedAccount && (
        <div className="ua-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}>
          <section className="ua-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
            <div className="ua-modal-head">
              <div><p className="ua-modal-kicker">ACCOUNT · MANAGEMENT</p><h2 className="ua-modal-title" id="profile-title">Account details</h2></div>
              <button className="ua-icon-button" type="button" aria-label="Close account details" onClick={() => setSelectedId(null)}><X size={16} /></button>
            </div>
            <div className="ua-modal-body">
              <div className="ua-profile-top">
                <span className="ua-profile-avatar">{initials(selectedAccount.name)}</span>
                <div><h3 className="ua-profile-name">{selectedAccount.name}</h3><p className="ua-profile-id">{selectedAccount.employeeId}</p></div>
              </div>
              <div className="ua-profile-fields">
                <div className="ua-profile-field"><span>Login email</span><strong>{selectedAccount.email}</strong></div>
                <div className="ua-profile-field"><span>Office or unit</span><strong>{selectedAccount.office}</strong></div>
                <div className="ua-profile-field"><span>Account status</span><strong><span className={statusClass(selectedAccount.status)}>{selectedAccount.status}</span></strong></div>
                <div className="ua-profile-field"><span>Last sign-in</span><strong>{selectedAccount.lastSignIn}</strong></div>
                {selectedAccount.lastReset && <div className="ua-profile-field"><span>Last reset link</span><strong>{selectedAccount.lastReset}</strong></div>}
                <div className="ua-profile-field">
                  <label className="ua-field" htmlFor="account-role-draft"><span>Access role</span>
                    <select id="account-role-draft" value={roleDraft} onChange={(event) => setRoleDraft(event.target.value as AccountRole)}>
                      {ROLE_OPTIONS.map((role) => <option key={role}>{role}</option>)}
                    </select>
                  </label>
                </div>
              </div>
              <div className="ua-security-inline"><KeyRound size={14} /><span>HRMO cannot see the current password. A reset sends a one-use link to the verified login email.</span></div>
              <div className="ua-profile-actions">
                <button className="ua-button ua-button-secondary" type="button" onClick={saveRole}>Save role</button>
                {selectedAccount.status !== "Suspended" ? (
                  <>
                    <button className="ua-button ua-button-quiet" type="button" onClick={() => { setConfirmation({ kind: "reset", account: selectedAccount }); setSelectedId(null); }}><Mail size={14} /> Send reset link</button>
                    <button className="ua-button ua-button-quiet" type="button" onClick={() => { setConfirmation({ kind: "suspend", account: selectedAccount }); setSelectedId(null); }}>Pause access</button>
                  </>
                ) : (
                  <button className="ua-button ua-button-primary" type="button" onClick={() => { setConfirmation({ kind: "restore", account: selectedAccount }); setSelectedId(null); }}>Restore access</button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {confirmation && (
        <div className="ua-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmation(null); }}>
          <section className="ua-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
            <div className="ua-modal-head">
              <div>
                <p className="ua-modal-kicker">CONFIRM ACCOUNT ACTION</p>
                <h2 className="ua-modal-title" id="confirm-title">
                  {confirmation.kind === "reset" ? "Send a reset link?" : confirmation.kind === "suspend" ? "Pause account access?" : "Restore account access?"}
                </h2>
              </div>
              <button className="ua-icon-button" type="button" aria-label="Close confirmation" onClick={() => setConfirmation(null)}><X size={16} /></button>
            </div>
            <div className="ua-modal-body">
              <div className="ua-profile-top">
                <span className="ua-profile-avatar">{initials(confirmation.account.name)}</span>
                <div><h3 className="ua-profile-name">{confirmation.account.name}</h3><p className="ua-profile-id">{confirmation.account.employeeId}</p></div>
              </div>
              {confirmation.kind === "reset" ? (
                <>
                  <p className="ua-modal-copy" style={{ marginTop: 15 }}>A single-use password reset link will be prepared for <strong>{maskEmail(confirmation.account.email)}</strong>. The existing password stays private.</p>
                  <div className="ua-security-inline" style={{ marginTop: 13 }}><Mail size={14} /><span>The reset link should expire after a short window. In this design preview, no email will be sent.</span></div>
                </>
              ) : (
                <p className="ua-modal-copy" style={{ marginTop: 15 }}>
                  {confirmation.kind === "suspend"
                    ? "This account will be marked as suspended in the preview. A production system must also revoke active sessions and audit the HRMO action."
                    : "This account will be marked active in the preview. A production system should recheck authorization before restoring access."}
                </p>
              )}
            </div>
            <div className="ua-modal-foot">
              <span className="ua-field-hint">Action applies to this preview only.</span>
              <div className="ua-modal-foot-right">
                <button className="ua-button ua-button-quiet" type="button" onClick={() => setConfirmation(null)}>Cancel</button>
                <button className={`ua-button ${confirmation.kind === "suspend" ? "ua-button-danger" : "ua-button-primary"}`} type="button" onClick={confirmAction}>
                  {confirmation.kind === "reset" ? <><Mail size={14} /> Prepare reset link</> : confirmation.kind === "suspend" ? "Pause access" : "Restore access"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {notice && (
        <div className="ua-toast" role="status">
          <CheckCircle2 size={16} />
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}>Dismiss</button>
        </div>
      )}
    </div>
  );
}
