import { randomBytes, createHash, randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { fail } from "./http";

export function googleAuthEndpoints() {
  const override = process.env.GOOGLE_EMULATOR_URL;
  if (override) {
    const url = new URL(override);
    if (
      url.protocol !== "http:" ||
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      fail(503, "The Google emulator override must use a local HTTP endpoint.");
    const base = url.origin;
    return {
      authorize: base + "/o/oauth2/v2/auth",
      token: base + "/oauth2/token",
      userinfo: base + "/oauth2/v2/userinfo",
      local: true,
    };
  }
  return {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    userinfo: "https://www.googleapis.com/oauth2/v2/userinfo",
    local: false,
  };
}

export async function googleAuthTokenRequest(values: Record<string, string>) {
  const response = await fetch(googleAuthEndpoints().token, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
  });
  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    error?: string;
  };
  if (!response.ok || !data.access_token) {
    const error = new Error("Google authorization failed") as Error & {
      code?: string;
    };
    error.code = data.error === "invalid_grant" ? "reconnect" : "provider";
    throw error;
  }
  return data;
}

export function validateUstpEmail(email: string): void {
  if (!email.endsWith("@ustp.edu.ph")) {
    fail(403, "Only @ustp.edu.ph email addresses are allowed.");
  }
}

export async function createOrUpdateUserFromGoogle(
  email: string,
  name: string,
): Promise<{ id: string; name: string; email: string; role: "applicant" | "hrmo" }> {
  const adminEmail = process.env.USTP_ADMIN_EMAIL || "ict.claveria@ustp.edu.ph";
  const emailLower = email.toLowerCase();
  const isAdmin = emailLower === adminEmail.toLowerCase();

  // Check if user exists
  const existing = await pool.query(
    "SELECT id, name, role FROM portal_users WHERE email=$1",
    [emailLower],
  );

  if (existing.rowCount) {
    return {
      id: existing.rows[0].id,
      name: existing.rows[0].name,
      email: emailLower,
      role: existing.rows[0].role,
    };
  }

  // Create new user
  const result = await pool.query(
    "INSERT INTO portal_users (id, name, email, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role",
    [randomUUID(), name, emailLower, isAdmin ? "hrmo" : "applicant"],
  );

  return result.rows[0];
}
