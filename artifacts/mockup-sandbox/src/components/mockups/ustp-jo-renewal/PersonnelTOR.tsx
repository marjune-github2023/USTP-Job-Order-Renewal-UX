import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  CircleHelp,
  FileCheck2,
  ListChecks,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";

type TorActivity = { id: string; text: string };
type TorFunction = { id: string; text: string; activities: TorActivity[] };
type TorSection = { id: string; title: string; weight: string; functions: TorFunction[] };

function createFunction(id: string, text: string, activityTexts: string[] = []): TorFunction {
  return {
    id,
    text,
    activities: activityTexts.map((activity, index) => ({
      id: `${id}-activity-${index + 1}`,
      text: activity,
    })),
  };
}

const INITIAL_SECTIONS: TorSection[] = [
  {
    id: "core-functions",
    title: "Core Functions",
    weight: "90",
    functions: [
      createFunction("internet-uptime", "90% Internet uptime (600MBPS+) Sustain Existing Internet", [
        "Subscription, Monitoring, Maintenance of Main line Internet Connection for the Campus (NEP).",
        "Subscription, Monitoring, Maintenance of Secondary line Internet Connection for the Campus (STF).",
        "Subscription, Monitoring, Maintenance of Satellite Internet Connection for the Campus.",
      ]),
      createFunction("ict-service-requests", "90% Processed ICT service request for repair and maintenance.", [
        "Preventive maintenance to all ICT equipment in the campus including installation and connectivity.",
        "Purchase of ICT Supplies, Materials, Equipment and connectivity.",
        "Upgrading of ICT Computers, Equipment and Connectivity.",
        "Technical Support (Repair and Maintain) printers, computers and connectivity in the campus.",
      ]),
      createFunction("id-printing", "ID Printing for Clientele Services", [
        "Provide/Printed Campus ID to students, faculty staff and admin officials.",
      ]),
      createFunction("office-supplies", "Acquired office supplies/equipment/furniture/materials.", [
        "Acquired office supplies/equipment/furniture/materials.",
      ]),
      createFunction("learning-development", "90% of Personnel attended/participated in Learning and Development activities", [
        "Attended/participated in Learning and Development activities.",
        "Attendance/Participation on Trainings/Seminars/Workshops.",
        "Attendance/Participation on Administrative Meetings and Special Meeting.",
      ]),
      createFunction("campus-promotion", "Equipment and Materials for Campus promotion and advertising", [
        "Purchase of Equipment/Materials for Campus promotion and advertising.",
      ]),
      createFunction("annual-report", "Annual Report submitted to appropriate PME Office on time", [
        "Submit Annual Report to the appropriate PME Office on time.",
      ]),
      createFunction("semi-annual-report", "Semi-Annual Report submitted to appropriate PME Office on time", [
        "Submit Semi-Annual Report to the appropriate PME Office on time.",
      ]),
      createFunction("quality-findings", "100% Compliance with Internal Quality Findings (if any)", [
        "Comply with internal quality audit findings (if any).",
      ]),
      createFunction("client-ratings", "80% of clients rated the services of the office at least above average (3.41-4.20)", [
        "Provide rating forms to clients.",
      ]),
    ],
  },
  {
    id: "mandatory-support",
    title: "Mandatory Support Functions",
    weight: "10",
    functions: [
      createFunction("accreditation-documents", "100% documents needed for accreditation given to task force on time.", [
        "Submit documents to the Accreditation Office on time (if any).",
      ]),
      createFunction("general-assembly", "100% attendance to General Assembly", [
        "Attendance to General Assembly.",
      ]),
      createFunction("dtrs-submission", "100% DTRS submitted on time", [
        "Submit DTRS on time.",
      ]),
    ],
  },
];

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function alphaLabel(index: number) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(97 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function StepBadge({ number, label, status }: { number: number; label: string; status: "complete" | "current" | "upcoming" }) {
  return (
    <div className={`tor-step tor-step-${status}`} aria-current={status === "current" ? "step" : undefined}>
      <span className="tor-step-number">
        {status === "complete" ? <Check aria-hidden="true" /> : String(number).padStart(2, "0")}
      </span>
      <span className="tor-step-label">{label}</span>
    </div>
  );
}

export function PersonnelTOR() {
  const [sections, setSections] = useState<TorSection[]>(INITIAL_SECTIONS);
  const [numberingPrefix, setNumberingPrefix] = useState("2");
  const [notice, setNotice] = useState("");
  const numberingBase = Math.max(1, Math.floor(Number(numberingPrefix) || 1));

  const totals = useMemo(() => {
    const functions = sections.reduce((sum, section) => sum + section.functions.length, 0);
    const activities = sections.reduce(
      (sum, section) => sum + section.functions.reduce((inner, item) => inner + item.activities.length, 0),
      0,
    );
    const descriptions = sections.flatMap((section) =>
      section.functions.flatMap((item) => [item.text, ...item.activities.map((activity) => activity.text)]),
    );
    const completed = descriptions.filter((text) => text.trim()).length;
    return {
      functions,
      activities,
      descriptions: descriptions.length,
      completed,
      numberedLines: sections.length + functions + activities,
      percent: descriptions.length ? Math.round((completed / descriptions.length) * 100) : 0,
    };
  }, [sections]);

  const sectionNumber = (sectionIndex: number) => `${numberingBase}.${sectionIndex + 1}`;
  const functionNumber = (sectionIndex: number, functionIndex: number) =>
    `${sectionNumber(sectionIndex)}.${functionIndex + 1}`;
  const activityNumber = (sectionIndex: number, functionIndex: number, activityIndex: number) =>
    `${functionNumber(sectionIndex, functionIndex)}.${alphaLabel(activityIndex)}`;
  const sectionHeading = (section: TorSection) =>
    `${section.title.trim() || "Untitled section"}${section.weight.trim() ? ` (${section.weight.trim()}%)` : ""}`;

  const updateSection = (sectionId: string, changes: Partial<TorSection>) => {
    setSections((previous) => previous.map((section) => section.id === sectionId ? { ...section, ...changes } : section));
    setNotice("Numbered preview updated · not stored");
  };

  const updateFunction = (sectionId: string, functionId: string, text: string) => {
    setSections((previous) => previous.map((section) => section.id !== sectionId ? section : {
      ...section,
      functions: section.functions.map((item) => item.id === functionId ? { ...item, text } : item),
    }));
    setNotice("Numbered preview updated · not stored");
  };

  const updateActivity = (sectionId: string, functionId: string, activityId: string, text: string) => {
    setSections((previous) => previous.map((section) => section.id !== sectionId ? section : {
      ...section,
      functions: section.functions.map((item) => item.id !== functionId ? item : {
        ...item,
        activities: item.activities.map((activity) => activity.id === activityId ? { ...activity, text } : activity),
      }),
    }));
    setNotice("Numbered preview updated · not stored");
  };

  const addSection = () => {
    const section: TorSection = {
      id: makeId("section"),
      title: "New section",
      weight: "",
      functions: [createFunction(makeId("function"), "", [])],
    };
    setSections((previous) => [...previous, section]);
    setNotice("New section added · numbering updated");
  };

  const addFunction = (sectionId: string) => {
    const item = createFunction(makeId("function"), "", []);
    setSections((previous) => previous.map((section) => section.id !== sectionId ? section : {
      ...section,
      functions: [...section.functions, item],
    }));
    setNotice("New function added · numbering updated");
  };

  const addActivity = (sectionId: string, functionId: string) => {
    const activity = { id: makeId("activity"), text: "" };
    setSections((previous) => previous.map((section) => section.id !== sectionId ? section : {
      ...section,
      functions: section.functions.map((item) => item.id !== functionId ? item : {
        ...item,
        activities: [...item.activities, activity],
      }),
    }));
    setNotice("New activity added · numbering updated");
  };

  const removeSection = (sectionId: string) => {
    const index = sections.findIndex((section) => section.id === sectionId);
    const section = sections[index];
    if (!section) return;
    const nestedCount = section.functions.reduce((sum, item) => sum + 1 + item.activities.length, 0);
    if (!window.confirm(`Remove ${sectionNumber(index)} ${sectionHeading(section)} and its ${nestedCount} numbered entries? Remaining sections will be renumbered.`)) return;
    setSections((previous) => previous.filter((item) => item.id !== sectionId));
    setNotice("Section removed · remaining entries renumbered");
  };

  const removeFunction = (sectionId: string, functionId: string) => {
    const sectionIndex = sections.findIndex((section) => section.id === sectionId);
    const section = sections[sectionIndex];
    const functionIndex = section?.functions.findIndex((item) => item.id === functionId) ?? -1;
    const item = section?.functions[functionIndex];
    if (!section || !item) return;
    if (!window.confirm(`Remove ${functionNumber(sectionIndex, functionIndex)} and its ${item.activities.length} activities? Remaining entries will be renumbered.`)) return;
    setSections((previous) => previous.map((current) => current.id !== sectionId ? current : {
      ...current,
      functions: current.functions.filter((functionItem) => functionItem.id !== functionId),
    }));
    setNotice("Function removed · remaining entries renumbered");
  };

  const removeActivity = (sectionId: string, functionId: string, activityId: string) => {
    const sectionIndex = sections.findIndex((section) => section.id === sectionId);
    const section = sections[sectionIndex];
    const functionIndex = section?.functions.findIndex((item) => item.id === functionId) ?? -1;
    const item = section?.functions[functionIndex];
    const activityIndex = item?.activities.findIndex((activity) => activity.id === activityId) ?? -1;
    if (!section || !item || activityIndex < 0) return;
    if (!window.confirm(`Remove item ${activityNumber(sectionIndex, functionIndex, activityIndex)}? Later letter numbers will update.`)) return;
    setSections((previous) => previous.map((current) => current.id !== sectionId ? current : {
      ...current,
      functions: current.functions.map((functionItem) => functionItem.id !== functionId ? functionItem : {
        ...functionItem,
        activities: functionItem.activities.filter((activity) => activity.id !== activityId),
      }),
    }));
    setNotice("Activity removed · remaining entries renumbered");
  };

  const handleContinue = () => {
    const incomplete = totals.descriptions - totals.completed;
    setNotice(incomplete
      ? `Add a description to ${incomplete} empty ${incomplete === 1 ? "entry" : "entries"} or remove those rows before continuing.`
      : "All TOR descriptions are included in the numbered preview. This prototype does not submit your application.");
  };

  return (
    <main className="tor-page">
      <style>{`
        .tor-page {
          --tor-navy: #123857;
          --tor-navy-deep: #0b2c47;
          --tor-blue: #285578;
          --tor-gold: #b58b3d;
          --tor-gold-pale: #f3ead7;
          --tor-paper: #f4f3ed;
          --tor-white: #fffefa;
          --tor-ink: #203746;
          --tor-muted: #61717b;
          --tor-line: #d6dcd9;
          --tor-soft-line: #e8e9e3;
          min-height: 100dvh;
          color: var(--tor-ink);
          background: var(--tor-paper);
          font-family: "Source Sans 3", "Segoe UI", sans-serif;
          font-size: 15px;
          line-height: 1.5;
        }
        .tor-page * { box-sizing: border-box; }
        .tor-page button, .tor-page textarea { font: inherit; }
        .tor-page button { cursor: pointer; }
        .tor-page button:focus-visible, .tor-page textarea:focus-visible {
          outline: 3px solid #c89a46;
          outline-offset: 3px;
        }
        .tor-shell { width: min(1320px, 100%); margin: 0 auto; padding: 0 34px 42px; }
        .tor-masthead {
          min-height: 84px; display: flex; align-items: center; justify-content: space-between;
          gap: 22px; border-bottom: 1px solid #cbd2d0;
        }
        .tor-brand { display: flex; align-items: center; gap: 15px; min-width: 0; }
        .tor-brand-mark {
          width: 45px; height: 45px; display: grid; place-items: center; flex: 0 0 auto;
          color: var(--tor-navy); border: 1px solid #9eacb2; background: #f8f7f0;
          font: 700 11px/1.1 Georgia, serif; letter-spacing: .08em; text-align: center;
        }
        .tor-brand-mark span { display: block; font-size: 8px; font-weight: 500; letter-spacing: .06em; }
        .tor-brand-copy { min-width: 0; }
        .tor-brand-university { color: var(--tor-navy-deep); font: 600 18px/1.15 Georgia, "Times New Roman", serif; letter-spacing: -.015em; }
        .tor-brand-campus { margin-top: 4px; color: #687780; font-size: 11px; letter-spacing: .11em; text-transform: uppercase; }
        .tor-head-meta { display: flex; align-items: center; gap: 18px; }
        .tor-period { padding-right: 18px; border-right: 1px solid #ccd3d2; text-align: right; }
        .tor-meta-kicker { color: #697981; font-size: 10px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; }
        .tor-period-value { margin-top: 3px; color: var(--tor-navy); font-size: 13px; font-weight: 650; }
        .tor-hrmo { display: flex; align-items: center; gap: 8px; color: #35556b; font-size: 12px; font-weight: 700; letter-spacing: .04em; }
        .tor-hrmo svg { width: 16px; height: 16px; color: var(--tor-gold); }
        .tor-breadcrumb { display: flex; align-items: center; gap: 9px; margin: 22px 0 10px; color: #62727b; font-size: 12px; }
        .tor-breadcrumb strong { color: var(--tor-navy); font-weight: 700; }
        .tor-breadcrumb-sep { color: #9aa5a8; }
        .tor-intro { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding-bottom: 22px; }
        .tor-overline { display: flex; align-items: center; gap: 9px; color: #8b6b2e; font-size: 11px; font-weight: 750; letter-spacing: .13em; text-transform: uppercase; }
        .tor-overline::before { content: ""; width: 22px; height: 2px; background: var(--tor-gold); }
        .tor-title { margin: 8px 0 5px; color: var(--tor-navy-deep); font: 500 clamp(30px, 4vw, 42px)/1.08 Georgia, "Times New Roman", serif; letter-spacing: -.035em; }
        .tor-subtitle { margin: 0; max-width: 650px; color: #5c6b73; font-size: 14px; }
        .tor-status-pill {
          display: flex; align-items: center; gap: 8px; white-space: nowrap; margin-bottom: 5px;
          padding: 8px 11px; border: 1px solid #c9d2d2; background: #f9f9f4; color: #36576a;
          font-size: 11px; font-weight: 700; letter-spacing: .02em;
        }
        .tor-status-pill { max-width: 370px; white-space: normal; line-height: 1.35; }
        .tor-status-pill svg { width: 15px; height: 15px; color: #64826f; }
        .tor-progress-shell { margin: 0 0 22px; padding: 17px 20px 14px; background: var(--tor-white); border: 1px solid var(--tor-line); }
        .tor-progress-heading { display: flex; align-items: center; justify-content: space-between; gap: 15px; margin-bottom: 13px; }
        .tor-progress-heading strong { color: var(--tor-navy-deep); font-size: 13px; }
        .tor-progress-heading span { color: #62727b; font-size: 12px; }
        .tor-progress-heading b { color: var(--tor-navy); }
        .tor-step-track { display: flex; align-items: flex-start; width: 100%; }
        .tor-step {
          position: relative; display: flex; align-items: center; gap: 8px; min-width: 0;
          padding-right: 18px; flex: 1; color: #88949a; font-size: 11px;
        }
        .tor-step:not(:last-child)::after {
          content: ""; position: absolute; height: 1px; top: 14px; left: 39px; right: 9px;
          background: #d9dfde;
        }
        .tor-step-number {
          z-index: 1; width: 28px; height: 28px; display: grid; place-items: center; flex: 0 0 auto;
          border: 1px solid #cbd2d2; border-radius: 50%; background: var(--tor-white);
          color: #73828a; font-size: 10px; font-weight: 700;
        }
        .tor-step-number svg { width: 13px; height: 13px; }
        .tor-step-label { padding-top: 1px; white-space: nowrap; }
        .tor-step-complete { color: #486879; }
        .tor-step-complete .tor-step-number { border-color: #76948a; background: #eef3ef; color: #426c59; }
        .tor-step-current { color: var(--tor-navy); font-weight: 750; }
        .tor-step-current .tor-step-number { border: 2px solid var(--tor-navy); color: var(--tor-navy); }
        .tor-step-upcoming .tor-step-label { color: #8a969b; }
        .tor-content-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(320px, .82fr); gap: 20px; align-items: start; }
        .tor-workspace, .tor-output-panel { min-width: 0; background: var(--tor-white); border: 1px solid var(--tor-line); }
        .tor-workspace-header, .tor-output-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 17px 19px; border-bottom: 1px solid var(--tor-soft-line); }
        .tor-workspace-title, .tor-output-title { margin: 0; color: var(--tor-navy-deep); font-size: 15px; font-weight: 750; }
        .tor-workspace-subtitle, .tor-output-subtitle { margin: 3px 0 0; color: #758188; font-size: 11px; }
        .tor-config-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 14px 19px; background: #f8f8f3; border-bottom: 1px solid var(--tor-soft-line); }
        .tor-numbering-setting { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .tor-numbering-setting label { color: #425762; font-size: 11px; font-weight: 700; }
        .tor-numbering-setting input { width: 66px; min-height: 35px; padding: 5px 8px; border: 1px solid #bdc8ca; color: var(--tor-navy); background: white; font-weight: 700; }
        .tor-numbering-example { color: #758188; font-size: 10px; }
        .tor-counts { display: flex; align-items: center; gap: 16px; color: #65747b; font-size: 11px; }
        .tor-counts b { color: var(--tor-navy); font-variant-numeric: tabular-nums; }
        .tor-sections { display: grid; gap: 14px; padding: 16px; }
        .tor-section-card { border: 1px solid #d9dfdb; background: #fffefa; }
        .tor-section-header { display: grid; grid-template-columns: 40px minmax(0, 1fr) 84px 36px; align-items: end; gap: 12px; padding: 15px; background: #f6f6f0; border-bottom: 1px solid #e3e6df; }
        .tor-section-number, .tor-line-number {
          display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto;
          min-width: 38px; min-height: 32px; padding: 0 6px; color: var(--tor-navy);
          background: #eaf0ef; border: 1px solid #d4dfdb; font-size: 11px; font-weight: 800;
          font-variant-numeric: tabular-nums; white-space: nowrap;
        }
        .tor-field-label { display: block; min-width: 0; color: #52646d; font-size: 10px; font-weight: 750; letter-spacing: .05em; text-transform: uppercase; }
        .tor-field-input, .tor-field-textarea {
          display: block; width: 100%; margin-top: 5px; border: 1px solid #bdc8ca; border-radius: 0;
          color: #233e50; background: #fffefa; font: inherit; font-size: 12px; line-height: 1.5;
        }
        .tor-field-input { min-height: 38px; padding: 8px 10px; }
        .tor-field-textarea { min-height: 58px; padding: 9px 10px; resize: vertical; }
        .tor-field-input:focus, .tor-field-textarea:focus, .tor-numbering-setting input:focus { border-color: var(--tor-blue); outline: 2px solid #b6ccd0; outline-offset: 1px; }
        .tor-weight-field input { text-align: center; font-variant-numeric: tabular-nums; }
        .tor-icon-button {
          display: inline-grid; place-items: center; width: 36px; height: 36px; padding: 0;
          color: #718087; background: transparent; border: 1px solid transparent;
        }
        .tor-icon-button:hover { color: #963f35; background: #faf0ed; border-color: #ead4ce; }
        .tor-icon-button svg { width: 15px; height: 15px; }
        .tor-functions { display: grid; gap: 10px; padding: 13px; }
        .tor-function-card { padding: 12px; border: 1px solid #e0e5df; background: #fff; }
        .tor-function-row { display: grid; grid-template-columns: max-content minmax(0, 1fr) 36px; align-items: start; gap: 10px; }
        .tor-function-row .tor-line-number { margin-top: 20px; }
        .tor-nested-activities { display: grid; gap: 7px; margin: 11px 0 0 17px; padding-left: 15px; border-left: 2px solid #e6e8df; }
        .tor-activity-row { display: grid; grid-template-columns: max-content minmax(0, 1fr) 36px; align-items: center; gap: 8px; }
        .tor-activity-number { color: #8a6b31; font-size: 10px; font-weight: 750; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .tor-activity-row .tor-field-input, .tor-activity-row .tor-field-textarea { margin-top: 0; min-height: 42px; }
        .tor-activity-row .tor-activity-input { padding: 6px 8px; resize: vertical; }
        .tor-activity-row .tor-icon-button { width: 36px; height: 36px; }
        .tor-add-inline, .tor-add-section {
          display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 37px;
          padding: 0 11px; color: #31556d; background: #fffefa; border: 1px solid #bdc8ca;
          font-size: 11px; font-weight: 700; transition: background .15s ease, border-color .15s ease;
        }
        .tor-add-inline { justify-self: start; margin: 3px 0 0; min-height: 37px; }
        .tor-add-inline:hover, .tor-add-section:hover { background: #f0f4f1; border-color: #859ba1; }
        .tor-add-inline svg, .tor-add-section svg { width: 14px; height: 14px; }
        .tor-add-function { margin: 1px 0 0; }
        .tor-button {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 42px;
          padding: 0 14px; border: 1px solid #bdc8ca; border-radius: 0; background: transparent;
          color: #385365; font-size: 12px; font-weight: 700; transition: background .15s ease, border-color .15s ease;
        }
        .tor-button svg { width: 15px; height: 15px; }
        .tor-button-secondary { background: var(--tor-white); }
        .tor-button-secondary:hover { background: #f1f3ef; border-color: #8399a2; }
        .tor-button-primary { border-color: var(--tor-navy); background: var(--tor-navy); color: white; }
        .tor-button-primary:hover { background: #204a69; border-color: #204a69; }
        .tor-button:disabled { opacity: .45; cursor: not-allowed; }
        .tor-output-panel { position: sticky; top: 14px; }
        .tor-output-header { align-items: flex-start; }
        .tor-output-heading { display: flex; align-items: center; gap: 9px; }
        .tor-output-heading svg { width: 18px; height: 18px; color: var(--tor-gold); }
        .tor-output-count { flex: 0 0 auto; padding: 5px 8px; border: 1px solid #dce2dd; background: #f2f4f0; color: #50646c; font-size: 10px; font-weight: 700; }
        .tor-output-content { max-height: min(67vh, 700px); overflow: auto; padding: 18px 20px 22px; }
        .tor-output-section + .tor-output-section { margin-top: 19px; padding-top: 16px; border-top: 1px solid #dfe4de; }
        .tor-output-section h3 { display: flex; align-items: baseline; gap: 8px; margin: 0 0 12px; color: var(--tor-navy-deep); font-size: 13px; line-height: 1.45; }
        .tor-output-section h3 code, .tor-output-function code, .tor-output-activity code { color: #8a6b31; font: 700 10px/1.4 "Source Sans 3", "Segoe UI", sans-serif; white-space: nowrap; }
        .tor-output-function { display: grid; grid-template-columns: 47px minmax(0, 1fr); gap: 7px; margin-top: 10px; color: #314753; font-size: 11px; line-height: 1.5; }
        .tor-output-function > code { color: var(--tor-navy); }
        .tor-output-activity-list { display: grid; gap: 6px; margin: 7px 0 0 16px; padding-left: 11px; border-left: 1px solid #e1e5df; }
        .tor-output-activity { display: grid; grid-template-columns: 53px minmax(0, 1fr); gap: 6px; color: #596a71; font-size: 10px; line-height: 1.5; }
        .tor-output-activity code { color: #947639; font-size: 9px; }
        .tor-output-empty { color: #9b8c69; font-style: italic; }
        .tor-empty-state { padding: 22px; color: #6f7b80; font-size: 12px; text-align: center; }
        .tor-message { display: flex; align-items: flex-start; gap: 8px; margin: 0 16px 16px; padding: 10px 12px; border-left: 3px solid #78917c; background: #f0f4ee; color: #3f624d; font-size: 11px; }
        .tor-message svg { width: 15px; height: 15px; flex: 0 0 auto; margin-top: 1px; }
        .tor-bottom-row { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-top: 16px; padding: 14px 16px; border: 1px solid #e0d9c7; background: #f8f6ef; }
        .tor-privacy { display: flex; align-items: flex-start; gap: 9px; color: #69777d; font-size: 11px; line-height: 1.4; }
        .tor-privacy svg { width: 17px; height: 17px; flex: 0 0 auto; color: #56766c; }
        .tor-privacy strong { color: #425762; font-weight: 700; }
        .tor-review-actions { display: flex; gap: 8px; }
        .tor-mobile-stepper { display: none; }
        @media (max-width: 980px) {
          .tor-shell { padding-right: 22px; padding-left: 22px; }
          .tor-content-grid { grid-template-columns: minmax(0, 1fr) minmax(280px, .8fr); gap: 14px; }
          .tor-workspace-header, .tor-output-header { padding: 14px; }
          .tor-config-row { padding: 12px 14px; }
          .tor-sections { padding: 12px; }
        }
        @media (max-width: 760px) {
          .tor-content-grid { grid-template-columns: minmax(0, 1fr); }
          .tor-output-panel { position: static; }
          .tor-output-content { max-height: 440px; }
        }
        @media (max-width: 680px) {
          .tor-page { font-size: 14px; }
          .tor-shell { padding: 0 16px 26px; }
          .tor-masthead { min-height: 72px; }
          .tor-brand { gap: 10px; }
          .tor-brand-mark { width: 39px; height: 39px; font-size: 10px; }
          .tor-brand-university { font-size: 15px; }
          .tor-brand-campus { font-size: 9px; letter-spacing: .08em; }
          .tor-head-meta { gap: 0; }
          .tor-period { padding-right: 0; border: 0; }
          .tor-meta-kicker { font-size: 9px; }
          .tor-period-value { font-size: 11px; }
          .tor-hrmo { display: none; }
          .tor-breadcrumb { margin-top: 17px; font-size: 11px; }
          .tor-intro { display: block; padding-bottom: 16px; }
          .tor-title { font-size: 32px; }
          .tor-subtitle { font-size: 13px; }
          .tor-status-pill { width: fit-content; margin: 13px 0 0; padding: 6px 9px; white-space: normal; }
          .tor-progress-shell { padding: 14px 13px 12px; margin-bottom: 14px; }
          .tor-progress-heading { margin-bottom: 10px; }
          .tor-progress-heading strong { font-size: 12px; }
          .tor-progress-heading span { font-size: 11px; }
          .tor-step-track { display: none; }
          .tor-mobile-stepper { display: block; }
          .tor-mobile-bar { height: 5px; background: #e4e8e4; }
          .tor-mobile-bar span { display: block; height: 100%; background: var(--tor-navy); }
          .tor-mobile-captions { display: flex; justify-content: space-between; margin-top: 7px; color: #708087; font-size: 10px; }
          .tor-mobile-captions strong { color: var(--tor-navy); }
          .tor-workspace-header { align-items: flex-start; flex-direction: column; }
          .tor-workspace-header .tor-button { width: 100%; }
          .tor-config-row { align-items: flex-start; flex-direction: column; gap: 8px; }
          .tor-numbering-setting { align-items: flex-start; flex-wrap: wrap; }
          .tor-numbering-setting label { align-self: center; }
          .tor-counts { gap: 12px; flex-wrap: wrap; }
          .tor-section-header { grid-template-columns: 36px minmax(0, 1fr) 36px; gap: 8px; padding: 11px; }
          .tor-section-number { grid-column: 1; grid-row: 1 / span 2; align-self: center; min-width: 34px; }
          .tor-section-title-field { grid-column: 2; }
          .tor-weight-field { grid-column: 2; grid-row: 2; }
          .tor-section-remove { grid-column: 3; grid-row: 1 / span 2; align-self: center; }
          .tor-functions { padding: 9px; }
          .tor-function-card { padding: 9px; }
          .tor-function-row { grid-template-columns: max-content minmax(0, 1fr) 36px; gap: 7px; }
          .tor-function-row .tor-line-number { min-width: 40px; margin-top: 20px; font-size: 10px; }
          .tor-nested-activities { margin-left: 10px; padding-left: 9px; }
          .tor-activity-row { grid-template-columns: max-content minmax(0, 1fr) 36px; gap: 5px; }
          .tor-activity-number { font-size: 10px; }
          .tor-add-inline { padding: 0 8px; font-size: 10px; }
          .tor-add-function { margin-left: 0; }
          .tor-output-header { padding: 13px; }
          .tor-output-content { max-height: 380px; padding: 14px; }
          .tor-bottom-row { align-items: stretch; flex-direction: column; gap: 12px; margin-top: 12px; padding: 12px; }
          .tor-review-actions { display: grid; grid-template-columns: 1fr; }
          .tor-button { min-height: 45px; width: 100%; }
        }
        @media (max-width: 370px) {
          .tor-shell { padding-right: 12px; padding-left: 12px; }
          .tor-brand-campus { letter-spacing: .04em; }
          .tor-period-value { font-size: 10px; }
          .tor-function-row { grid-template-columns: max-content minmax(0, 1fr) 36px; gap: 5px; }
          .tor-function-row .tor-line-number { min-width: 37px; padding: 0 3px; font-size: 9px; }
          .tor-activity-row { grid-template-columns: max-content minmax(0, 1fr) 36px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tor-page *, .tor-page *::before, .tor-page *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; }
        }
      `}</style>

      <div className="tor-shell">
        <header className="tor-masthead">
          <div className="tor-brand">
            <div className="tor-brand-mark" aria-label="Text logo placeholder">
              USTP
              <span>TEXT MARK</span>
            </div>
            <div className="tor-brand-copy">
              <div className="tor-brand-university">University of Science and Technology<br className="tor-brand-break" /> of Southern Philippines</div>
              <div className="tor-brand-campus">Claveria Campus · Job Order Renewal</div>
            </div>
          </div>
          <div className="tor-head-meta">
            <div className="tor-period">
              <div className="tor-meta-kicker">Renewal period</div>
              <div className="tor-period-value">October – December 2026</div>
            </div>
            <div className="tor-hrmo"><ShieldCheck aria-hidden="true" /> HRMO SERVICE</div>
          </div>
        </header>

        <div className="tor-breadcrumb" aria-label="Breadcrumb">
          <span>Renewal application</span><span className="tor-breadcrumb-sep">/</span>
          <span>Step 04</span><span className="tor-breadcrumb-sep">/</span><strong>Terms of Reference</strong>
        </div>

        <section className="tor-intro" aria-labelledby="tor-main-title">
          <div>
            <div className="tor-overline">Existing Job Order personnel</div>
            <h1 className="tor-title" id="tor-main-title">Build your Terms of Reference</h1>
            <p className="tor-subtitle">Add as many functions and activities as your role requires. They will be collected into one numbered TOR preview.</p>
          </div>
          <div className="tor-status-pill" role="status" aria-live="polite">
            <Save aria-hidden="true" /> {notice || "Live numbering · preview only"}
          </div>
        </section>

        <section className="tor-progress-shell" aria-label="Application progress">
          <div className="tor-progress-heading">
            <strong>Renewal application</strong>
            <span><b>Step 4 of 8</b> · Terms of Reference</span>
          </div>
          <div className="tor-step-track">
            <StepBadge number={1} label="Personal" status="complete" />
            <StepBadge number={2} label="Education" status="complete" />
            <StepBadge number={3} label="Contract" status="complete" />
            <StepBadge number={4} label="TOR" status="current" />
            <StepBadge number={5} label="Compensation" status="upcoming" />
            <StepBadge number={6} label="Contact" status="upcoming" />
            <StepBadge number={7} label="Office" status="upcoming" />
            <StepBadge number={8} label="Review" status="upcoming" />
          </div>
          <div className="tor-mobile-stepper" aria-label="Step 4 of 8">
            <div className="tor-mobile-bar"><span style={{ width: "50%" }} /></div>
            <div className="tor-mobile-captions"><span>Step 4 of 8</span><strong>Terms of Reference</strong></div>
          </div>
        </section>

        <div className="tor-content-grid">
          <section className="tor-workspace" aria-labelledby="tor-workspace-title">
            <div className="tor-workspace-header">
              <div>
                <h2 className="tor-workspace-title" id="tor-workspace-title">TOR structure</h2>
                <p className="tor-workspace-subtitle">Edit the text, then add or remove rows to match the role.</p>
              </div>
              <button type="button" className="tor-button tor-button-primary" onClick={addSection}>
                <Plus aria-hidden="true" /> Add section
              </button>
            </div>
            <div className="tor-config-row">
              <div className="tor-numbering-setting">
                <label htmlFor="tor-numbering-prefix">Numbering prefix</label>
                <input
                  id="tor-numbering-prefix"
                  type="number"
                  min="1"
                  step="1"
                  value={numberingPrefix}
                  onChange={(event) => {
                    setNumberingPrefix(event.target.value);
                    setNotice("Numbered preview updated · not stored");
                  }}
                />
                <span className="tor-numbering-example">Example: {numberingBase}.1 → {numberingBase}.1.1 → {numberingBase}.1.1.a</span>
              </div>
              <div className="tor-counts" aria-label={`${sections.length} sections and ${totals.numberedLines} numbered lines`}>
                <span><b>{sections.length}</b> sections</span>
                <span><b>{totals.numberedLines}</b> numbered lines</span>
                <span><b>{totals.completed}/{totals.descriptions}</b> descriptions</span>
              </div>
            </div>

            <div className="tor-sections">
              {sections.length === 0 && (
                <div className="tor-empty-state">No sections yet. Add a section to begin building the numbered TOR.</div>
              )}
              {sections.map((section, sectionIndex) => (
                <article className="tor-section-card" key={section.id}>
                  <div className="tor-section-header">
                    <span className="tor-section-number" aria-label={`Section ${sectionNumber(sectionIndex)}`}>
                      {sectionNumber(sectionIndex)}
                    </span>
                    <label className="tor-field-label tor-section-title-field" htmlFor={`section-title-${section.id}`}>
                      Section title
                      <input
                        id={`section-title-${section.id}`}
                        className="tor-field-input"
                        value={section.title}
                        onChange={(event) => updateSection(section.id, { title: event.target.value })}
                        placeholder="e.g. Core Functions"
                        maxLength={160}
                      />
                    </label>
                    <label className="tor-field-label tor-weight-field" htmlFor={`section-weight-${section.id}`}>
                      Weight (%)
                      <input
                        id={`section-weight-${section.id}`}
                        className="tor-field-input"
                        type="number"
                        min="0"
                        max="100"
                        value={section.weight}
                        onChange={(event) => updateSection(section.id, { weight: event.target.value })}
                        placeholder="—"
                      />
                    </label>
                    <button
                      type="button"
                      className="tor-icon-button tor-section-remove"
                      onClick={() => removeSection(section.id)}
                      aria-label={`Remove section ${sectionNumber(sectionIndex)} and its entries`}
                      title="Remove section and its nested entries"
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </div>

                  <div className="tor-functions">
                    {section.functions.length === 0 && (
                      <p className="tor-empty-state">No functions in this section yet. Add one below.</p>
                    )}
                    {section.functions.map((item, functionIndex) => (
                      <div className="tor-function-card" key={item.id}>
                        <div className="tor-function-row">
                          <span className="tor-line-number" aria-label={`TOR ${functionNumber(sectionIndex, functionIndex)}`}>
                            {functionNumber(sectionIndex, functionIndex)}
                          </span>
                          <label className="tor-field-label" htmlFor={`function-${item.id}`}>
                            Function {functionNumber(sectionIndex, functionIndex)}
                            <textarea
                              id={`function-${item.id}`}
                              className="tor-field-textarea"
                              value={item.text}
                              onChange={(event) => updateFunction(section.id, item.id, event.target.value)}
                              placeholder="Describe a key function or expected result."
                              maxLength={800}
                              rows={2}
                            />
                          </label>
                          <button
                            type="button"
                            className="tor-icon-button"
                            onClick={() => removeFunction(section.id, item.id)}
                            aria-label={`Remove function ${functionNumber(sectionIndex, functionIndex)} and its activities`}
                            title="Remove function and nested activities"
                          >
                            <Trash2 aria-hidden="true" />
                          </button>
                        </div>

                        <div className="tor-nested-activities" aria-label={`Activities under ${functionNumber(sectionIndex, functionIndex)}`}>
                          {item.activities.map((activity, activityIndex) => {
                            const number = activityNumber(sectionIndex, functionIndex, activityIndex);
                            return (
                              <div className="tor-activity-row" key={activity.id}>
                                <span className="tor-activity-number" aria-label={`TOR ${number}`}>{number}</span>
                                <textarea
                                  className="tor-field-textarea tor-activity-input"
                                  value={activity.text}
                                  onChange={(event) => updateActivity(section.id, item.id, activity.id, event.target.value)}
                                  placeholder={`Describe activity ${number}`}
                                  aria-label={`Description for TOR ${number}`}
                                  maxLength={800}
                                  rows={2}
                                />
                                <button
                                  type="button"
                                  className="tor-icon-button"
                                  onClick={() => removeActivity(section.id, item.id, activity.id)}
                                  aria-label={`Remove activity ${number}`}
                                  title="Remove activity"
                                >
                                  <Trash2 aria-hidden="true" />
                                </button>
                              </div>
                            );
                          })}
                          <button type="button" className="tor-add-inline" onClick={() => addActivity(section.id, item.id)}>
                            <Plus aria-hidden="true" /> Add activity
                          </button>
                        </div>
                      </div>
                    ))}
                    <button type="button" className="tor-add-inline tor-add-function" onClick={() => addFunction(section.id)}>
                      <Plus aria-hidden="true" /> Add function
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="tor-output-panel" aria-labelledby="tor-output-title">
            <div className="tor-output-header">
              <div>
                <div className="tor-output-heading">
                  <ListChecks aria-hidden="true" />
                  <h2 className="tor-output-title" id="tor-output-title">Numbered TOR output</h2>
                </div>
                <p className="tor-output-subtitle">All sections and entries, collected in order.</p>
              </div>
              <span className="tor-output-count">{totals.numberedLines} lines</span>
            </div>
            <div className="tor-output-content">
              {sections.length === 0 && (
                <div className="tor-empty-state">Your numbered output will appear here when you add a section.</div>
              )}
              {sections.map((section, sectionIndex) => (
                <section className="tor-output-section" key={section.id}>
                  <h3>
                    <code>{sectionNumber(sectionIndex)}</code>
                    <span>{sectionHeading(section)}</span>
                  </h3>
                  {section.functions.map((item, functionIndex) => (
                    <div key={item.id}>
                      <div className="tor-output-function">
                        <code>{functionNumber(sectionIndex, functionIndex)}</code>
                        <span className={item.text.trim() ? "" : "tor-output-empty"}>
                          {item.text.trim() || "Add a function description"}
                        </span>
                      </div>
                      {item.activities.length > 0 && (
                        <div className="tor-output-activity-list">
                          {item.activities.map((activity, activityIndex) => (
                            <div className="tor-output-activity" key={activity.id}>
                              <code>{activityNumber(sectionIndex, functionIndex, activityIndex)}</code>
                              <span className={activity.text.trim() ? "" : "tor-output-empty"}>
                                {activity.text.trim() || "Add an activity description"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </aside>
        </div>

        <div className="tor-bottom-row">
          <div className="tor-privacy">
            <ShieldCheck aria-hidden="true" />
            <span><strong>Preview only</strong><br />This example uses the supplied TOR entries. Changes remain in this screen and are not saved or submitted.</span>
          </div>
          <div className="tor-review-actions">
            <button type="button" className="tor-button tor-button-secondary" onClick={() => setNotice("Back navigation is illustrative in this prototype.")}>
              <ArrowLeft aria-hidden="true" /> Back to Step 3
            </button>
            <button type="button" className="tor-button tor-button-primary" onClick={handleContinue}>
              <FileCheck2 aria-hidden="true" /> Continue to Step 5
            </button>
          </div>
        </div>
        {(notice.startsWith("Add a description") || notice.startsWith("All TOR descriptions")) && (
          <div className="tor-message" role="status"><CircleHelp aria-hidden="true" />{notice}</div>
        )}
      </div>
    </main>
  );
}
