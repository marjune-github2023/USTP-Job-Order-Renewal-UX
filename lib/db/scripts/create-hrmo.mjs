import pg from "pg";
import { randomUUID, randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const {
  DATABASE_URL,
  HRMO_EMAIL,
  HRMO_PASSWORD,
  HRMO_NAME = "HRMO Administrator",
  USTP_ADMIN_EMAIL = "ict.claveria@ustp.edu.ph",
} = process.env;
if (
  !DATABASE_URL ||
  !HRMO_EMAIL ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(HRMO_EMAIL) ||
  !HRMO_PASSWORD ||
  HRMO_PASSWORD.length < 12 ||
  HRMO_PASSWORD.length > 128
) {
  throw new Error(
    "Set DATABASE_URL, HRMO_EMAIL and HRMO_PASSWORD (12–128 characters). Start the API once to initialize the database.",
  );
}
const pool = new pg.Pool({ connectionString: DATABASE_URL });
try {
  const salt = randomBytes(16).toString("hex");
  const encoded = (await promisify(scrypt)(HRMO_PASSWORD, salt, 64)).toString(
    "hex",
  );
  const result = await pool.query(
    "INSERT INTO portal_users (id,name,email,password_hash,role) VALUES ($1,$2,$3,$4,'hrmo') ON CONFLICT (email) DO NOTHING RETURNING id",
    [
      randomUUID(),
      HRMO_NAME,
      HRMO_EMAIL.trim().toLowerCase(),
      `${salt}:${encoded}`,
    ],
  );
  if (!result.rowCount)
    throw new Error(
      "An account already exists with that email. No role or password was changed.",
    );
  console.log("HRMO account created.");
  console.log(`Note: With Google OAuth enabled, users with email ${USTP_ADMIN_EMAIL} will automatically receive HRMO role on first login.`);
} finally {
  await pool.end();
}
