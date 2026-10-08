import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileText,
  Filter,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";

type Stage = "New Submissions" | "For Review" | "Approved" | "Contracts Generated";
type Application = {
  ref: string;
  name: string;
  position: string;
  office: string;
  period: string;
  submitted: string;
  stage: Stage;
  note: string;
};

const initialApplications: Application[] = [
  { ref: "JO26-CLV-041", name: "Mara Villanueva", position: "Laboratory Aide", office: "College of Engineering", period: "Oct–Dec 2026", submitted: "2026-09-23", stage: "New Submissions", note: "Renewal form received. Attachments present." },
  { ref: "JO26-CLV-039", name: "Elias Mercado", position: "Administrative Assistant", office: "Office of the Campus Director", period: "Oct–Dec 2026", submitted: "2026-09-22", stage: "New Submissions", note: "Renewal form received. TOR needs a final check." },
  { ref: "JO26-CLV-037", name: "Nika Sarmiento", position: "Research Assistant", office: "Research and Development", period: "Oct–Dec 2026", submitted: "2026-09-20", stage: "For Review", note: "Please verify the supervisor assignment and duty schedule." },
  { ref: "JO26-CLV-035", name: "Tomas Alvarado", position: "Records Clerk", office: "Registrar's Office", period: "Oct–Dec 2026", submitted: "2026-09-19", stage: "For Review", note: "One correction requested: office affiliation spelling." },
  { ref: "JO26-CLV-031", name: "Leah Manalo", position: "Agricultural Technician", office: "College of Agriculture", period: "Oct–Dec 2026", submitted: "2026-09-17", stage: "Approved", note: "HRMO review complete. Ready for contract preparation." },
  { ref: "JO26-CLV-028", name: "Rafael Dizon", position: "Project Assistant", office: "Extension Services", period: "Oct–Dec 2026", submitted: "2026-09-15", stage: "Approved", note: "HRMO review complete. Ready for contract preparation." },
  { ref: "JO26-CLV-024", name: "Inez Bautista", position: "Library Assistant", office: "University Library", period: "Oct–Dec 2026", submitted: "2026-09-11", stage: "Contracts Generated", note: "Contract packet prepared for controlled download." },
  { ref: "JO26-CLV-019", name: "Noel Pangan", position: "IT Support Staff", office: "ICT Services", period: "Oct–Dec 2026", submitted: "2026-09-08", stage: "Contracts Generated", note: "Contract packet prepared for controlled download." },
];

const stages: Stage[] = ["New Submissions", "For Review", "Approved", "Contracts Generated"];
const stageMeta: Record<Stage, { short: string; tone: string }> = {
  "New Submissions": { short: "New", tone: "new" },
  "For Review": { short: "For review", tone: "review" },
  Approved: { short: "Approved", tone: "approved" },
  "Contracts Generated": { short: "Contract ready", tone: "generated" },
};

function StatusTag({ stage }: { stage: Stage }) {
  const meta = stageMeta[stage];
  return <span className={`hrmo-status hrmo-status--${meta.tone}`}><span className="hrmo-status-dot" />{meta.short}</span>;
}

