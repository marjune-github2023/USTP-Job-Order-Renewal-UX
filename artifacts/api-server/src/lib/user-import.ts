import { parse } from "csv-parse/sync";
import { pool } from "@workspace/db";
import { fail } from "./http";
export type ImportRow = {
  row: number;
  name: string;
  email: string;
  status: "new" | "existing" | "duplicate" | "invalid";
  reason: string;
};
export async function analyzeCsv(csv: unknown): Promise<ImportRow[]> {
  if (typeof csv !== "string" || Buffer.byteLength(csv) > 512_000)
    fail(400, "Choose a CSV file up to 500 KB.");
  let records: string[][];
  try {
    records = parse(csv, {
      bom: true,
      skip_empty_lines: true,
      max_record_size: 4096,
      relax_column_count: true,
    });
  } catch {
    fail(400, "Unable to read CSV. Check quotes and comma separators.");
  }
  if (records.length < 2 || records.length > 1001)
    fail(400, "Include a header and 1–1,000 user rows.");
  const header = records.shift()!.map((s) => s.trim().toLowerCase());
  if (
    header.length !== 2 ||
    !header.includes("name") ||
    !header.includes("email")
  )
    fail(
      400,
      "Use exactly these CSV headers: name,email. Imported accounts are applicants.",
    );
  const names = header.indexOf("name"),
    emails = header.indexOf("email");
  const seen = new Set<string>();
  const rows = records.map((values, index): ImportRow => {
    const name = (values[names] || "").trim(),
      email = (values[emails] || "").trim().toLowerCase();
    let reason = "",
      status: ImportRow["status"] = "new";
    if (
      values.length !== 2 ||
      !name ||
      name.length > 120 ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      /[\x00-\x1f]/.test(name + email)
    ) {
      status = "invalid";
      reason =
        "Provide a name (up to 120 characters) and valid email in two columns.";
    } else if (seen.has(email)) {
      status = "duplicate";
      reason = "Email appears earlier in this CSV.";
    }
    if (status !== "invalid") seen.add(email);
    return { row: index + 2, name, email, status, reason };
  });
  const existing = await pool.query(
    "SELECT lower(email) AS email FROM portal_users WHERE lower(email)=ANY($1::text[])",
    [[...seen]],
  );
  const emailsInDatabase = new Set(existing.rows.map((r) => r.email));
  for (const row of rows)
    if (row.status === "new" && emailsInDatabase.has(row.email)) {
      row.status = "existing";
      row.reason = "Account already exists; it will not be changed.";
    }
  return rows;
}
