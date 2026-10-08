import { useState } from "react";
import TorEditor, { type TorSection } from "./TorEditor";
import { type ContractDetails } from "./ContractPanel";
export const steps = [
  "Personal",
  "Education",
  "Contract",
  "TOR",
  "Compensation",
  "Contact",
  "Office",
  "Review",
];
export type WizardData = {
  position: string;
  office: string;
  start_date: string;
  end_date: string;
  personal_details: Record<string, string>;
  education_details: Record<string, string>;
  contact_details: Record<string, string>;
  contract_details: Partial<ContractDetails>;
  tor_sections: TorSection[];
};
const names: [keyof ContractDetails, string][] = [
  ["supervisor", "Immediate supervisor"],
  ["chancellor", "Chancellor name (include academic credentials)"],
  ["chancellor_id", "Chancellor ID number"],
  ["hrmo_director", "HRMO director"],
  ["finance_director", "Finance director"],
];
const display = (value: string | undefined) => value || "Not provided";
function Summary({
  title,
  values,
}: {
  title: string;
  values: [string, string | undefined][];
}) {
  return (
    <section className="p-review-section">
      <h3>{title}</h3>
      <dl>
        {values.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{display(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
export function ApplicationReview({ data }: { data: WizardData }) {
  return (
    <div className="p-application-review">
      <Summary
        title="1. Personal"
        values={[
          ["Full legal name", data.personal_details.full_name],
          ["Nationality", data.personal_details.nationality],
          ["Civil status", data.personal_details.civil_status],
          ["Valid ID type / number", data.personal_details.valid_id],
        ]}
      />
      <Summary
        title="2. Education"
        values={[
          [
            "Highest educational attainment",
            data.education_details?.highest_education,
          ],
          ["School / institution", data.education_details?.school],
          ["Course / program", data.education_details?.course],
          ["Year graduated", data.education_details?.graduation_year],
        ]}
      />
      <Summary
        title="3. Contract"
        values={[
          ["Position", data.position],
          ["Contract start", data.start_date],
          ["Contract end", data.end_date],
          ["Contract / signing date", data.contract_details.contract_date],
          ["Duration", data.contract_details.duration],
        ]}
      />
      <section className="p-review-section">
        <h3>4. Terms of Reference</h3>
        <TorEditor
          disabled
          sections={data.tor_sections || []}
          onChange={() => {}}
        />
      </section>
      <Summary
        title="5. Compensation"
        values={[["Daily wage (PHP)", data.contract_details.daily_rate]]}
      />
      <Summary
        title="6. Contact"
        values={[
          ["Email address", data.contact_details?.email],
          ["Contact number", data.contact_details?.phone],
          ["Residence address", data.personal_details.address],
        ]}
      />
      <Summary
        title="7. Office & signatories"
        values={[
          ["Office / department", data.office],
          ...names.map(([key, label]): [string, string | undefined] => [
            label,
            data.contract_details[key],
          ]),
        ]}
      />
    </div>
  );
}
function stepError(step: number, data: WizardData): string {
  const p = data.personal_details,
    c = data.contract_details;
  const missing = (values: (string | undefined)[]) =>
    values.some((v) => !v?.trim());
  if (
    step === 1 &&
    missing([p.full_name, p.nationality, p.civil_status, p.valid_id])
  )
    return "Complete your personal details before continuing.";
  if (
    step === 3 &&
    (missing([
      data.position,
      data.start_date,
      data.end_date,
      c.contract_date,
      c.duration,
    ]) ||
      data.end_date < data.start_date)
  )
    return "Complete the contract details and choose an end date on or after the start date.";
  if (
    step === 4 &&
    (!data.tor_sections.length ||
      data.tor_sections.some(
        (s) =>
          !s.title.trim() ||
          !s.functions.length ||
          s.functions.some(
            (f) =>
              !f.text.trim() ||
              !f.activities.length ||
              f.activities.some((a) => !a.trim()),
          ),
      ))
  )
    return "Complete every TOR section, function and activity.";
  if (
    step === 4 &&
    Math.abs(data.tor_sections.reduce((n, s) => n + s.weight, 0) - 100) > 0.001
  )
    return "TOR section weights must total 100%.";
  if (
    step === 5 &&
    (!c.daily_rate ||
      !/^\d{1,6}(\.\d{1,2})?$/.test(c.daily_rate) ||
      Number(c.daily_rate) <= 0)
  )
    return "Enter a valid daily wage from 0.01 to 999,999.99.";
  if (
    step === 6 &&
    (missing([
      p.address,
      data.contact_details.phone,
      data.contact_details.email,
    ]) ||
      !/^\S+@\S+\.\S+$/.test(data.contact_details.email))
  )
    return "Complete your contact number, email address and residence address.";
  if (step === 7 && missing([data.office, ...names.map(([key]) => c[key])]))
    return "Complete the office and signatory details before reviewing your application.";
  return "";
}
export default function ApplicationWizard({
  data,
  onChange,
  step,
  busy,
  dirty,
  onMove,
  onSave,
}: {
  data: WizardData;
  onChange: (data: WizardData) => void;
  step: number;
  busy: boolean;
  dirty: boolean;
  onMove: (target: number) => void;
  onSave: () => void;
}) {
  const [error, setError] = useState("");
  const setPersonal = (key: string, value: string) =>
    onChange({
      ...data,
      personal_details: { ...data.personal_details, [key]: value },
    });
  const setContract = (key: keyof ContractDetails, value: string) =>
    onChange({
      ...data,
      contract_details: { ...data.contract_details, [key]: value },
    });
  const input = (
    label: string,
    value: string | undefined,
    change: (value: string) => void,
    max = 120,
    type = "text",
    extra: Record<string, string | number> = {},
  ) => (
    <label key={label}>
      {label}
      <input
        disabled={busy}
        type={type}
        value={value || ""}
        maxLength={max}
        onChange={(e) => change(e.target.value)}
        {...extra}
      />
    </label>
  );
  function move(target: number) {
    const message = target > step ? stepError(step, data) : "";
    setError(message);
    if (!message) onMove(target);
  }
  return (
    <section className="p-card p-wizard">
      <div className="p-wizard-heading">
        <div>
          <p className="p-eyebrow">RENEWAL APPLICATION</p>
          <h2>{step === 8 ? "Review your application" : steps[step - 1]}</h2>
        </div>
        <span>
          Step <strong>{step} of 8</strong>
        </span>
      </div>
      <nav className="p-stepper" aria-label="Application steps">
        {steps.map((label, i) => (
          <button
            key={label}
            type="button"
            aria-current={step === i + 1 ? "step" : undefined}
            disabled={
              busy ||
              (i + 1 > step &&
                steps
                  .slice(0, i)
                  .some((_, index) => Boolean(stepError(index + 1, data))))
            }
            className={step === i + 1 ? "p-current-step" : ""}
            onClick={() => move(i + 1)}
          >
            <span>
              {i + 1 < step && !stepError(i + 1, data)
                ? "✓"
                : String(i + 1).padStart(2, "0")}
            </span>
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <div role="alert" className="p-alert p-error">
          {error}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          move(Math.min(step + 1, 8));
        }}
      >
        <fieldset disabled={busy}>
          <div className="p-wizard-content">
            {step === 1 && (
              <>
                <p className="p-muted">
                  Enter your name exactly as it should appear in the contract.
                </p>
                <div className="p-form-grid">
                  {input(
                    "Full legal name",
                    data.personal_details.full_name,
                    (v) => setPersonal("full_name", v),
                  )}
                  {input(
                    "Nationality",
                    data.personal_details.nationality,
                    (v) => setPersonal("nationality", v),
                    80,
                  )}
                  {input(
                    "Civil status",
                    data.personal_details.civil_status,
                    (v) => setPersonal("civil_status", v),
                    40,
                  )}
                  {input(
                    "Valid ID type / number",
                    data.personal_details.valid_id,
                    (v) => setPersonal("valid_id", v),
                  )}
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <p className="p-muted">
                  Add your education details, if applicable. You can leave these
                  fields blank.
                </p>
                <div className="p-form-grid">
                  {[
                    ["highest_education", "Highest educational attainment"],
                    ["school", "School / institution"],
                    ["course", "Course / program"],
                    ["graduation_year", "Year graduated"],
                  ].map(([key, label]) =>
                    input(
                      label,
                      data.education_details[key],
                      (v) =>
                        onChange({
                          ...data,
                          education_details: {
                            ...data.education_details,
                            [key]: v,
                          },
                        }),
                      key === "graduation_year" ? 4 : 160,
                    ),
                  )}
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <p className="p-muted">
                  Enter the details of the renewal period for HRMO to verify.
                </p>
                <div className="p-form-grid">
                  {input(
                    "Position",
                    data.position,
                    (v) => onChange({ ...data, position: v }),
                    160,
                  )}
                  {input(
                    "Contract start",
                    data.start_date,
                    (v) => onChange({ ...data, start_date: v }),
                    10,
                    "date",
                  )}
                  {input(
                    "Contract end",
                    data.end_date,
                    (v) => onChange({ ...data, end_date: v }),
                    10,
                    "date",
                    { min: data.start_date || "" },
                  )}
                  {input(
                    "Contract / signing date",
                    data.contract_details.contract_date,
                    (v) => setContract("contract_date", v),
                    10,
                    "date",
                  )}
                  {input(
                    "Duration in words (e.g. Three months)",
                    data.contract_details.duration,
                    (v) => setContract("duration", v),
                    80,
                  )}
                </div>
              </>
            )}
            {step === 4 && (
              <TorEditor
                sections={data.tor_sections}
                disabled={busy}
                onChange={(sections) =>
                  onChange({ ...data, tor_sections: sections })
                }
              />
            )}
            {step === 5 && (
              <>
                <p className="p-muted">
                  Enter the daily rate for this renewal. HRMO will verify the
                  amount before approval.
                </p>
                {input(
                  "Daily wage (PHP)",
                  data.contract_details.daily_rate,
                  (v) => setContract("daily_rate", v),
                  12,
                  "number",
                  { min: "0.01", max: "999999.99", step: "0.01" },
                )}
              </>
            )}
            {step === 6 && (
              <div className="p-form-grid">
                {input(
                  "Contact email",
                  data.contact_details.email,
                  (v) =>
                    onChange({
                      ...data,
                      contact_details: { ...data.contact_details, email: v },
                    }),
                  254,
                  "email",
                )}
                {input(
                  "Contact number",
                  data.contact_details.phone,
                  (v) =>
                    onChange({
                      ...data,
                      contact_details: { ...data.contact_details, phone: v },
                    }),
                  50,
                  "tel",
                )}
                {input(
                  "Residence address",
                  data.personal_details.address,
                  (v) => setPersonal("address", v),
                  500,
                )}
              </div>
            )}
            {step === 7 && (
              <>
                <p className="p-muted">
                  Enter your assigned office and the names to appear on the
                  contract. HRMO will check these details. Enter only the
                  Chancellor’s name and academic credentials (for example,
                  Ph.D.); “USTP Claveria, Chancellor” is added below the name
                  automatically. Enter the ID number without the “Valid ID/No.”
                  label.
                </p>
                <div className="p-form-grid">
                  {input(
                    "Office / department",
                    data.office,
                    (v) => onChange({ ...data, office: v }),
                    160,
                  )}
                  {names.map(([key, label]) =>
                    input(label, data.contract_details[key], (v) =>
                      setContract(key, v),
                    ),
                  )}
                </div>
              </>
            )}
            {step === 8 && (
              <>
                <p className="p-muted">
                  Check all details below. Use the step buttons above to make
                  changes, then submit to HRMO.
                </p>
                <ApplicationReview data={data} />
              </>
            )}
          </div>
        </fieldset>
        <div className="p-wizard-footer">
          <button
            type="button"
            disabled={busy || step === 1}
            onClick={() => move(step - 1)}
          >
            Back{step > 1 ? ` to ${steps[step - 2]}` : ""}
          </button>
          <span role="status" className="p-muted p-small">
            {dirty ? "Unsaved changes" : "All changes saved"}
          </span>
          <button type="button" disabled={busy || !dirty} onClick={onSave}>
            Save draft
          </button>
          {step < 8 && (
            <button className="p-primary" disabled={busy} type="submit">
              Save & continue to {steps[step]}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