export function HrmoApplications() {
  const [applications, setApplications] = useState(initialApplications);
  const [activeStage, setActiveStage] = useState<Stage>("New Submissions");
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("All positions");
  const [office, setOffice] = useState("All offices");
  const [period, setPeriod] = useState("All periods");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [submittedDate, setSubmittedDate] = useState("");
  const [selected, setSelected] = useState<Application | null>(null);
  const [toast, setToast] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => applications.filter((app) => {
    const query = search.trim().toLowerCase();
    return app.stage === activeStage
      && (!query || [app.name, app.position, app.office, app.ref].some((value) => value.toLowerCase().includes(query)))
      && (position === "All positions" || app.position === position)
      && (office === "All offices" || app.office === office)
      && (period === "All periods" || app.period === period)
      && (statusFilter === "All statuses" || app.stage === statusFilter)
      && (!submittedDate || app.submitted === submittedDate);
  }), [applications, activeStage, search, position, office, period, statusFilter, submittedDate]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const updateStage = (app: Application, next: Stage, message: string) => {
    setApplications((current) => current.map((item) => item.ref === app.ref ? { ...item, stage: next } : item));
    if (selected?.ref === app.ref) setSelected({ ...app, stage: next });
    notify(message);
  };

  const resetFilters = () => {
    setSearch("");
    setPosition("All positions");
    setOffice("All offices");
    setPeriod("All periods");
    setStatusFilter("All statuses");
    setSubmittedDate("");
  };

  const positions = Array.from(new Set(applications.map((app) => app.position)));
  const offices = Array.from(new Set(applications.map((app) => app.office)));
  const activeCount = applications.filter((app) => app.stage === activeStage).length;

  return (
    <main className="hrmo-shell">
      <style>{`
        .hrmo-shell {
          --navy: #123552; --navy-deep: #0d2a42; --gold: #c59a42; --paper: #f4f3ef;
          --surface: #fffefa; --ink: #203748; --muted: #627481; --line: #d8dedf;
          min-height: 100dvh; background: var(--paper); color: var(--ink);
          font-family: "DM Sans", "Segoe UI", sans-serif; font-size: 14px;
        }
        .hrmo-shell * { box-sizing: border-box; }
        .hrmo-shell button, .hrmo-shell input, .hrmo-shell select { font: inherit; }
        .hrmo-shell button { cursor: pointer; }
        .hrmo-shell :focus-visible { outline: 3px solid #d0a448; outline-offset: 2px; }
        .hrmo-topbar { height: 58px; display:flex; align-items:center; justify-content:space-between; padding: 0 34px; color:#fff; background:var(--navy-deep); border-bottom:3px solid var(--gold); }
        .hrmo-brand { display:flex; align-items:center; gap:12px; }
        .hrmo-brand-mark { width:31px; height:31px; display:grid; place-items:center; border:1px solid #d6b45e; color:#e8ce8a; font:700 10px/1 "DM Sans",sans-serif; letter-spacing:.03em; }
        .hrmo-brand-copy { display:flex; align-items:baseline; gap:9px; }
        .hrmo-brand-title { font-size:13px; font-weight:700; letter-spacing:.035em; }
        .hrmo-brand-divider { color:#7f98a9; font-size:12px; }
        .hrmo-brand-subtitle { color:#c7d4db; font-size:12px; }
        .hrmo-top-actions { display:flex; align-items:center; gap:17px; }
        .hrmo-term { padding:6px 10px; color:#ead7a6; border:1px solid #536d7d; font-size:11px; letter-spacing:.07em; text-transform:uppercase; }
        .hrmo-icon-button { position:relative; width:34px; height:34px; display:grid; place-items:center; color:#e9eff2; background:transparent; border:0; }
        .hrmo-alert-dot { position:absolute; right:6px; top:5px; width:6px; height:6px; background:#d3a53e; border:1px solid var(--navy-deep); border-radius:50%; }
        .hrmo-user { display:flex; align-items:center; gap:9px; padding-left:15px; border-left:1px solid #496377; color:#f1f4f5; font-size:12px; }
        .hrmo-user-initials { width:29px; height:29px; display:grid; place-items:center; border:1px solid #93a7b3; color:#fff; font-size:10px; font-weight:700; }
        .hrmo-wrap { width:min(1440px, 100%); margin:0 auto; padding:25px 34px 44px; }
        .hrmo-breadcrumb { display:flex; align-items:center; gap:8px; color:#667a86; font-size:11px; letter-spacing:.02em; }
        .hrmo-breadcrumb strong { color:#3d5668; font-weight:600; }
        .hrmo-heading-row { display:flex; justify-content:space-between; align-items:flex-end; gap:20px; margin:21px 0 19px; }
        .hrmo-eyebrow { margin:0 0 6px; color:#8a6c2e; font-size:10px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; }
        .hrmo-heading-row h1 { margin:0; color:var(--navy-deep); font:600 clamp(26px, 3vw, 34px)/1.15 Georgia, "Times New Roman", serif; letter-spacing:-.02em; }
        .hrmo-heading-row p { margin:7px 0 0; color:var(--muted); font-size:13px; }
        .hrmo-heading-meta { display:flex; align-items:center; gap:9px; padding:8px 12px; background:#e8eceb; border-left:2px solid #b9923d; color:#526775; font-size:11px; white-space:nowrap; }
        .hrmo-heading-meta svg { color:#7e6328; }
        .hrmo-metrics { display:grid; grid-template-columns:repeat(4,1fr); gap:1px; margin-bottom:22px; background:#d2d9d9; border:1px solid #d2d9d9; }
        .hrmo-metric { display:flex; align-items:center; gap:14px; min-height:78px; padding:14px 17px; background:var(--surface); }
        .hrmo-metric-icon { width:35px; height:35px; display:grid; place-items:center; color:#385b70; background:#edf1f1; }
        .hrmo-metric[data-tone="gold"] .hrmo-metric-icon { color:#8d6a23; background:#f5f0e2; }
        .hrmo-metric-value { color:var(--navy-deep); font:600 23px/1 Georgia,serif; }
        .hrmo-metric-label { margin-top:5px; color:#647681; font-size:11px; }
        .hrmo-workspace { border:1px solid #d2d9d9; background:var(--surface); box-shadow:0 2px 8px rgba(26,48,62,.035); }
        .hrmo-tabs { display:flex; align-items:stretch; overflow-x:auto; padding:0 20px; border-bottom:1px solid var(--line); scrollbar-width:thin; }
        .hrmo-tab { position:relative; display:flex; align-items:center; gap:9px; padding:16px 15px 14px; color:#687985; background:transparent; border:0; border-bottom:3px solid transparent; white-space:nowrap; font-size:12px; font-weight:600; }
        .hrmo-tab:hover { color:var(--navy); background:#f8f8f4; }
        .hrmo-tab[aria-selected="true"] { color:var(--navy); border-bottom-color:var(--gold); }
        .hrmo-tab-count { min-width:20px; height:20px; display:grid; place-items:center; padding:0 5px; color:#586d79; background:#edf0ef; font-size:10px; font-weight:700; }
        .hrmo-tab[aria-selected="true"] .hrmo-tab-count { color:#77591d; background:#f3ecd9; }
        .hrmo-toolbar { display:flex; align-items:center; gap:11px; padding:17px 20px 14px; }
        .hrmo-search { position:relative; flex:1; min-width:170px; }
        .hrmo-search svg { position:absolute; top:11px; left:11px; color:#73838d; }
        .hrmo-search input { width:100%; height:38px; padding:0 12px 0 37px; border:1px solid #cbd4d7; border-radius:0; color:#213d50; background:#fff; font-size:12px; }
        .hrmo-search input::placeholder { color:#8b999f; }
        .hrmo-select { height:38px; min-width:125px; padding:0 28px 0 10px; color:#475e6c; border:1px solid #cbd4d7; border-radius:0; background:#fff; font-size:11px; }
        .hrmo-filter-toggle { height:38px; display:flex; align-items:center; gap:7px; padding:0 11px; color:#375468; background:#fff; border:1px solid #cbd4d7; font-size:11px; font-weight:600; }
        .hrmo-filter-toggle:hover { background:#f1f4f3; }
        .hrmo-filter-panel { display:grid; grid-template-columns:repeat(3,minmax(150px,1fr)) auto; align-items:end; gap:10px; padding:0 20px 16px; }
        .hrmo-filter-field label { display:block; margin:0 0 5px; color:#657681; font-size:10px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; }
        .hrmo-filter-field select,.hrmo-filter-field input { width:100%; height:36px; padding:0 9px; border:1px solid #cbd4d7; border-radius:0; color:#415966; background:#fff; font-size:11px; }
        .hrmo-reset { height:36px; padding:0 10px; color:#315168; background:transparent; border:0; font-size:11px; text-decoration:underline; text-underline-offset:3px; }
        .hrmo-result-line { display:flex; align-items:center; justify-content:space-between; padding:0 20px 12px; color:#6a7a84; font-size:11px; }
        .hrmo-result-line strong { color:#344f61; font-weight:700; }
        .hrmo-table-wrap { width:100%; overflow-x:auto; border-top:1px solid #e1e5e4; }
        .hrmo-table { width:100%; min-width:900px; border-collapse:collapse; text-align:left; }
        .hrmo-table th { height:39px; padding:0 14px; color:#627580; background:#f5f6f3; border-bottom:1px solid #dce2e1; font-size:9px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; }
        .hrmo-table td { height:66px; padding:9px 14px; color:#344b5a; border-bottom:1px solid #e8ebea; vertical-align:middle; font-size:11px; }
        .hrmo-table tbody tr:hover { background:#fbfbf7; }
        .hrmo-table tr:last-child td { border-bottom:0; }
        .hrmo-applicant { display:flex; align-items:center; gap:10px; min-width:185px; }
        .hrmo-avatar { flex:none; width:31px; height:31px; display:grid; place-items:center; color:#294e66; background:#e5ecee; border:1px solid #d1dddf; font-size:10px; font-weight:700; }
        .hrmo-person-name { color:#1d394d; font-size:12px; font-weight:700; }
        .hrmo-ref { margin-top:3px; color:#839098; font:10px/1.2 "SFMono-Regular", Consolas, monospace; }
        .hrmo-position { color:#314c5d; font-size:11px; font-weight:600; }
        .hrmo-office { max-width:180px; color:#6b7b84; line-height:1.35; }
        .hrmo-period { color:#415b69; white-space:nowrap; }
        .hrmo-submitted { color:#71808a; white-space:nowrap; }
        .hrmo-status { display:inline-flex; align-items:center; gap:6px; padding:5px 7px; border:1px solid; white-space:nowrap; font-size:10px; font-weight:600; }
        .hrmo-status-dot { width:6px; height:6px; background:currentColor; border-radius:50%; }
        .hrmo-status--new { color:#775d23; background:#f8f3e7; border-color:#e8d9b4; }
        .hrmo-status--review { color:#365c72; background:#eef3f4; border-color:#cfdee3; }
        .hrmo-status--approved { color:#3b654f; background:#eef4ef; border-color:#d1e1d4; }
        .hrmo-status--generated { color:#455a72; background:#eff1f5; border-color:#d6dbe4; }
        .hrmo-row-actions { display:flex; align-items:center; gap:5px; white-space:nowrap; }
        .hrmo-action { min-height:29px; display:inline-flex; align-items:center; justify-content:center; gap:5px; padding:0 8px; color:#2e5268; background:transparent; border:1px solid transparent; font-size:10px; font-weight:600; }
        .hrmo-action:hover { color:#123c59; background:#eef2f2; border-color:#d4dedf; }
        .hrmo-action--primary { color:#fff; background:#244d68; border-color:#244d68; }
        .hrmo-action--primary:hover { color:#fff; background:#173c56; }
        .hrmo-action--gold { color:#634d1e; background:#f2ead6; border-color:#e4d7b5; }
        .hrmo-action--gold:hover { background:#e9dcba; }
        .hrmo-empty { display:flex; flex-direction:column; align-items:center; padding:48px 20px; text-align:center; }
        .hrmo-empty-mark { width:42px; height:42px; display:grid; place-items:center; color:#547181; background:#eef2f0; }
        .hrmo-empty strong { margin:13px 0 5px; color:#27465a; font:600 18px Georgia,serif; }
        .hrmo-empty span { color:#74838a; font-size:12px; }
        .hrmo-footer-note { display:flex; align-items:flex-start; gap:9px; margin:17px 1px 0; color:#657782; font-size:11px; line-height:1.5; }
        .hrmo-footer-note svg { flex:none; margin-top:1px; color:#627f73; }
        .hrmo-overlay { position:fixed; inset:0; z-index:50; display:flex; justify-content:flex-end; background:rgba(17,38,53,.36); animation:hrmoFade .18s ease-out; }
        .hrmo-drawer { width:min(510px,100%); height:100%; overflow:auto; background:#fbfaf6; box-shadow:-10px 0 35px rgba(14,38,54,.18); animation:hrmoSlide .22s ease-out; }
        .hrmo-drawer-head { display:flex; align-items:flex-start; justify-content:space-between; padding:22px 24px 18px; color:#fff; background:var(--navy); border-bottom:3px solid var(--gold); }
        .hrmo-drawer-kicker { margin:0 0 5px; color:#dfc781; font-size:9px; font-weight:700; letter-spacing:.15em; text-transform:uppercase; }
        .hrmo-drawer-head h2 { margin:0; font:600 24px/1.12 Georgia,serif; }
        .hrmo-drawer-ref { margin-top:7px; color:#d0dce1; font:10px Consolas,monospace; }
        .hrmo-drawer-close { width:34px; height:34px; display:grid; place-items:center; color:#fff; background:transparent; border:1px solid #587287; }
        .hrmo-drawer-body { padding:21px 24px 28px; }
        .hrmo-drawer-status-row { display:flex; align-items:center; justify-content:space-between; padding-bottom:17px; border-bottom:1px solid #dce2df; }
        .hrmo-detail-label { color:#7a898f; font-size:9px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; }
        .hrmo-detail-date { margin-top:5px; color:#3d5666; font-size:11px; }
        .hrmo-section-title { display:flex; align-items:center; gap:8px; margin:20px 0 11px; color:#26485e; font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
        .hrmo-detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:0 18px; }
        .hrmo-detail-item { padding:11px 0; border-bottom:1px solid #e5e8e4; }
        .hrmo-detail-item span { display:block; color:#75858b; font-size:10px; }
        .hrmo-detail-item strong { display:block; margin-top:5px; color:#2a4557; font-size:12px; font-weight:600; }
        .hrmo-privacy { display:flex; align-items:flex-start; gap:8px; margin:14px 0; padding:10px 11px; color:#5e727b; background:#eef2ef; border-left:2px solid #839f8e; font-size:10px; line-height:1.45; }
        .hrmo-review-note { padding:12px; color:#536a77; background:#f1f2ee; border:1px solid #e0e4df; font-size:11px; line-height:1.5; }
        .hrmo-contract-box { margin-top:19px; padding:16px; background:#f6f1e3; border:1px solid #e6d8b8; }
        .hrmo-contract-top { display:flex; align-items:flex-start; gap:11px; }
        .hrmo-contract-icon { flex:none; width:31px; height:31px; display:grid; place-items:center; color:#7c632a; background:#fffaf0; border:1px solid #e7d7ae; }
        .hrmo-contract-box h3 { margin:0; color:#564822; font-size:12px; }
        .hrmo-contract-box p { margin:5px 0 0; color:#776b4c; font-size:10px; line-height:1.5; }
        .hrmo-check-list { display:grid; gap:8px; margin:14px 0; }
        .hrmo-check { display:flex; align-items:center; gap:8px; color:#5b674f; font-size:10px; }
        .hrmo-check svg { color:#5b7c63; }
        .hrmo-contract-actions { display:flex; gap:8px; flex-wrap:wrap; padding-top:12px; border-top:1px solid #e3d8bc; }
        .hrmo-drawer-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:19px; }
        .hrmo-drawer-actions .hrmo-action { min-height:36px; padding:0 12px; font-size:11px; }
        .hrmo-toast { position:fixed; z-index:70; right:25px; bottom:23px; display:flex; align-items:center; gap:9px; padding:12px 16px; color:#fff; background:#173c55; border-left:3px solid var(--gold); box-shadow:0 5px 20px rgba(19,42,57,.18); font-size:12px; animation:hrmoFade .18s ease-out; }
        .hrmo-toast svg { color:#dfc781; }
        @keyframes hrmoFade { from { opacity:0 } to { opacity:1 } }
        @keyframes hrmoSlide { from { transform:translateX(18px); opacity:.7 } to { transform:translateX(0); opacity:1 } }
        @media (max-width: 980px) {
          .hrmo-topbar { padding:0 20px; }.hrmo-wrap { padding:22px 20px 35px; }
          .hrmo-toolbar { flex-wrap:wrap; }.hrmo-search { flex-basis:100%; }
          .hrmo-select { flex:1; }.hrmo-filter-panel { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .hrmo-metric { padding:12px; gap:9px; }.hrmo-metric-icon { width:31px; height:31px; }
        }
        @media (max-width: 650px) {
          .hrmo-topbar { height:54px; padding:0 14px; }.hrmo-brand-copy { display:block; }.hrmo-brand-divider,.hrmo-brand-subtitle { display:none; }
          .hrmo-brand-title { font-size:11px; }.hrmo-top-actions { gap:8px; }.hrmo-term { display:none; }.hrmo-user { padding-left:9px; }.hrmo-user > span:last-child { display:none; }
          .hrmo-wrap { padding:17px 12px 30px; }.hrmo-heading-row { align-items:flex-start; flex-direction:column; gap:11px; margin:17px 0; }
          .hrmo-heading-row h1 { font-size:27px; }.hrmo-heading-meta { align-self:stretch; }
          .hrmo-metrics { grid-template-columns:repeat(2,1fr); margin-bottom:15px; }
          .hrmo-metric { min-height:66px; }.hrmo-metric-value { font-size:20px; }.hrmo-metric-label { font-size:10px; }
          .hrmo-tabs { padding:0 7px; }.hrmo-tab { gap:6px; padding:13px 9px 11px; font-size:10px; }
          .hrmo-toolbar { gap:7px; padding:12px 11px; }.hrmo-search { flex-basis:100%; }.hrmo-select { min-width:0; flex-basis:calc(50% - 4px); }
          .hrmo-filter-toggle { flex:1; justify-content:center; }.hrmo-filter-panel { padding:0 11px 13px; gap:8px; }
          .hrmo-result-line { padding:0 12px 10px; }
          .hrmo-table-wrap { overflow:visible; border-top:1px solid #e1e5e4; }
          .hrmo-table { display:block; min-width:0; }
          .hrmo-table thead { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; }
          .hrmo-table tbody { display:grid; gap:0; }
          .hrmo-table tr { display:grid; grid-template-columns:1fr auto; gap:0 10px; padding:13px 12px 11px; border-bottom:1px solid #e0e5e3; }
          .hrmo-table td { display:block; height:auto; min-width:0; padding:0; border:0; }
          .hrmo-table td:nth-child(1) { grid-column:1; grid-row:1; }.hrmo-table td:nth-child(2) { grid-column:1; grid-row:2; margin-top:7px; }
          .hrmo-table td:nth-child(3) { display:none; }.hrmo-table td:nth-child(4) { grid-column:1; grid-row:3; margin-top:5px; }
          .hrmo-table td:nth-child(5) { grid-column:2; grid-row:1; align-self:start; }.hrmo-table td:nth-child(6) { display:none; }
          .hrmo-table td:nth-child(7) { grid-column:1 / -1; grid-row:4; margin-top:11px; }
          .hrmo-applicant { min-width:0; }.hrmo-person-name { font-size:12px; }.hrmo-office { display:inline; max-width:none; }
          .hrmo-period { font-size:10px; }.hrmo-period::before { content:"Period · "; color:#8a9699; }
          .hrmo-row-actions { gap:6px; }.hrmo-action { min-height:34px; padding:0 9px; border-color:#dce2e1; background:#fff; font-size:10px; }
          .hrmo-action--primary { color:#fff; background:#244d68; border-color:#244d68; }
          .hrmo-action--gold { color:#634d1e; background:#f2ead6; border-color:#e4d7b5; }
          .hrmo-footer-note { margin-top:12px; font-size:10px; }.hrmo-drawer-head { padding:18px 17px 16px; }.hrmo-drawer-body { padding:17px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hrmo-shell *, .hrmo-shell *::before, .hrmo-shell *::after { animation-duration:.01ms !important; animation-iteration-count:1 !important; scroll-behavior:auto !important; }
        }
      `}</style>
      <header className="hrmo-topbar">
        <div className="hrmo-brand">
          <div className="hrmo-brand-mark" aria-label="USTP text mark">USTP</div>
          <div className="hrmo-brand-copy">
            <span className="hrmo-brand-title">HRMO · CLAVERIA</span><span className="hrmo-brand-divider">/</span><span className="hrmo-brand-subtitle">Personnel Services</span>
          </div>
        </div>
        <div className="hrmo-top-actions">
          <span className="hrmo-term">JO renewal · 2026</span>
          <button type="button" className="hrmo-icon-button" aria-label="Notifications" onClick={() => notify("You are up to date on queue alerts.")}><Bell size={17} /><i className="hrmo-alert-dot" /></button>
          <div className="hrmo-user"><span className="hrmo-user-initials">HR</span><span>HRMO Staff</span><ChevronDown size={13} /></div>
        </div>
      </header>

      <div className="hrmo-wrap">
        <nav className="hrmo-breadcrumb" aria-label="Breadcrumb"><span>Human Resource Management Office</span><ChevronRight size={13} /><strong>Applications queue</strong></nav>
        <section className="hrmo-heading-row">
          <div><p className="hrmo-eyebrow">Job Order Renewal</p><h1>Applications queue</h1><p>Review and prepare renewals for the October–December 2026 contract period.</p></div>
          <div className="hrmo-heading-meta"><ShieldCheck size={15} /><span>Restricted HRMO workspace</span></div>
        </section>

        <section className="hrmo-metrics" aria-label="Queue totals">
          {stages.map((stage, index) => {
            const count = applications.filter((app) => app.stage === stage).length;
            const Icon = [Clock3, ClipboardCheck, CheckCircle2, FileCheck2][index];
            return <div className="hrmo-metric" data-tone={index === 0 ? "gold" : ""} key={stage}><div className="hrmo-metric-icon"><Icon size={17} /></div><div><div className="hrmo-metric-value">{String(count).padStart(2, "0")}</div><div className="hrmo-metric-label">{stage}</div></div></div>;
          })}
        </section>

        <section className="hrmo-workspace" aria-label="Renewal applications">
          <div className="hrmo-tabs" role="tablist" aria-label="Application workflow stage">
            {stages.map((stage) => <button key={stage} type="button" role="tab" aria-selected={activeStage === stage} className="hrmo-tab" onClick={() => setActiveStage(stage)}>{stage}<span className="hrmo-tab-count">{applications.filter((item) => item.stage === stage).length}</span></button>)}
          </div>
          <div className="hrmo-toolbar">
            <label className="hrmo-search"><Search size={15} /><input aria-label="Search applicant, position, office, or reference" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search applicant, position, office or reference" /></label>
            <select className="hrmo-select" aria-label="Filter by position" value={position} onChange={(event) => setPosition(event.target.value)}><option>All positions</option>{positions.map((item) => <option key={item}>{item}</option>)}</select>
            <select className="hrmo-select" aria-label="Filter by office" value={office} onChange={(event) => setOffice(event.target.value)}><option>All offices</option>{offices.map((item) => <option key={item}>{item}</option>)}</select>
            <button type="button" className="hrmo-filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal size={14} />More filters<ChevronDown size={13} /></button>
          </div>
          {filtersOpen && <div className="hrmo-filter-panel">
            <div className="hrmo-filter-field"><label htmlFor="hrmo-period">Contract period</label><select id="hrmo-period" value={period} onChange={(event) => setPeriod(event.target.value)}><option>All periods</option><option>Oct–Dec 2026</option></select></div>
            <div className="hrmo-filter-field"><label htmlFor="hrmo-status">Status</label><select id="hrmo-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></div>
            <div className="hrmo-filter-field"><label htmlFor="hrmo-submitted">Date submitted</label><input id="hrmo-submitted" type="date" value={submittedDate} onChange={(event) => setSubmittedDate(event.target.value)} /></div>
            <button type="button" className="hrmo-reset" onClick={resetFilters}>Clear filters</button>
          </div>}
          <div className="hrmo-result-line"><span><strong>{filtered.length}</strong> of {activeCount} applications</span><span>Sorted by date submitted · newest first</span></div>
          {filtered.length ? <div className="hrmo-table-wrap">
            <table className="hrmo-table">
              <thead><tr><th scope="col">Applicant</th><th scope="col">Position</th><th scope="col">Office</th><th scope="col">Contract period</th><th scope="col">Status</th><th scope="col">Submitted</th><th scope="col">Action</th></tr></thead>
              <tbody>{filtered.map((app) => <tr key={app.ref}>
                <td><div className="hrmo-applicant"><div className="hrmo-avatar" aria-hidden="true">{app.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div><div className="hrmo-person-name">{app.name}</div><div className="hrmo-ref">{app.ref} · sample</div></div></div></td>
                <td><span className="hrmo-position">{app.position}</span></td><td><span className="hrmo-office">{app.office}</span></td><td><span className="hrmo-period">{app.period}</span></td><td><StatusTag stage={app.stage} /></td><td><span className="hrmo-submitted">{new Date(`${app.submitted}T12:00:00`).toLocaleDateString("en-PH", { day: "2-digit", month: "short", year: "numeric" })}</span></td>
                <td><div className="hrmo-row-actions">
                  <button type="button" className="hrmo-action" onClick={() => setSelected(app)} aria-label={`View ${app.name}`}><FileText size={13} />View</button>
                  {app.stage === "New Submissions" && <button type="button" className="hrmo-action hrmo-action--primary" onClick={() => updateStage(app, "For Review", `${app.name} moved to For Review.`)}>Review<ArrowRight size={13} /></button>}
                  {app.stage === "For Review" && <button type="button" className="hrmo-action" onClick={() => { setSelected(app); notify("Review workspace opened. Sensitive fields remain masked."); }}>Correct</button>}
                  {app.stage === "For Review" && <button type="button" className="hrmo-action hrmo-action--primary" onClick={() => updateStage(app, "Approved", `${app.name} marked approved.`)}><Check size={13} />Approve</button>}
                  {app.stage === "Approved" && <button type="button" className="hrmo-action hrmo-action--gold" onClick={() => updateStage(app, "Contracts Generated", `Contract packet marked ready for ${app.name}.`)}><FileCheck2 size={13} />Generate</button>}
                  {app.stage === "Contracts Generated" && <button type="button" className="hrmo-action" onClick={() => notify(`Download preview prepared for ${app.ref}. No document was generated.`)}><ArrowDownToLine size={13} />Download</button>}
                </div></td>
              </tr>)}</tbody>
            </table>
          </div> : <div className="hrmo-empty"><div className="hrmo-empty-mark"><Filter size={19} /></div><strong>No applications match</strong><span>Adjust the search or clear filters to see records in this stage.</span><button type="button" className="hrmo-action" style={{ marginTop: 13 }} onClick={resetFilters}>Clear all filters</button></div>}
        </section>
        <p className="hrmo-footer-note"><ShieldCheck size={15} /><span>Applicant identity and employment details are restricted to authorized HRMO staff. Government identifiers and personal contact information are not shown in this queue. Sample records are fictional.</span></p>
      </div>

      {selected && <div className="hrmo-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
        <aside className="hrmo-drawer" role="dialog" aria-modal="true" aria-labelledby="hrmo-detail-title">
          <div className="hrmo-drawer-head"><div><p className="hrmo-drawer-kicker">Renewal application · sample record</p><h2 id="hrmo-detail-title">{selected.name}</h2><div className="hrmo-drawer-ref">{selected.ref} · Oct–Dec 2026</div></div><button type="button" className="hrmo-drawer-close" aria-label="Close review panel" onClick={() => setSelected(null)}><X size={17} /></button></div>
          <div className="hrmo-drawer-body">
            <div className="hrmo-drawer-status-row"><div><div className="hrmo-detail-label">Current status</div><div style={{ marginTop: 7 }}><StatusTag stage={selected.stage} /></div></div><div style={{ textAlign: "right" }}><div className="hrmo-detail-label">Submitted</div><div className="hrmo-detail-date">{new Date(`${selected.submitted}T12:00:00`).toLocaleDateString("en-PH", { day: "2-digit", month: "long", year: "numeric" })}</div></div></div>
            <h3 className="hrmo-section-title"><ClipboardCheck size={15} />Employment details</h3>
            <div className="hrmo-detail-grid">
              <div className="hrmo-detail-item"><span>Position title</span><strong>{selected.position}</strong></div>
              <div className="hrmo-detail-item"><span>Office affiliation</span><strong>{selected.office}</strong></div>
              <div className="hrmo-detail-item"><span>Contract period</span><strong>01 Oct – 31 Dec 2026</strong></div>
              <div className="hrmo-detail-item"><span>Review reference</span><strong>{selected.ref}</strong></div>
              <div className="hrmo-detail-item"><span>Tax identification</span><strong>•••-•••-•••</strong></div>
              <div className="hrmo-detail-item"><span>Contact number</span><strong>+63 9•• ••• ••42</strong></div>
            </div>
            <div className="hrmo-privacy"><ShieldCheck size={14} /><span>Sensitive identifiers are masked in this preview. Open the secured source record only when required for verification.</span></div>
            <h3 className="hrmo-section-title"><FileText size={15} />HRMO review note</h3>
            <div className="hrmo-review-note">{selected.note}</div>
            <section className="hrmo-contract-box" aria-label="Contract generation step">
              <div className="hrmo-contract-top"><div className="hrmo-contract-icon"><FileCheck2 size={16} /></div><div><h3>Official contract preparation</h3><p>After approval, confirm mapped appointment details and sign-off routing before marking a contract packet ready.</p></div></div>
              <div className="hrmo-check-list">
                <div className="hrmo-check"><CheckCircle2 size={13} />Worker name, position and office mapped</div>
                <div className="hrmo-check"><CheckCircle2 size={13} />Contract dates and approved terms confirmed</div>
                <div className="hrmo-check"><Clock3 size={13} />Signature and funds-availability routing</div>
              </div>
              {selected.stage === "Approved" ? <div className="hrmo-contract-actions"><button type="button" className="hrmo-action hrmo-action--gold" onClick={() => updateStage(selected, "Contracts Generated", "Contract packet marked ready. This is a UI-only preview; no document was generated.")}><FileCheck2 size={14} />Mark packet ready</button><span style={{ alignSelf: "center", color: "#786c4d", fontSize: 9 }}>UI preview only · no file generated</span></div> : selected.stage === "Contracts Generated" ? <div className="hrmo-contract-actions"><button type="button" className="hrmo-action" onClick={() => notify(`Download preview prepared for ${selected.ref}. No document was generated.`)}><ArrowDownToLine size={14} />Download preview</button><span style={{ alignSelf: "center", color: "#786c4d", fontSize: 9 }}>DOCX / PDF output is not generated here</span></div> : null}
            </section>
            <div className="hrmo-drawer-actions">
              <button type="button" className="hrmo-action" onClick={() => notify("Correction view opened. Changes are not saved in this preview.")}>Edit / correct</button>
              {selected.stage === "New Submissions" && <button type="button" className="hrmo-action hrmo-action--primary" onClick={() => updateStage(selected, "For Review", "Application moved to For Review.")}>Move to review<ArrowRight size={14} /></button>}
              {selected.stage === "For Review" && <button type="button" className="hrmo-action hrmo-action--primary" onClick={() => updateStage(selected, "Approved", "Application marked approved.")}><Check size={14} />Approve renewal</button>}
              <button type="button" className="hrmo-action" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </aside>
      </div>}
      {toast && <div className="hrmo-toast" role="status"><CheckCircle2 size={16} />{toast}</div>}
    </main>
  );
}
