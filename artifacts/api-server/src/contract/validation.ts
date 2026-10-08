export type TorSection = {
  title: string;
  weight: number;
  functions: { text: string; activities: string[] }[];
};
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid form data.");
  return value as Record<string, unknown>;
};
function string(value: unknown, label: string, max: number) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    throw new Error(`Invalid ${label} (maximum ${max} characters).`);
  return value.trim();
}
export function personalDetails(value: unknown) {
  const source = object(value);
  return Object.fromEntries(
    Object.entries({
      full_name: 320,
      first_name: 80,
      middle_name: 80,
      last_name: 80,
      suffix: 30,
      birth_date: 10,
      sex: 20,
      ustp_id: 120,
      prc_license: 120,
      nationality: 80,
      civil_status: 40,
      address: 500,
      valid_id: 120,
    }).map(([key, max]) => [
      key,
      string(source[key] ?? "", key.replaceAll("_", " "), max),
    ]),
  );
}
export function contractDetails(value: unknown) {
  const source = object(value);
  const data = Object.fromEntries(
    Object.entries({
      contract_date: 10,
      daily_rate: 12,
      supervisor_position: 160,
      duration: 80,
      chancellor: 120,
      chancellor_id: 120,
      supervisor: 120,
      hrmo_director: 120,
      finance_director: 120,
    }).map(([key, max]) => [
      key,
      string(source[key] ?? "", key.replaceAll("_", " "), max),
    ]),
  );
  if (
    data.daily_rate &&
    (!/^\d{1,6}(\.\d{1,2})?$/.test(data.daily_rate) ||
      Number(data.daily_rate) <= 0)
  )
    throw new Error("Enter a daily rate from 0.01 to 999,999.99.");
  if (data.contract_date && !validDate(data.contract_date))
    throw new Error("Enter a valid contract date.");
  return data;
}
export function educationDetails(value: unknown) {
  const source = object(value);
  const data = Object.fromEntries(
    Object.entries({
      bachelor: 200,
      master: 200,
      doctorate: 200,
      eligibility: 200,
      highest_education: 160,
      school: 160,
      course: 160,
      graduation_year: 4,
    }).map(([key, max]) => [
      key,
      string(source[key] ?? "", key.replaceAll("_", " "), max),
    ]),
  );
  if (data.graduation_year && !/^\d{0,4}$/.test(data.graduation_year))
    throw new Error("Graduation year must contain digits only.");
  return data;
}
export function contactDetails(value: unknown) {
  const source = object(value);
  return {
    email: string(source.email ?? "", "contact email", 254),
    phone: string(source.phone ?? "", "contact number", 50),
    tin: string(source.tin ?? "", "TIN", 80),
    pagibig: string(source.pagibig ?? "", "PAGIBIG", 80),
    sss: string(source.sss ?? "", "SSS", 80),
    philhealth: string(source.philhealth ?? "", "PhilHealth", 80),
  };
}
export function torSections(value: unknown): TorSection[] {
  if (!Array.isArray(value) || value.length > 10)
    throw new Error("Use up to 10 TOR sections.");
  let lines = 0;
  const result = value.map((entry) => {
    const section = object(entry);
    if (
      typeof section.weight !== "number" ||
      !Number.isFinite(section.weight) ||
      section.weight < 0 ||
      section.weight > 100
    )
      throw new Error("Section weights must be between 0 and 100.");
    if (!Array.isArray(section.functions) || section.functions.length > 30)
      throw new Error("Use up to 30 functions per section.");
    lines++;
    return {
      title: string(section.title, "section title", 160),
      weight: section.weight,
      functions: section.functions.map((entry) => {
        const fn = object(entry);
        if (!Array.isArray(fn.activities) || fn.activities.length > 30)
          throw new Error("Use up to 30 activities per function.");
        lines += 1 + fn.activities.length;
        return {
          text: string(fn.text, "function", 1000),
          activities: fn.activities.map((a) => string(a, "activity", 1000)),
        };
      }),
    };
  });
  if (lines > 250 || JSON.stringify(result).length > 40000)
    throw new Error("TOR exceeds the limit of 250 lines or 40,000 characters.");
  return result;
}
export function alpha(index: number): string {
  let result = "";
  do {
    result = String.fromCharCode(97 + (index % 26)) + result;
    index = Math.floor(index / 26) - 1;
  } while (index >= 0);
  return result;
}
export function numberedTor(sections: TorSection[]) {
  return sections
    .flatMap((s, si) => [
      `2.${si + 1} ${s.title} (${s.weight}%)`,
      ...s.functions.flatMap((f, fi) => [
        `2.${si + 1}.${fi + 1} ${f.text}`,
        ...f.activities.map(
          (a, ai) => `2.${si + 1}.${fi + 1}.${alpha(ai)} ${a}`,
        ),
      ]),
    ])
    .join("\n");
}
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function torItems(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 30)
    throw new Error("Use up to 30 TOR duties.");
  return value.map((item) => string(item, "TOR duty", 1000));
}
export function validateSubmission(app: any) {
  if (
    !app.position ||
    !app.office ||
    !validDate(app.start_date) ||
    !validDate(app.end_date) ||
    app.end_date < app.start_date
  )
    throw new Error("Complete the position, office and valid contract dates.");
  const personal = personalDetails(app.personal_details);
  if (app.form_version === 2) {
    const required = [
      "first_name",
      "middle_name",
      "last_name",
      "suffix",
      "birth_date",
      "sex",
      "civil_status",
      "address",
      "ustp_id",
      "prc_license",
    ];
    if (required.some((key) => !personal[key]))
      throw new Error("Complete all Personal fields; use N/A where indicated.");
    if (
      ["first_name", "last_name", "ustp_id"].some(
        (key) => personal[key].toUpperCase() === "N/A",
      )
    )
      throw new Error("First name, last name and USTP ID are required.");
    if (
      !validDate(personal.birth_date) ||
      personal.birth_date >= new Date().toISOString().slice(0, 10)
    )
      throw new Error("Enter a valid date of birth in the past.");
    if (
      !["Female", "Male"].includes(personal.sex) ||
      !["Single", "Married", "Widowed", "Separated"].includes(
        personal.civil_status,
      )
    )
      throw new Error("Select sex and civil status from the list.");
    const education = educationDetails(app.education_details);
    if (
      ["bachelor", "master", "doctorate", "eligibility"].some(
        (key) => !education[key],
      )
    )
      throw new Error(
        "Complete degree and eligibility details; use N/A or None if not applicable.",
      );
    const contact = contactDetails(app.contact_details);
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) ||
      !contact.phone ||
      ["tin", "pagibig", "sss", "philhealth"].some(
        (key) => !contact[key as keyof typeof contact],
      )
    )
      throw new Error(
        "Complete your USTP/office email, phone and government numbers; use N/A where applicable.",
      );
    const contract = contractDetails(app.contract_details);
    if (
      !contract.daily_rate ||
      !contract.supervisor ||
      !contract.supervisor_position
    )
      throw new Error(
        "Complete daily rate, immediate supervisor and supervisor position.",
      );
    const duties = torItems(app.tor_items);
    if (
      !duties.length ||
      duties.some((d) => !d) ||
      !duties.some((d) => d.toUpperCase() !== "N/A")
    )
      throw new Error(
        "Enter at least one TOR duty. Remove unused rows or enter N/A.",
      );
    return;
  }
  if (
    ["full_name", "nationality", "civil_status", "address", "valid_id"].some(
      (key) => !personal[key],
    )
  )
    throw new Error("Complete all personal details for the contract.");
  const contract = contractDetails(app.contract_details);
  if (
    [
      "contract_date",
      "daily_rate",
      "duration",
      "chancellor",
      "chancellor_id",
      "supervisor",
      "hrmo_director",
      "finance_director",
    ].some((key) => !contract[key])
  )
    throw new Error(
      "Complete the contract, compensation and signatory details in your application.",
    );
  const contact = contactDetails(app.contact_details);
  if (!contact.phone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email))
    throw new Error("Complete a valid contact email and contact number.");
  const education = educationDetails(app.education_details);
  if (education.graduation_year && !/^\d{4}$/.test(education.graduation_year))
    throw new Error("Enter a four-digit graduation year or leave it blank.");
  const sections = torSections(app.tor_sections);
  if (
    !sections.length ||
    sections.some(
      (s) =>
        !s.title ||
        !s.functions.length ||
        s.functions.some(
          (f) =>
            !f.text || !f.activities.length || f.activities.some((a) => !a),
        ),
    )
  )
    throw new Error(
      "Complete each TOR section, function and activity before submitting.",
    );
  if (Math.abs(sections.reduce((sum, s) => sum + s.weight, 0) - 100) > 0.001)
    throw new Error("TOR section weights must total 100%.");
}
export function validateContract(app: any) {
  validateSubmission(app);
  const c = contractDetails(app.contract_details);
  if (
    [
      "contract_date",
      "chancellor",
      "chancellor_id",
      "hrmo_director",
      "finance_director",
    ].some((key) => !c[key])
  )
    throw new Error(
      "Complete the university signatories and signing date before generating a contract.",
    );
}
