import { randomUUID } from "node:crypto";
import { initialOffices } from "./offices";
import { pool } from "./index";

/** Idempotent baseline migration. Applied before accepting requests. */
export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS portal_users (
      id uuid PRIMARY KEY, name text NOT NULL, email text UNIQUE NOT NULL,
      password_hash text NOT NULL, role text NOT NULL CHECK (role IN ('applicant','hrmo')),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS portal_users_email_normalized ON portal_users (lower(email));
    CREATE TABLE IF NOT EXISTS password_resets (
      token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
      requested_by uuid NOT NULL REFERENCES portal_users(id),
      created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL
    );
    CREATE INDEX IF NOT EXISTS resets_user ON password_resets(user_id);
    CREATE TABLE IF NOT EXISTS portal_offices (
      id uuid PRIMARY KEY, name text NOT NULL, active boolean NOT NULL DEFAULT true
    );
    CREATE UNIQUE INDEX IF NOT EXISTS offices_name_normalized ON portal_offices (lower(name));
    CREATE TABLE IF NOT EXISTS portal_contract_settings (
      singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
      details jsonb NOT NULL DEFAULT '{}', revision integer NOT NULL DEFAULT 1,
      updated_by uuid REFERENCES portal_users(id), updated_at timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO portal_contract_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;
    CREATE TABLE IF NOT EXISTS portal_migrations (name text PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS portal_sessions (
      token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL
    );
    CREATE TABLE IF NOT EXISTS portal_email_settings (
      singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
      provider text NOT NULL DEFAULT 'server' CHECK(provider IN ('server','google')),
      client_id text NOT NULL DEFAULT '', secret_encrypted text NOT NULL DEFAULT '',
      refresh_encrypted text NOT NULL DEFAULT '', sender text NOT NULL DEFAULT '',
      needs_reconnect boolean NOT NULL DEFAULT false, revision integer NOT NULL DEFAULT 1,
      updated_by uuid REFERENCES portal_users(id), updated_at timestamptz NOT NULL DEFAULT now(),
      last_test_at timestamptz
    );
    INSERT INTO portal_email_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;
    CREATE TABLE IF NOT EXISTS portal_google_oauth (
      state_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
      session_hash text NOT NULL REFERENCES portal_sessions(token_hash) ON DELETE CASCADE,
      settings_revision integer NOT NULL, verifier_encrypted text NOT NULL, expires_at timestamptz NOT NULL
    );
    CREATE TABLE IF NOT EXISTS applications (
      id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES portal_users(id),
      position text NOT NULL DEFAULT '', office text NOT NULL DEFAULT '',
      start_date text NOT NULL DEFAULT '', end_date text NOT NULL DEFAULT '',
      tor text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','submitted','under_review','returned','approved','rejected')),
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE applications ADD COLUMN IF NOT EXISTS tor_sections jsonb NOT NULL DEFAULT '[]';
    ALTER TABLE applications ADD COLUMN IF NOT EXISTS personal_details jsonb NOT NULL DEFAULT '{}';
    ALTER TABLE applications ADD COLUMN IF NOT EXISTS contract_details jsonb NOT NULL DEFAULT '{}';
    ALTER TABLE applications ADD COLUMN IF NOT EXISTS education_details jsonb NOT NULL DEFAULT '{}';
    ALTER TABLE applications ADD COLUMN IF NOT EXISTS contact_details jsonb NOT NULL DEFAULT '{}';
    ALTER TABLE applications ADD COLUMN IF NOT EXISTS form_version integer NOT NULL DEFAULT 1;
    ALTER TABLE applications ADD COLUMN IF NOT EXISTS tor_items jsonb NOT NULL DEFAULT '[]';
    ALTER TABLE applications ADD COLUMN IF NOT EXISTS wizard_step integer NOT NULL DEFAULT 1 CHECK (wizard_step BETWEEN 1 AND 8);
    CREATE TABLE IF NOT EXISTS application_contracts (
      application_id uuid PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
      contents bytea NOT NULL, generated_at timestamptz NOT NULL DEFAULT now(),
      generated_by uuid NOT NULL REFERENCES portal_users(id), application_version integer NOT NULL
    );
    ALTER TABLE application_contracts ADD COLUMN IF NOT EXISTS settings_revision integer;
    CREATE INDEX IF NOT EXISTS applications_owner ON applications(user_id);
    CREATE TABLE IF NOT EXISTS application_documents (
      id uuid PRIMARY KEY, application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      name text NOT NULL, kind text NOT NULL CHECK (kind IN ('tor','supporting')),
      mime text NOT NULL, contents bytea NOT NULL CHECK (octet_length(contents) <= 5242880),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS documents_application ON application_documents(application_id);
    CREATE TABLE IF NOT EXISTS application_events (
      id bigserial PRIMARY KEY, application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      actor_id uuid NOT NULL REFERENCES portal_users(id), status text NOT NULL,
      note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS events_application ON application_events(application_id);
  `);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const seeded = await client.query(
      "INSERT INTO portal_migrations (name) VALUES ('google-form-offices-2026') ON CONFLICT DO NOTHING RETURNING name",
    );
    if (seeded.rowCount)
      for (const name of initialOffices) {
        await client.query(
          "INSERT INTO portal_offices (id,name) VALUES ($1,$2) ON CONFLICT DO NOTHING",
          [randomUUID(), name],
        );
      }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
