import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  CircleHelp,
  FileCheck2,
  LockKeyhole,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";

type ItemState = "answered" | "na" | "empty";

const TOTAL_ITEMS = 30;

function getInitialResponses(): Record<number, string> {
  return {
    1: "Coordinate assigned work with the relevant campus office.",
    2: "Prepare routine records and supporting materials as requested.",
    3: "Provide assistance during scheduled campus activities.",
    4: "N/A",
    5: "Maintain orderly files for assigned tasks.",
    6: "N/A",
    7: "Support day-to-day operations within the assigned unit.",
    8: "N/A",
  };
}

function getItemState(value: string | undefined): ItemState {
  if (!value?.trim()) return "empty";
  return value.trim().toLowerCase() === "n/a" ? "na" : "answered";
}

function StatusMark({ state }: { state: ItemState }) {
  if (state === "answered") {
    return <CheckCircle2 aria-hidden="true" className="tor-status-icon tor-status-answered" />;
  }
  if (state === "na") {
    return <span aria-label="Marked not applicable" className="tor-status-na">N/A</span>;
  }
  return <Circle aria-hidden="true" className="tor-status-icon tor-status-empty" />;
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
  const [responses, setResponses] = useState<Record<number, string>>(getInitialResponses);
  const [currentItem, setCurrentItem] = useState(9);
  const [showHelp, setShowHelp] = useState(false);
  const [showError, setShowError] = useState(false);
  const [notice, setNotice] = useState("");

  const currentResponse = responses[currentItem] ?? "";
  const itemStates = useMemo(
    () => Array.from({ length: TOTAL_ITEMS }, (_, index) => getItemState(responses[index + 1])),
    [responses],
  );
  const answeredCount = itemStates.filter((state) => state !== "empty").length;
  const completedPercent = Math.round((answeredCount / TOTAL_ITEMS) * 100);

  const goToItem = (item: number) => {
    setCurrentItem(Math.min(TOTAL_ITEMS, Math.max(1, item)));
    setShowError(false);
    setNotice("");
  };

  const updateResponse = (value: string) => {
    setResponses((previous) => ({ ...previous, [currentItem]: value }));
    setShowError(false);
    setNotice("Draft saved · illustrative");
  };

  const markNotApplicable = () => {
    updateResponse("N/A");
  };

  const handleNext = () => {
    if (!currentResponse.trim()) {
      setShowError(true);
      setNotice("");
      return;
    }
    setShowError(false);
    setCurrentItem((item) => Math.min(TOTAL_ITEMS, item + 1));
    setNotice("");
  };

  const handleContinue = () => {
    setNotice("This is a visual prototype. Your application has not been submitted.");
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
        .tor-content-grid { display: grid; grid-template-columns: minmax(235px, 290px) minmax(0, 1fr); gap: 22px; align-items: start; }
        .tor-aside { display: grid; gap: 14px; }
        .tor-nav-panel, .tor-note-panel, .tor-editor { background: var(--tor-white); border: 1px solid var(--tor-line); }
        .tor-nav-head { padding: 17px 18px 13px; border-bottom: 1px solid var(--tor-soft-line); }
        .tor-nav-title { margin: 0; color: var(--tor-navy-deep); font-size: 14px; font-weight: 750; }
        .tor-nav-subtitle { margin: 3px 0 0; color: #758188; font-size: 11px; }
        .tor-nav-progress { height: 3px; margin-top: 13px; background: #e6e9e6; }
        .tor-nav-progress span { display: block; height: 100%; background: var(--tor-gold); transition: width .2s ease; }
        .tor-item-list {
          display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px;
          max-height: 430px; overflow-y: auto; padding: 12px;
        }
        .tor-item-button {
          display: flex; align-items: center; justify-content: space-between; gap: 5px;
          min-height: 36px; padding: 5px 7px; border: 1px solid transparent; background: transparent;
          color: #52636d; text-align: left; transition: background .15s ease, border-color .15s ease, color .15s ease;
        }
        .tor-item-button:hover { background: #f3f5f1; border-color: #e3e6e0; }
        .tor-item-button[aria-current="step"] { color: var(--tor-navy-deep); border-color: #aabac0; background: #eef2f1; font-weight: 750; }
        .tor-item-number { font-size: 12px; font-weight: 650; font-variant-numeric: tabular-nums; }
        .tor-status-icon { width: 14px; height: 14px; flex: 0 0 auto; }
        .tor-status-answered { color: #59806d; }
        .tor-status-empty { color: #aab4b7; }
        .tor-status-na { color: #8b6b2e; font-size: 8px; font-weight: 800; letter-spacing: .02em; }
        .tor-legend { display: flex; align-items: center; flex-wrap: wrap; gap: 11px; padding: 0 14px 13px; color: #6f7b80; font-size: 10px; }
        .tor-legend-item { display: flex; align-items: center; gap: 5px; }
        .tor-legend .tor-status-icon { width: 12px; height: 12px; }
        .tor-legend .tor-status-na { font-size: 8px; }
        .tor-note-panel { padding: 15px 16px; background: #f8f6ef; border-color: #e0d9c7; }
        .tor-note-title { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; color: #564a32; font-size: 12px; font-weight: 750; }
        .tor-note-title svg { width: 16px; height: 16px; color: #957331; }
        .tor-note-panel p { margin: 0; color: #655f52; font-size: 12px; line-height: 1.5; }
        .tor-editor { min-width: 0; }
        .tor-editor-header {
          display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;
          padding: 21px 25px 17px; border-bottom: 1px solid var(--tor-soft-line);
        }
        .tor-item-kicker { color: #7c6a45; font-size: 10px; font-weight: 750; letter-spacing: .13em; text-transform: uppercase; }
        .tor-item-heading { margin: 5px 0 0; color: var(--tor-navy-deep); font: 500 24px/1.2 Georgia, "Times New Roman", serif; letter-spacing: -.02em; }
        .tor-item-counter { flex: 0 0 auto; padding: 6px 9px; color: #536977; background: #eff2ef; border: 1px solid #dce2dd; font-size: 11px; font-weight: 750; font-variant-numeric: tabular-nums; }
        .tor-editor-body { padding: 24px 25px 21px; }
        .tor-prompt-label { display: block; margin-bottom: 9px; color: #2a4456; font-size: 13px; font-weight: 750; }
        .tor-prompt-hint { display: block; margin-top: 2px; color: #748187; font-size: 11px; font-weight: 400; }
        .tor-response {
          width: 100%; min-height: 184px; resize: vertical; padding: 15px 16px;
          color: #233e50; background: #fffefa; border: 1px solid #abb9bd; border-radius: 0;
          font-size: 14px; line-height: 1.65; transition: border-color .15s ease, box-shadow .15s ease;
        }
        .tor-response::placeholder { color: #9aa5a6; }
        .tor-response:focus { border-color: var(--tor-blue); box-shadow: 0 0 0 1px var(--tor-blue); outline: none; }
        .tor-response[aria-invalid="true"] { border-color: #a6473b; }
        .tor-field-footer { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-top: 9px; }
        .tor-helper-text { display: flex; align-items: center; gap: 6px; color: #728087; font-size: 11px; }
        .tor-helper-text svg { width: 13px; height: 13px; }
        .tor-char-count { color: #818c90; font-size: 10px; font-variant-numeric: tabular-nums; }
        .tor-error { display: flex; align-items: center; gap: 7px; margin-top: 9px; color: #9e3e35; font-size: 12px; font-weight: 650; }
        .tor-error svg { width: 15px; height: 15px; }
        .tor-editor-controls { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 23px; }
        .tor-na-button, .tor-button {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          min-height: 42px; padding: 0 14px; border: 1px solid #bdc8ca; border-radius: 0;
          background: transparent; color: #385365; font-size: 12px; font-weight: 700;
          transition: background .15s ease, border-color .15s ease, transform .15s ease;
        }
        .tor-na-button:hover, .tor-button-secondary:hover { background: #f1f3ef; border-color: #8399a2; }
        .tor-na-button svg, .tor-button svg { width: 15px; height: 15px; }
        .tor-advance { display: flex; gap: 8px; }
        .tor-button-secondary { background: var(--tor-white); }
        .tor-button-primary { border-color: var(--tor-navy); background: var(--tor-navy); color: white; }
        .tor-button-primary:hover { background: #204a69; border-color: #204a69; }
        .tor-button:disabled { opacity: .45; cursor: not-allowed; }
        .tor-message {
          display: flex; align-items: flex-start; gap: 8px; margin: 0 25px 20px; padding: 10px 12px;
          border-left: 3px solid #78917c; background: #f0f4ee; color: #3f624d; font-size: 11px;
        }
        .tor-message svg { width: 15px; height: 15px; flex: 0 0 auto; margin-top: 1px; }
        .tor-bottom-row { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-top: 18px; }
        .tor-privacy { display: flex; align-items: flex-start; gap: 9px; color: #69777d; font-size: 11px; line-height: 1.4; }
        .tor-privacy svg { width: 17px; height: 17px; flex: 0 0 auto; color: #56766c; }
        .tor-privacy strong { color: #425762; font-weight: 700; }
        .tor-review-button { min-height: 40px; }
        .tor-mobile-stepper { display: none; }
        @media (max-width: 900px) {
          .tor-shell { padding: 0 22px 32px; }
          .tor-step { gap: 6px; padding-right: 9px; }
          .tor-step-label { font-size: 10px; }
          .tor-step:not(:last-child)::after { left: 34px; right: 5px; }
          .tor-content-grid { grid-template-columns: minmax(220px, 255px) minmax(0, 1fr); gap: 16px; }
          .tor-item-list { grid-template-columns: repeat(3, minmax(0, 1fr)); }
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
          .tor-status-pill { width: fit-content; margin: 13px 0 0; padding: 6px 9px; }
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
          .tor-content-grid { display: flex; flex-direction: column; gap: 12px; }
          .tor-aside { display: contents; }
          .tor-nav-panel { order: 0; width: 100%; }
          .tor-note-panel { order: 2; width: 100%; }
          .tor-editor { order: 1; width: 100%; }
          .tor-nav-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 13px; }
          .tor-nav-title { font-size: 12px; }
          .tor-nav-subtitle { margin: 2px 0 0; font-size: 10px; }
          .tor-nav-progress, .tor-legend { display: none; }
          .tor-item-list { grid-template-columns: repeat(6, minmax(0, 1fr)); max-height: none; gap: 4px; padding: 8px; }
          .tor-item-button { min-height: 36px; justify-content: center; padding: 4px 2px; }
          .tor-item-button .tor-status-icon { display: none; }
          .tor-item-button .tor-status-na { font-size: 7px; }
          .tor-item-number { font-size: 11px; }
          .tor-editor-header { padding: 16px 16px 13px; }
          .tor-item-heading { font-size: 21px; }
          .tor-item-counter { padding: 5px 7px; font-size: 10px; }
          .tor-editor-body { padding: 18px 16px 16px; }
          .tor-response { min-height: 164px; padding: 13px; font-size: 14px; }
          .tor-field-footer { align-items: flex-start; }
          .tor-editor-controls { align-items: stretch; flex-direction: column; gap: 11px; margin-top: 18px; }
          .tor-na-button { align-self: flex-start; min-height: 44px; }
          .tor-advance { display: grid; grid-template-columns: 1fr 1.3fr; }
          .tor-button { min-height: 46px; }
          .tor-message { margin: 0 16px 16px; }
          .tor-bottom-row { align-items: stretch; flex-direction: column; gap: 13px; margin-top: 13px; }
          .tor-review-button { width: 100%; }
          .tor-note-panel { padding: 12px 14px; }
        }
        @media (max-width: 370px) {
          .tor-shell { padding-right: 12px; padding-left: 12px; }
          .tor-brand-campus { letter-spacing: .04em; }
          .tor-period-value { font-size: 10px; }
          .tor-item-list { grid-template-columns: repeat(5, minmax(0, 1fr)); }
          .tor-advance { grid-template-columns: 1fr 1fr; }
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
            <h1 className="tor-title" id="tor-main-title">Terms of Reference</h1>
            <p className="tor-subtitle">Review and enter each numbered item for your renewal. You can move between items at any time.</p>
          </div>
          <div className="tor-status-pill" role="status" aria-live="polite">
            <Save aria-hidden="true" /> {notice.startsWith("Draft saved") ? notice : "Draft saved · illustrative"}
          </div>
        </section>

        <section className="tor-progress-shell" aria-label="Application progress">
          <div className="tor-progress-heading">
            <strong>Application progress</strong>
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
          <aside className="tor-aside" aria-label="TOR item navigation and guidance">
            <nav className="tor-nav-panel" aria-label="Jump to a numbered TOR item">
              <div className="tor-nav-head">
                <div>
                  <h2 className="tor-nav-title">TOR items</h2>
                  <p className="tor-nav-subtitle">{answeredCount} of 30 addressed</p>
                </div>
              </div>
              <div className="tor-nav-progress" aria-label={`${completedPercent}% of TOR items addressed`}>
                <span style={{ width: `${completedPercent}%` }} />
              </div>
              <div className="tor-item-list">
                {itemStates.map((state, index) => {
                  const item = index + 1;
                  return (
                    <button
                      key={item}
                      type="button"
                      className="tor-item-button"
                      aria-current={currentItem === item ? "step" : undefined}
                      aria-label={`TOR item ${item}, ${state === "empty" ? "unanswered" : state === "na" ? "marked not applicable" : "answered"}`}
                      onClick={() => goToItem(item)}
                    >
                      <span className="tor-item-number">{String(item).padStart(2, "0")}</span>
                      <StatusMark state={state} />
                    </button>
                  );
                })}
              </div>
              <div className="tor-legend" aria-label="Item status legend">
                <span className="tor-legend-item"><StatusMark state="answered" /> Answered</span>
                <span className="tor-legend-item"><StatusMark state="empty" /> Unanswered</span>
                <span className="tor-legend-item"><StatusMark state="na" /> N/A</span>
              </div>
            </nav>
            <div className="tor-note-panel">
              <div className="tor-note-title"><CircleHelp aria-hidden="true" /> When an item does not apply</div>
              <p>Select <strong>Mark as N/A</strong> when a numbered item is not relevant to your role. This keeps the entry distinct from an unanswered item.</p>
            </div>
          </aside>

          <section className="tor-editor" aria-labelledby="tor-item-title">
            <div className="tor-editor-header">
              <div>
                <div className="tor-item-kicker">Terms of Reference · Entry {String(currentItem).padStart(2, "0")}</div>
                <h2 className="tor-item-heading" id="tor-item-title">TOR #{currentItem}</h2>
              </div>
              <div className="tor-item-counter" aria-live="polite">Item {currentItem} of {TOTAL_ITEMS}</div>
            </div>
            <div className="tor-editor-body">
              <label className="tor-prompt-label" htmlFor="tor-response">
                Response for TOR #{currentItem}
                <span className="tor-prompt-hint">Enter the applicable information for this item. Use neutral, concise wording.</span>
              </label>
              <textarea
                id="tor-response"
                className="tor-response"
                value={currentResponse}
                onChange={(event) => updateResponse(event.target.value)}
                placeholder="Type your response here, or mark this item as N/A."
                aria-describedby={showError ? "tor-error tor-field-help" : "tor-field-help"}
                aria-invalid={showError}
                maxLength={1200}
              />
              <div className="tor-field-footer">
                <span className="tor-helper-text" id="tor-field-help"><LockKeyhole aria-hidden="true" /> Avoid including sensitive personal identifiers.</span>
                <span className="tor-char-count">{currentResponse.length} / 1,200</span>
              </div>
              {showError && <div className="tor-error" id="tor-error" role="alert"><X aria-hidden="true" /> Add a response or mark this item as N/A before continuing.</div>}
              <div className="tor-editor-controls">
                <button type="button" className="tor-na-button" onClick={markNotApplicable}>
                  <Check aria-hidden="true" /> Mark as N/A
                </button>
                <div className="tor-advance">
                  <button type="button" className="tor-button tor-button-secondary" onClick={() => goToItem(currentItem - 1)} disabled={currentItem === 1}>
                    <ArrowLeft aria-hidden="true" /> Previous
                  </button>
                  <button type="button" className="tor-button tor-button-primary" onClick={handleNext} disabled={currentItem === TOTAL_ITEMS}>
                    Next item <ArrowRight aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
            {notice.startsWith("This is a visual") && (
              <div className="tor-message" role="status"><CircleHelp aria-hidden="true" />{notice}</div>
            )}
          </section>
        </div>

        <div className="tor-bottom-row">
          <div className="tor-privacy">
            <ShieldCheck aria-hidden="true" />
            <span><strong>Privacy reminder</strong><br />Your entries should contain work-related information only. This preview does not store or submit responses.</span>
          </div>
          <button type="button" className="tor-button tor-button-secondary tor-review-button" onClick={handleContinue}>
            <FileCheck2 aria-hidden="true" /> Continue to Step 5
          </button>
        </div>
      </div>
    </main>
  );
}
