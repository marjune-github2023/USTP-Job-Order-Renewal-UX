import { randomUUID } from "node:crypto";
import { initialOffices } from "./offices";
import { pool } from "./index";

/** Idempotent baseline migration. Applied before accepting requests. */
export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS portal_users (
      id uuid PRIMARY KEY, name text NOT NULL, email text UNIQUE NOT NULL,
      password_hash text, role text NOT NULL CHECK (role IN ('applicant','hrmo')),
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
      updated_by uuid REFERENCES portal_users(id), updated_at timestamptz NOT NULL DEFAULT now(),
      contract_title text DEFAULT 'Know All Men by These Presents:',
      university_name text DEFAULT 'UNIVERSITY OF SCIENCE AND TECHNOLOGY OF SOUTHERN PHILIPPINES-CLAVERIA',
      university_address text DEFAULT 'Magsaysay Street, Poblacion, Claveria, Misamis Oriental',
      university_ra text DEFAULT 'Republic Act No. 10919',
      whereas_1 text DEFAULT 'in order to meet the organizational and staffing requirements vis-a-vis existing manpower complement, as well as to not impair the delivery of government service, USTP, engage the services of Job Order workers in accordance with the provisions of COA-DBM JC No. 2 s. 2020 and COA-DBM JC No. 2 s. 2022, as amended;',
      whereas_2 text DEFAULT 'USTP need the services of Job Order workers, who shall perform work not performed by its regular personnel as learning service provider;',
      whereas_3 text DEFAULT 'WORKER has signified intention to provide the services needed by USTP and enter into a Job Order contract, to which the latter accepted;',
      clause_4 text DEFAULT 'Payment of the WORKER''s wages shall be made semi-monthly not later than 20th day and 5th day of a calendar month following the 1st quincenna and 2nd quincenna, respectively. Anent the budgeting, accounting and auditing rules and regulations, timely payment of wages, is subject to WORKER''s complete submission of the required Payroll''s supporting documents on or before the cut-off date and time (every 16th and 1st working day of the following month at 12:00 noon); otherwise, processing of payment shall proceed upon receipt of complete supporting documents. USTP shall deduct or withhold any and all statutory obligations as may be required by law.',
      clause_5 text DEFAULT 'Subject to availability of funds as certified by the USTP''s accountant, the WORKER may be paid for work rendered beyond the regular eight (8) hours of duty, after the submission of the following requirements, to wit: 5.1 Approved Request for Extension; 5.2 Accomplishment Report; and 5.3 Latest monthly DTR reflecting the rendered extension.',
      clause_6 text DEFAULT 'In case of Holiday/s which falls from Monday to Friday, the WORKER may be allowed to render "holiday duty" on the day the holiday falls, subject to the requirements enumerated in the preceding paragraph.',
      clause_7 text DEFAULT 'In the event when the maximum twenty-two (22) compensable days cannot be availed due to lesser number of working days in a particular month and/or holiday/s, the WORKER may be allowed to render extension of service or "holiday duty", respectively, on any of the Saturday(s) falling in the calendar month, subject to the requirements enumerated in item 5 of this contract.',
      clause_8 text DEFAULT 'The PARTIES understood that, this contract does not create an employer-employee relationship between them, that, the services rendered hereunder are not considered and will not be credited as government service, and that, the WORKER, shall not be entitled to ACA and PERA, and other emoluments due to an employee;',
      clause_9 text DEFAULT 'The WORKER shall maintain strict confidentiality during and after the effectivity of this Contract, any and all information not made available to the public, that are obtained in the course of performance of duties as Job Order worker in compliance with the Republic Act No. 10173 or Data Privacy Act and its Implementing Rules and Regulations (IRR);',
      clause_10 text DEFAULT 'This Contract may be terminated for violation of any provisions hereunder or for just/lawful cause, effective on the 30th day after due receipt of a written notice duly communicated by either party;',
      clause_11 text DEFAULT 'USTP reserves the right to pre-terminate this Contract immediately and without prior notice to the WORKER, upon Indorsement of the concerned immediate supervisor in any of the following grounds: 11.1 Unsatisfactory Performance of the WORKER. The concerned Immediate Supervisor shall attach the basis for the result of evaluation; 11.2 WORKER''s conduct that is prejudicial to the interest of USTP.',
      witness_whereof text DEFAULT 'the parties hereunder affixed their signatures',
      signing_location text DEFAULT 'Magsaysay St., Poblacion, Claveria Misamis Oriental, Philippines',
      header_logo bytea,
      header_logo_name text,
      acknowledgment_text text DEFAULT 'I hereby acknowledge that I have received a copy of this Job Order Contract, read and understood the contents thereof, and agree to abide by the terms and conditions stipulated herein.'
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
    CREATE TABLE IF NOT EXISTS google_oauth_states (
      state_hash text PRIMARY KEY,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
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
