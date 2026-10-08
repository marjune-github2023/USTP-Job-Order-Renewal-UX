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
  res.json(
    (
      await pool.query(
        "SELECT details,revision FROM portal_contract_settings WHERE singleton",
      )
    ).rows[0],
  );
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
  const result = await pool.query(
    "UPDATE portal_contract_settings SET details=$1,revision=revision+1,updated_by=$2,updated_at=now() WHERE singleton AND revision=$3 RETURNING details,revision",
    [JSON.stringify(details), res.locals.user.id, req.body?.revision],
  );
  if (!result.rowCount)
    fail(409, "Contract settings changed. Refresh before saving.");
  res.json(result.rows[0]);
});
export default admin;
