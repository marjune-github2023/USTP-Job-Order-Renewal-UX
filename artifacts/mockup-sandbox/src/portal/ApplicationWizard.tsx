import { useEffect, useState } from "react";
import LegacyWizard, {
  ApplicationReview as LegacyReview,
  type WizardData as LegacyData,
} from "./LegacyApplicationWizard";
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
export type WizardData = LegacyData & {
  form_version?: number;
  tor_items?: string[];
};
type Group =
  | "personal_details"
  | "education_details"
  | "contact_details"
  | "contract_details";
type Field = {
  group: Group;
  key: string;
  label: string;
  max?: number;
  type?: string;
  choices?: string[];
  hint?: string;
};
const eligibility = [
  "None",
  "Career Service (Subprofessional) First Level Eligibility",
  "Career Service (Professional) Second Level Eligibility",
  "RA 1080 (Bar)",
  "RA 1080 (Board)",
  "Career Service Executive Eligibility (CSEE)/Career Executive Service (CES)",
  "PD 907 (Honor Graduate Eligibility)",
];
const fields: Record<number, Field[]> = {
  1: [
    {
      group: "personal_details",
      key: "first_name",
      label: "First name",
      max: 80,
      hint: "CAPITAL LETTERS",
    },
    {
      group: "personal_details",
      key: "middle_name",
      label: "Middle name",
      max: 80,
      hint: "CAPITAL LETTERS; N/A if not applicable",
    },
    {
      group: "personal_details",
      key: "last_name",
      label: "Last name",
      max: 80,
      hint: "CAPITAL LETTERS",
    },
    {
      group: "personal_details",
      key: "suffix",
      label: "Suffix",
      max: 30,
      hint: "JR., SR., III, II, etc.; N/A if not applicable",
    },
    {
      group: "personal_details",
      key: "birth_date",
      label: "Date of birth",
      type: "date",
      max: 10,
    },
    {
      group: "personal_details",
      key: "sex",
      label: "Sex",
      choices: ["Female", "Male"],
    },
    {
      group: "personal_details",
      key: "civil_status",
      label: "Civil status",
      choices: ["Single", "Married", "Widowed", "Separated"],
    },
    {
      group: "personal_details",
      key: "address",
      label: "Complete address",
      max: 500,
      hint: "Capitalize each word",
    },
    {
      group: "personal_details",
      key: "ustp_id",
      label: "USTP ID number",
      max: 120,
    },
    {
      group: "personal_details",
      key: "prc_license",
      label: "PRC license number",
      max: 120,
      hint: "N/A if not applicable",
    },
  ],
  2: [
    {
      group: "education_details",
      key: "bachelor",
      label: "Baccalaureate / bachelor’s degree",
      max: 200,
      hint: "Do not abbreviate; N/A if not applicable",
    },
    {
      group: "education_details",
      key: "master",
      label: "Master’s degree / units completed",
      max: 200,
      hint: "Include units if incomplete; N/A if not applicable",
    },
    {
      group: "education_details",
      key: "doctorate",
      label: "Doctoral / doctorate degree / units completed",
      max: 200,
      hint: "Include units or CAR if incomplete; N/A if not applicable",
    },
    {
      group: "education_details",
      key: "eligibility",
      label: "Eligibility",
      max: 200,
      choices: [...eligibility, "Other"],
    },
  ],
  5: [
    {
      group: "contract_details",
      key: "daily_rate",
      label: "Daily rate (PHP, numerical)",
      type: "number",
      max: 12,
    },
  ],
  6: [
    {
      group: "contact_details",
      key: "email",
      label: "USTP email / office email",
      type: "email",
      max: 254,
      hint: "Use your office email if you do not have an individual USTP email",
    },
    {
      group: "contact_details",
      key: "phone",
      label: "Updated contact number",
      type: "tel",
      max: 50,
    },
    {
      group: "contact_details",
      key: "tin",
      label: "TIN",
      max: 80,
      hint: "N/A if not applicable",
    },
    {
      group: "contact_details",
      key: "pagibig",
      label: "PAGIBIG number",
      max: 80,
      hint: "N/A if not applicable",
    },
    {
      group: "contact_details",
      key: "sss",
      label: "SSS number",
      max: 80,
      hint: "N/A if not applicable",
    },
    {
      group: "contact_details",
      key: "philhealth",
      label: "PhilHealth number",
      max: 80,
      hint: "N/A if not applicable",
    },
  ],
  7: [
    {
      group: "contract_details",
      key: "supervisor",
      label: "Immediate supervisor",
      max: 120,
    },
    {
      group: "contract_details",
      key: "supervisor_position",
      label: "Position of immediate supervisor",
      max: 160,
      hint: "For example: Director, HRMO",
    },
  ],
};
function numberWords(n: number): string {
  const small = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const tens = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];
  if (n < 20) return small[n];
  if (n < 100)
    return tens[Math.floor(n / 10)] + (n % 10 ? "-" + small[n % 10] : "");
  if (n < 1000)
    return (
      small[Math.floor(n / 100)] +
      " hundred" +
      (n % 100 ? " " + numberWords(n % 100) : "")
    );
  return (
    numberWords(Math.floor(n / 1000)) +
    " thousand" +
    (n % 1000 ? " " + numberWords(n % 1000) : "")
  );
}
export function rateWords(rate: string | undefined) {
  if (!rate || !/^\d{1,6}(\.\d{1,2})?$/.test(rate) || Number(rate) <= 0)
    return "Enter a valid daily rate";
  const [whole, cents = ""] = rate.split(".");
  return `${numberWords(Number(whole)).toUpperCase()} & ${cents.padEnd(2, "0")}/100`;
}
function value(data: WizardData, field: Field) {
  return (data[field.group] as Record<string, string>)[field.key] || "";
}
function errorFor(step: number, data: WizardData) {
  if (fields[step]?.some((f) => !value(data, f).trim()))
    return "Complete all fields in this step. Use N/A only where indicated.";
  if (
    step === 1 &&
    ["first_name", "last_name", "ustp_id"].some(
      (k) => data.personal_details[k]?.toUpperCase() === "N/A",
    )
  )
    return "Enter your first name, last name and USTP ID.";
  if (
    step === 1 &&
    data.personal_details.birth_date >= new Date().toISOString().slice(0, 10)
  )
    return "Choose a date of birth in the past.";
  if (
    step === 3 &&
    (!data.position.trim() ||
      !data.start_date ||
      !data.end_date ||
      data.end_date < data.start_date)
  )
    return "Enter your position and a valid contract period.";
  if (
    step === 4 &&
    (!data.tor_items?.length ||
      data.tor_items.some((d) => !d.trim()) ||
      !data.tor_items.some((d) => d.trim().toUpperCase() !== "N/A"))
  )
    return "Enter at least one TOR duty; remove unused rows or enter N/A.";
  if (
    step === 5 &&
    rateWords(data.contract_details.daily_rate) === "Enter a valid daily rate"
  )
    return "Enter a daily rate from 0.01 to 999,999.99.";
  if (
    step === 6 &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact_details.email)
  )
    return "Enter a valid USTP or office email address.";
  if (step === 7 && !data.office) return "Choose an office from the list.";
  return "";
}
export function ApplicationReview({ data }: { data: WizardData }) {
  if (data.form_version !== 2) return <LegacyReview data={data} />;
  return (
    <div className="p-application-review">
      {steps.slice(0, 7).map((title, i) => (
        <section key={title} className="p-review-section">
          <h3>
            {i + 1}. {title}
          </h3>
          <dl>
            {(fields[i + 1] || []).map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>{value(data, f) || "Not provided"}</dd>
              </div>
            ))}
            {i === 2 &&
              [
                ["Position title", data.position],
                ["Contract start", data.start_date],
                ["Contract end", data.end_date],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v || "Not provided"}</dd>
                </div>
              ))}
            {i === 4 && (
              <div>
                <dt>Daily rate in words</dt>
                <dd>{rateWords(data.contract_details.daily_rate)}</dd>
              </div>
            )}
            {i === 6 && (
              <div>
                <dt>Office affiliation</dt>
                <dd>{data.office || "Not provided"}</dd>
              </div>
            )}
          </dl>
          {i === 3 && (
            <ol>
              {data.tor_items?.map((d, index) => (
                <li key={index}>{d}</li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}
export default function ApplicationWizard(props: {
  data: WizardData;
  onChange: (data: WizardData) => void;
  step: number;
  busy: boolean;
  dirty: boolean;
  onMove: (step: number) => void;
  onSave: () => void;
}) {
  if (props.data.form_version !== 2) return <LegacyWizard {...props} />;
  return <GoogleFormWizard {...props} />;
}
function GoogleFormWizard({
  data,
  onChange,
  step,
  busy,
  dirty,
  onMove,
  onSave,
}: Parameters<typeof ApplicationWizard>[0]) {
  const [error, setError] = useState(""),
    [offices, setOffices] = useState<{ id: string; name: string }[]>([]),
    [officeError, setOfficeError] = useState("");
  const [otherEligibility, setOtherEligibility] = useState(
    Boolean(
      data.education_details.eligibility &&
      !eligibility.includes(data.education_details.eligibility),
    ),
  );
  const loadOffices = async () => {
    setOfficeError("");
    try {
      const response = await fetch("/api/offices");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setOffices(result);
    } catch (e) {
      setOfficeError(
        e instanceof Error ? e.message : "Unable to load offices.",
      );
    }
  };
  useEffect(() => {
    if (step === 7) void loadOffices();
  }, [step]);
  const set = (field: Field, v: string) =>
    onChange({
      ...data,
      [field.group]: { ...data[field.group], [field.key]: v },
    });
  const move = (target: number) => {
    const message = target > step ? errorFor(step, data) : "";
    setError(message);
    if (!message) onMove(target);
  };
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
            className={step === i + 1 ? "p-current-step" : ""}
            disabled={
              busy ||
              (i + 1 > step &&
                steps
                  .slice(0, i)
                  .some((_, j) => Boolean(errorFor(j + 1, data))))
            }
            onClick={() => move(i + 1)}
          >
            <span>{String(i + 1).padStart(2, "0")}</span>
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="p-alert p-error">
          {error}
        </p>
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
              <p className="p-muted">
                Use the details from your personnel records. All fields are
                required; enter N/A where indicated.
              </p>
            )}
            {step === 2 && (
              <p className="p-muted">
                Write degree names in full. Include completed units for
                unfinished graduate degrees.
              </p>
            )}
            <div className="p-form-grid">
              {fields[step]?.map((f) => (
                <label key={f.key}>
                  {f.label}
                  {f.choices ? (
                    <>
                      <select
                        required
                        value={
                          f.key === "eligibility" && otherEligibility
                            ? "Other"
                            : value(data, f)
                        }
                        onChange={(e) => {
                          if (f.key === "eligibility")
                            setOtherEligibility(e.target.value === "Other");
                          set(
                            f,
                            e.target.value === "Other" ? "" : e.target.value,
                          );
                        }}
                      >
                        <option value="">Select…</option>
                        {f.choices.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                      {f.key === "eligibility" && otherEligibility && (
                        <input
                          required
                          aria-label="Other eligibility"
                          maxLength={200}
                          value={value(data, f)}
                          onChange={(e) => set(f, e.target.value)}
                        />
                      )}
                    </>
                  ) : (
                    <input
                      required
                      type={f.type || "text"}
                      maxLength={f.max || 120}
                      value={value(data, f)}
                      onChange={(e) =>
                        set(
                          f,
                          [
                            "first_name",
                            "middle_name",
                            "last_name",
                            "suffix",
                          ].includes(f.key)
                            ? e.target.value.toUpperCase()
                            : e.target.value,
                        )
                      }
                      {...(f.type === "number"
                        ? { min: "0.01", max: "999999.99", step: "0.01" }
                        : {})}
                      {...(f.key === "birth_date"
                        ? {
                            max: new Date(Date.now() - 86400000)
                              .toISOString()
                              .slice(0, 10),
                          }
                        : {})}
                    />
                  )}
                  {f.hint && <small className="p-muted">{f.hint}</small>}
                </label>
              ))}
            </div>
            {step === 3 && (
              <div className="p-form-grid">
                <label>
                  Position title
                  <input
                    required
                    maxLength={160}
                    value={data.position}
                    onChange={(e) =>
                      onChange({ ...data, position: e.target.value })
                    }
                  />
                  <small className="p-muted">Do not abbreviate</small>
                </label>
                <label>
                  Contract start
                  <input
                    required
                    type="date"
                    value={data.start_date}
                    onChange={(e) =>
                      onChange({ ...data, start_date: e.target.value })
                    }
                  />
                </label>
                <label>
                  Contract end
                  <input
                    required
                    type="date"
                    min={data.start_date}
                    value={data.end_date}
                    onChange={(e) =>
                      onChange({ ...data, end_date: e.target.value })
                    }
                  />
                </label>
              </div>
            )}
            {step === 4 && (
              <>
                <p className="p-muted">
                  Add your duties in order, up to 30. You only need rows that
                  apply to you. Numbering is added automatically.
                </p>
                {(data.tor_items || []).map((d, i) => (
                  <div className="p-duty-row" key={i}>
                    <label>
                      TOR #{i + 1}
                      <textarea
                        required
                        maxLength={1000}
                        value={d}
                        onChange={(e) =>
                          onChange({
                            ...data,
                            tor_items: data.tor_items!.map((v, j) =>
                              j === i ? e.target.value : v,
                            ),
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      disabled={data.tor_items!.length === 1}
                      aria-label={`Remove TOR ${i + 1}`}
                      onClick={() =>
                        onChange({
                          ...data,
                          tor_items: data.tor_items!.filter((_, j) => i !== j),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={(data.tor_items?.length || 0) >= 30}
                  onClick={() =>
                    onChange({
                      ...data,
                      tor_items: [...(data.tor_items || []), ""],
                    })
                  }
                >
                  Add TOR duty
                </button>
              </>
            )}
            {step === 5 && (
              <label>
                Daily rate in words
                <output className="p-rate-words">
                  {rateWords(data.contract_details.daily_rate)}
                </output>
                <small className="p-muted">
                  Calculated from the numerical rate to keep the contract
                  consistent.
                </small>
              </label>
            )}
            {step === 7 && (
              <>
                <label>
                  Office affiliation
                  <select
                    required
                    value={data.office}
                    onChange={(e) =>
                      onChange({ ...data, office: e.target.value })
                    }
                  >
                    <option value="">Select office…</option>
                    {data.office &&
                      !offices.some((o) => o.name === data.office) && (
                        <option value={data.office} disabled>
                          {data.office} (no longer active)
                        </option>
                      )}
                    {offices.map((o) => (
                      <option key={o.id} value={o.name}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="p-muted">
                  If your office is missing, ask HRMO to add it, then refresh
                  this list.
                </p>
                <button type="button" onClick={() => void loadOffices()}>
                  Refresh offices
                </button>
                {officeError && <p role="alert">{officeError}</p>}
              </>
            )}
            {step === 8 && (
              <>
                <p className="p-muted">
                  Review your responses before submitting to HRMO. Personnel
                  information is used for renewal processing and contract
                  preparation.
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
            Back
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
