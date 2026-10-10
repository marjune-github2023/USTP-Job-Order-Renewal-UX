import { Router, raw } from "express";
import { pool } from "@workspace/db";
import { fail } from "../lib/http";
import { verify } from "../lib/security";
import {
  analyzeBackup,
  listRecovery,
  maxBackupBytes,
  readRecovery,
  restoreBackup,
  snapshot,
} from "../lib/database-backup";

const database = Router();
const attempts = new Map<string, { count: number; until: number }>();
database.get("/", async (_req, res) =>
  res.json({ recovery: await listRecovery(), max_bytes: maxBackupBytes }),
);
database.use(async (req, res, next) => {
  const now = Date.now();
  for (const [id, entry] of attempts)
    if (entry.until < now) attempts.delete(id);
  const userId = res.locals.user.id;
  const entry = attempts.get(userId) || { count: 0, until: now + 15 * 60_000 };
  if (entry.count >= 5)
    fail(429, "Too many incorrect passwords. Try again in 15 minutes.");
  // Count concurrent attempts before the asynchronous password derivation.
  entry.count++;
  attempts.set(userId, entry);
  const encoded = req.get("X-Backup-Password") || "";
  if (encoded.length > 2048) fail(403, "Enter your current HRMO password.");
  const password = decodeURIComponent(encoded);
  const user = (
    await pool.query(
      "SELECT password_hash FROM portal_users WHERE id=$1 AND role='hrmo'",
      [userId],
    )
  ).rows[0];
  if (
    !password ||
    password.length > 128 ||
    !user ||
    !(await verify(password, user.password_hash))
  )
    fail(403, "Enter your current HRMO password.");
  entry.count--;
  next();
});
database.post("/download", async (_req, res) => {
  res
    .type("application/sql")
    .attachment(
      `USTP-backup-${new Date().toISOString().replaceAll(":", "-")}.sql`,
    )
    .send(await snapshot());
});
database.post("/recovery/:name", async (req, res) => {
  const sql = await readRecovery(req.params.name);
  res.type("application/sql").attachment(req.params.name).send(sql);
});
database.use(raw({ type: "application/sql", limit: maxBackupBytes }));
function sqlFile(body: unknown) {
  if (!Buffer.isBuffer(body) || !body.length)
    fail(400, "Upload a portal SQL backup using application/sql.");
  return body.toString("utf8");
}
database.post("/analyze", async (req, res) => {
  const client = await pool.connect();
  try {
    const { created, counts, digest } = await analyzeBackup(
      sqlFile(req.body),
      client,
    );
    res.json({ created, counts, digest });
  } finally {
    client.release();
  }
});
database.post("/restore", async (req, res) => {
  if (req.get("X-Restore-Confirmation") !== "RESTORE")
    fail(400, "Type RESTORE to confirm replacement of current records.");
  const result = await restoreBackup(
    sqlFile(req.body),
    req.get("X-Backup-Digest") || "",
  );
  res.clearCookie("ustp_session", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure:
      process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === "true"
      : process.env.NODE_ENV === "production",
  });
  res.json({
    ...result,
    message:
      "Restore completed. Everyone must sign in again using an account and password from the backup.",
  });
});
export default database;
