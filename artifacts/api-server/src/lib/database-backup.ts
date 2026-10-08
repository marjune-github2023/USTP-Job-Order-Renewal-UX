import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, rename, readdir, stat, readFile } from "node:fs/promises";
import path from "node:path";
import { pool, type PoolClient } from "@workspace/db";
import { fail } from "./http";

export const maxBackupBytes = 50 * 1024 * 1024;
export const tables = [
  "portal_users",
  "portal_offices",
  "portal_migrations",
  "portal_contract_settings",
  "portal_email_settings",
  "applications",
  "application_documents",
  "application_contracts",
  "application_events",
] as const;
const transient = ["portal_google_oauth", "password_resets", "portal_sessions"];
const allTables = [...transient, ...tables];
const deletion = [...transient, ...[...tables].reverse()].map(
  (t) => `DELETE FROM public.${t};`,
);
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const directory = () =>
  path.resolve(process.env.BACKUP_DIRECTORY || ".private-backups");
const prefix = "-- USTP portal data backup v1";
const sequence = (value: string) =>
  `ALTER SEQUENCE public.application_events_id_seq RESTART WITH ${value};`;

async function schema(client: PoolClient) {
  const result = await client.query(
    `SELECT table_name,column_name,data_type,is_nullable,column_default
    FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1)
    ORDER BY table_name,ordinal_position`,
    [allTables],
  );
  if (allTables.some((t) => !result.rows.some((r) => r.table_name === t)))
    fail(409, "The portal database schema is incomplete.");
  return {
    hash: digest(JSON.stringify(result.rows)),
    columns: Object.fromEntries(
      tables.map((t) => [
        t,
        result.rows
          .filter((r) => r.table_name === t)
          .map((r) => r.column_name as string),
      ]),
    ),
  };
}
export async function createBackup(client: PoolClient) {
  const shape = await schema(client);
  const lines = [
    prefix,
    `-- Created: ${new Date().toISOString()}`,
    `-- Schema: ${shape.hash}`,
    "BEGIN;",
    "SET LOCAL standard_conforming_strings = on;",
    ...deletion,
  ];
  let bytes = 0;
  let nextEvent = "1";
  for (const table of tables) {
    lines.push(`-- Table: ${table}`);
    // Read serialized PostgreSQL values (including bytea and exact timestamps)
    // rather than converting dates or bigint IDs through JavaScript.
    await client.query(
      `DECLARE backup_rows NO SCROLL CURSOR FOR SELECT row_to_json(t)::text AS data FROM public.${table} t`,
    );
    while (true) {
      const result = await client.query("FETCH NEXT FROM backup_rows");
      if (!result.rowCount) break;
      const { data } = result.rows[0];
      const line = `INSERT INTO public.${table} SELECT * FROM json_populate_record(NULL::public.${table}, '${data.replaceAll("'", "''")}');`;
      bytes += Buffer.byteLength(line) + 1;
      if (bytes > maxBackupBytes - 8192)
        fail(
          413,
          "Database exceeds the 50 MB portal backup limit. Ask the administrator to use pg_dump.",
        );
      lines.push(line);
    }
    await client.query("CLOSE backup_rows");
  }
  nextEvent = (
    await client.query(
      "SELECT (COALESCE(max(id),0)+1)::text AS value FROM application_events",
    )
  ).rows[0].value;
  lines.push(sequence(nextEvent), "COMMIT;");
  const sql = lines.join("\n") + "\n";
  return sql + `-- SHA256: ${digest(sql)}\n`;
}
export async function snapshot() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const sql = await createBackup(client);
    await client.query("COMMIT");
    return sql;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function analyzeBackup(sql: string, client: PoolClient) {
  if (Buffer.byteLength(sql) > maxBackupBytes)
    fail(413, "SQL backup exceeds 50 MB.");
  const lines = sql.split("\n");
  const checksum = lines.at(-2);
  if (lines.at(-1) !== "" || !checksum?.match(/^-- SHA256: [a-f0-9]{64}$/))
    fail(400, "Choose a complete SQL backup downloaded from this portal.");
  const payload = lines.slice(0, -2).join("\n") + "\n";
  if (checksum !== `-- SHA256: ${digest(payload)}`)
    fail(
      400,
      "Backup checksum does not match. The file is damaged or has been edited.",
    );
  const shape = await schema(client);
  if (lines[0] !== prefix || lines[2] !== `-- Schema: ${shape.hash}`)
    fail(
      400,
      "This backup format or database schema is incompatible. Use the matching portal version.",
    );
  const created = lines[1]?.slice(12);
  if (
    !/^-- Created: \d{4}-\d\d-\d\dT/.test(lines[1]) ||
    !Number.isFinite(Date.parse(created))
  )
    fail(400, "Backup date is invalid.");
  let index = 3;
  const expect = (line: string) => {
    if (lines[index++] !== line)
      fail(
        400,
        "Unsupported or incomplete SQL backup. Only portal-generated backups can be restored here.",
      );
  };
  expect("BEGIN;");
  expect("SET LOCAL standard_conforming_strings = on;");
  deletion.forEach(expect);
  const records: Record<string, string[]> = {};
  let maxEvent = 0n;
  for (const table of tables) {
    expect(`-- Table: ${table}`);
    records[table] = [];
    const start = `INSERT INTO public.${table} SELECT * FROM json_populate_record(NULL::public.${table}, '`;
    while (lines[index]?.startsWith(start)) {
      const line = lines[index++];
      if (!line.endsWith("');")) fail(400, "Invalid backup record.");
      const literal = line.slice(start.length, -3);
      if (/(?:^|[^'])'(?:[^']|$)/.test(literal.replaceAll("''", "")))
        fail(400, "Invalid SQL string.");
      const json = literal.replaceAll("''", "'");
      let row;
      try {
        row = JSON.parse(json);
      } catch {
        fail(400, "Invalid backup record.");
      }
      if (
        !row ||
        Array.isArray(row) ||
        typeof row !== "object" ||
        Object.keys(row).sort().join() !==
          [...shape.columns[table]].sort().join()
      )
        fail(400, "Backup record columns do not match the database.");
      if (table === "application_events") {
        // Read the exact integer from JSON text; JSON.parse loses bigserial precision.
        const value = json.match(/"id"\s*:\s*(\d+)\s*[,}]/)?.[1];
        if (!value) fail(400, "Invalid history identifier.");
        if (BigInt(value) > maxEvent) maxEvent = BigInt(value);
      }
      records[table].push(json);
    }
  }
  expect(sequence(String(maxEvent + 1n)));
  expect("COMMIT;");
  if (index !== lines.length - 2) fail(400, "Unexpected SQL in backup.");
  if (
    !records.portal_users.some((json) => {
      const u = JSON.parse(json);
      return (
        u.role === "hrmo" &&
        /^[a-f0-9]{32}:[a-f0-9]{128}$/.test(u.password_hash)
      );
    })
  )
    fail(400, "Backup must include an HRMO account with a valid password.");
  for (const table of ["portal_contract_settings", "portal_email_settings"]) {
    if (
      records[table].length !== 1 ||
      JSON.parse(records[table][0]).singleton !== true
    )
      fail(400, "Backup settings are incomplete.");
  }
  return {
    records,
    created,
    digest: digest(sql),
    counts: Object.fromEntries(tables.map((t) => [t, records[t].length])),
    nextEvent: String(maxEvent + 1n),
  };
}
export async function saveRecovery(sql: string) {
  await mkdir(directory(), { recursive: true, mode: 0o700 });
  const name = `recovery-${Date.now()}-${randomUUID()}.sql`;
  const temporary = path.join(directory(), name + ".tmp");
  const file = await open(temporary, "wx", 0o600);
  try {
    await file.writeFile(sql, "utf8");
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(temporary, path.join(directory(), name));
  const folder = await open(directory(), "r");
  try {
    await folder.sync();
  } finally {
    await folder.close();
  }
  return name;
}
export async function listRecovery() {
  const names = await readdir(directory()).catch((e) => {
    if (e.code === "ENOENT") return [];
    throw e;
  });
  return Promise.all(
    names
      .filter((n) => /^recovery-\d+-[a-f0-9-]{36}\.sql$/.test(n))
      .sort()
      .reverse()
      .map(async (name) => ({
        name,
        bytes: (await stat(path.join(directory(), name))).size,
      })),
  );
}
export async function readRecovery(name: string) {
  if (!/^recovery-\d+-[a-f0-9-]{36}\.sql$/.test(name))
    fail(400, "Invalid recovery file.");
  try {
    return await readFile(path.join(directory(), name), "utf8");
  } catch (e: any) {
    if (e.code === "ENOENT") fail(404, "Recovery backup not found.");
    throw e;
  }
}
export async function restoreBackup(sql: string, expectedDigest: string) {
  const client = await pool.connect();
  let recovery = "";
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '60s'");
    await client.query(
      `LOCK TABLE ${allTables.map((t) => `public.${t}`).join(",")} IN ACCESS EXCLUSIVE MODE`,
    );
    const backup = await analyzeBackup(sql, client);
    if (backup.digest !== expectedDigest)
      fail(409, "Analyze this file again before restoring.");
    recovery = await saveRecovery(await createBackup(client));
    for (const statement of deletion) await client.query(statement);
    for (const table of tables)
      for (const json of backup.records[table]) {
        // Uploaded SQL is NEVER executed. Values are bound to known table queries.
        await client.query(
          `INSERT INTO public.${table} SELECT * FROM json_populate_record(NULL::public.${table}, $1::json)`,
          [json],
        );
      }
    await client.query(sequence(backup.nextEvent));
    await client.query("COMMIT");
    return { recovery, counts: backup.counts };
  } catch (error) {
    await client.query("ROLLBACK");
    if (recovery)
      fail(
        400,
        `Restore failed; current records were kept. Recovery copy: ${recovery}. Check that the file contains valid, complete records.`,
      );
    throw error;
  } finally {
    client.release();
  }
}
