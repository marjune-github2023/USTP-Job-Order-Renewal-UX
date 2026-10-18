import database from "./database";
import emailSettings from "./email-settings";
import { validDate } from "../contract/validation";
import { Router } from "express";
import { randomBytes, randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { fail, field, id } from "../lib/http";
import { hash, passwordHash } from "../lib/security";
import { analyzeCsv } from "../lib/user-import";
import { emailConfigured, emailStatus, sendPasswordReset } from "../lib/email";
const admin = Router();
admin.use((_req, res, next) => {
  if (res.locals.user.role !== "hrmo") fail(403, "HRMO access required.");
  next();
});
admin.use("/email", emailSettings);
admin.use("/database", database);
admin.get("/users", async (_req, res) => {
  const users = await pool.query(
    "SELECT id,name,email,role,created_at FROM portal_users ORDER BY created_at DESC",
  );
  res.json({
    users: users.rows,
    ...(await emailStatus()),
  });
});
admin.post("/users/analyze", async (req, res) => {
  res.json({
    rows: await analyzeCsv(req.body?.csv),
    digest: hash(req.body.csv),
  });
});
admin.post("/users/import", async (req, res) => {
  const rows = await analyzeCsv(req.body?.csv);
  if (req.body?.digest !== hash(req.body.csv))
    fail(409, "Analyze this CSV before importing it.");
  const client = await pool.connect();
  let imported = 0;
  try {
    await client.query("BEGIN");
    for (const row of rows
      .filter((r) => r.status === "new")
      .sort((a, b) => a.email.localeCompare(b.email))) {
      // Nobody knows this random password. HRMO sends a setup/reset email separately.
      const result = await client.query(
        "INSERT INTO portal_users (id,name,email,password_hash,role) VALUES ($1,$2,$3,$4,'applicant') ON CONFLICT DO NOTHING",
        [
          randomUUID(),
          row.name,
          row.email,
          await passwordHash(randomBytes(32).toString("hex")),
        ],
      );
      if (result.rowCount) imported++;
      else {
        row.status = "existing";
        row.reason = "Account was created since analysis; skipped.";
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  res.json({ imported, skipped: rows.length - imported, rows });
});
admin.post("/users/:id/reset-password", async (req, res) => {
  if (!(await emailConfigured()))
    fail(
      503,
      "Password reset email is not configured. Ask the administrator to configure the email sender.",
    );
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "SELECT id,email FROM portal_users WHERE id=$1 FOR UPDATE",
      [id(req.params.id)],
    );
    if (!result.rowCount) fail(404, "User not found.");
    const recent = await client.query(
      "SELECT 1 FROM password_resets WHERE user_id=$1 AND created_at > now() - interval '1 minute'",
      [result.rows[0].id],
    );
    if (recent.rowCount)
      fail(
        429,
        "A reset email was sent recently. Wait one minute before trying again.",
      );
    const value = randomBytes(32).toString("hex");
    await client.query("DELETE FROM password_resets WHERE user_id=$1", [
      result.rows[0].id,
    ]);
    await client.query(
      "INSERT INTO password_resets (token_hash,user_id,requested_by,expires_at) VALUES ($1,$2,$3,now()+interval '30 minutes')",
      [hash(value), result.rows[0].id, res.locals.user.id],
    );
    // A provider failure rolls back the replacement token and preserves any previous link.
    await sendPasswordReset(result.rows[0].email, value);
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});
admin.patch("/users/:id/role", async (req, res) => {
  const newRole = req.body?.role;
  if (newRole !== "applicant" && newRole !== "hrmo")
    fail(400, "Role must be 'applicant' or 'hrmo'.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "SELECT id,role FROM portal_users WHERE id=$1 FOR UPDATE",
      [id(req.params.id)],
    );
    if (!result.rowCount) fail(404, "User not found.");
    if (result.rows[0].id === res.locals.user.id)
      fail(400, "You cannot change your own role.");
    await client.query(
      "UPDATE portal_users SET role=$1 WHERE id=$2",
      [newRole, id(req.params.id)],
    );
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});
admin.get("/offices", async (_req, res) => {
  res.json(
    (
      await pool.query(
        "SELECT id,name,active FROM portal_offices ORDER BY name",
      )
    ).rows,
  );
});
admin.post("/offices", async (req, res) => {
  const name = field(req.body?.name, "office name", 160).replace(/\s+/g, " ");
  const result = await pool.query(
    "INSERT INTO portal_offices (id,name) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING *",
    [randomUUID(), name],
  );
  if (!result.rowCount)
    fail(409, "This office already exists. You can reactivate it if needed.");
  res.status(201).json(result.rows[0]);
});
admin.patch("/offices/:id", async (req, res) => {
  if (typeof req.body?.active !== "boolean")
    fail(400, "Choose whether this office is active.");
  const result = await pool.query(
    "UPDATE portal_offices SET active=$1 WHERE id=$2 RETURNING *",
    [req.body.active, id(req.params.id)],
  );
  if (!result.rowCount) fail(404, "Office not found.");
  res.json(result.rows[0]);
});
admin.get("/contract-settings", async (_req, res) => {
  const settings = (
    await pool.query(
      "SELECT * FROM portal_contract_settings WHERE singleton",
    )
  ).rows[0];
  // Convert logo to base64 if exists
  const response = {
    ...settings,
    header_logo: settings.header_logo && Buffer.isBuffer(settings.header_logo)
      ? settings.header_logo.toString("base64")
      : null,
  };
  res.json(response);
});
admin.put("/contract-settings", async (req, res) => {
  const details: Record<string, string> = {};
  for (const key of [
    "chancellor",
    "chancellor_id",
    "hrmo_director",
    "finance_director",
    "contract_date",
  ])
    details[key] = field(
      req.body?.details?.[key],
      key.replaceAll("_", " "),
      key === "contract_date" ? 10 : 120,
    );
  if (!validDate(details.contract_date))
    fail(400, "Enter a valid signing date.");

  // Handle new contract customization fields
  const contractFields = [
    "contract_title",
    "university_name",
    "university_address",
    "university_ra",
    "whereas_1",
    "whereas_2",
    "whereas_3",
    "clause_4",
    "clause_5",
    "clause_6",
    "clause_7",
    "clause_8",
    "clause_9",
    "clause_10",
    "clause_11",
    "witness_whereof",
    "signing_location",
    "acknowledgment_text",
  ];

  const updateClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  // Always update details
  updateClauses.push(`details = $${paramIndex}`);
  values.push(JSON.stringify(details));
  paramIndex++;

  // Add contract customization fields if provided
  for (const field of contractFields) {
    const value = req.body?.[field];
    if (value !== undefined && value !== null) {
      updateClauses.push(`${field} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  values.push(res.locals.user.id);
  values.push(req.body?.revision);

  const setClauses = updateClauses.join(", ");
  const query = `
    UPDATE portal_contract_settings
    SET ${setClauses}, revision = revision + 1, updated_by = $${paramIndex}, updated_at = now()
    WHERE singleton AND revision = $${paramIndex + 1}
    RETURNING *
  `;

  const result = await pool.query(query, values);
  if (!result.rowCount)
    fail(409, "Contract settings changed. Refresh before saving.");
  res.json(result.rows[0]);
});
admin.post(
  "/contract-settings/logo",
  async (req, res) => {
    const { logo, filename } = req.body;
    if (!logo || !filename)
      fail(400, "Logo and filename are required.");
    let data: Buffer;
    try {
      data = Buffer.from(logo, "base64");
    } catch {
      fail(400, "Invalid logo data.");
    }
    if (!data.length)
      fail(400, "Logo is empty.");
    const mime =
      data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? "image/png"
        : data.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
          ? "image/jpeg"
          : "";
    if (!mime) fail(400, "Only PNG and JPEG images are accepted.");
    const result = await pool.query(
      "UPDATE portal_contract_settings SET header_logo=$1,header_logo_name=$2,revision=revision+1,updated_by=$3,updated_at=now() WHERE singleton RETURNING revision",
      [data, filename, res.locals.user.id],
    );
    res.json({ ok: true, revision: result.rows[0].revision });
  },
);
admin.delete("/contract-settings/logo", async (req, res) => {
  const result = await pool.query(
    "UPDATE portal_contract_settings SET header_logo=NULL,header_logo_name=NULL,revision=revision+1,updated_by=$1,updated_at=now() WHERE singleton AND revision=$2 RETURNING revision",
    [res.locals.user.id, req.body?.revision],
  );
  if (!result.rowCount)
    fail(409, "Contract settings changed. Refresh before saving.");
  res.json({ ok: true, revision: result.rows[0].revision });
});
export default admin;
