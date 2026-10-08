import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
const require = createRequire(
  new URL("../../../lib/db/package.json", import.meta.url),
);
const { Pool } = require("pg");
if (
  !process.env.DATABASE_URL ||
  !new URL(process.env.DATABASE_URL).pathname.endsWith("_backup_test") ||
  !process.env.TEST_API_URL ||
  !process.env.BACKUP_DIRECTORY
)
  throw new Error(
    "Use a separate disposable *_backup_test database/API and private BACKUP_DIRECTORY.",
  );
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const base = process.env.TEST_API_URL;
const email = `backup-${randomUUID()}@example.test`;
const password = randomBytes(20).toString("hex") + "ñ%";
execFileSync(process.execPath, ["lib/db/scripts/create-hrmo.mjs"], {
  env: { ...process.env, HRMO_EMAIL: email, HRMO_PASSWORD: password },
  stdio: "pipe",
});
function client() {
  let cookie = "";
  return async (
    route,
    {
      body,
      sql,
      expected = 200,
      password: pwd = password,
      extra = {},
      method = "POST",
    } = {},
  ) => {
    const response = await fetch(base + "/api" + route, {
      method,
      headers: {
        "Content-Type":
          sql === undefined ? "application/json" : "application/sql",
        "X-Requested-With": "USTP-Portal",
        "X-Backup-Password": encodeURIComponent(pwd),
        Cookie: cookie,
        ...extra,
      },
      body:
        method === "GET"
          ? undefined
          : (sql ?? (body === undefined ? undefined : JSON.stringify(body))),
    });
    if (response.headers.has("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    const data = response.headers.get("content-type")?.includes("json")
      ? await response.json()
      : await response.text();
    assert.equal(
      response.status,
      expected,
      `${route}: ${typeof data === "string" ? data.slice(0, 180) : JSON.stringify(data)}`,
    );
    return data;
  };
}
const hr = client(),
  applicant = client(),
  anonymous = client();
const checksum = (sql) => {
  const payload = sql.slice(0, sql.lastIndexOf("-- SHA256:"));
  return (
    payload +
    `-- SHA256: ${createHash("sha256").update(payload).digest("hex")}\n`
  );
};
const restore = (sql, digest, extra = {}) =>
  hr("/admin/database/restore", {
    sql,
    extra: {
      "X-Restore-Confirmation": "RESTORE",
      "X-Backup-Digest": digest,
      ...extra,
    },
  });
const login = () => hr("/auth/login", { body: { email, password } });
let backup, preview, adminId, applicationId;
const binary = Buffer.from([0, 255, 92, 39, 10, 13, 1, 42]);
const tables = [
  "portal_users",
  "portal_offices",
  "portal_migrations",
  "portal_contract_settings",
  "portal_email_settings",
  "applications",
  "application_documents",
  "application_contracts",
  "application_events",
];
async function records() {
  return Object.fromEntries(
    await Promise.all(
      tables.map(async (t) => [
        t,
        (
          await db.query(
            `SELECT row_to_json(t)::text AS row FROM ${t} t ORDER BY row_to_json(t)::text`,
          )
        ).rows.map((r) => r.row),
      ]),
    ),
  );
}
test("database SQL backup and restore", async (t) => {
  t.after(() => db.end());
  await login();
  adminId = (
    await db.query("SELECT id FROM portal_users WHERE email=$1", [email])
  ).rows[0].id;
  const owner = await applicant("/auth/register", {
    body: {
      name: "O'Neil \\ Unicode ñ",
      email: `applicant-${randomUUID()}@example.test`,
      password,
    },
  });
  const app = await applicant("/applications", { body: {}, expected: 201 });
  applicationId = app.id;
  await db.query("UPDATE applications SET position=$1,tor=$2 WHERE id=$3", [
    "O'Neil \\ analyst ñ",
    "line 1\n'); DROP TABLE portal_users; --",
    app.id,
  ]);
  await db.query(
    "INSERT INTO application_documents(id,application_id,name,kind,mime,contents) VALUES($1,$2,$3,'supporting','application/pdf',$4)",
    [randomUUID(), app.id, "document ñ.pdf", binary],
  );
  await db.query(
    "INSERT INTO application_contracts(application_id,contents,generated_by,application_version) VALUES($1,$2,$3,1)",
    [app.id, binary, adminId],
  );
  await db.query(
    "INSERT INTO application_events(id,application_id,actor_id,status,note) VALUES(9007199254740993,$1,$2,'draft',$3) ON CONFLICT(id) DO UPDATE SET note=excluded.note",
    [app.id, adminId, "precision test"],
  );

  await t.test("HRMO, password and origin protection", async () => {
    await anonymous("/admin/database/download", { expected: 401 });
    await applicant("/admin/database/download", { expected: 403 });
    await hr("/admin/database/download", {
      password: "incorrect",
      expected: 403,
    });
    await hr("/admin/database/download", {
      extra: { "X-Requested-With": "" },
      expected: 403,
    });
  });
  let expected;
  await t.test(
    "complete SQL file includes binary records and excludes active tokens",
    async () => {
      backup = await hr("/admin/database/download");
      assert.ok(backup.startsWith("-- USTP portal data backup v1\n"));
      assert.equal(checksum(backup), backup);
      assert.ok(
        backup.includes(
          "ALTER SEQUENCE public.application_events_id_seq RESTART WITH 9007199254740994;",
        ),
      );
      assert.ok(!backup.includes("INSERT INTO public.portal_sessions"));
      preview = await hr("/admin/database/analyze", { sql: backup });
      assert.ok(preview.counts.portal_users >= 2);
      assert.ok(preview.counts.application_documents >= 1);
      expected = await records();
    },
  );
  await t.test(
    "corrupt, incompatible, arbitrary and appended SQL are rejected",
    async () => {
      for (const sql of [
        "DROP TABLE portal_users;",
        backup.slice(0, -10),
        backup.replace("O''Neil", "Changed"),
        checksum(
          backup.replace(
            /-- Schema: [a-f0-9]+/,
            "-- Schema: " + "0".repeat(64),
          ),
        ),
        checksum(
          backup.replace("COMMIT;", "COMMIT;\nDROP TABLE portal_users;"),
        ),
        checksum(backup.replace("-- Table: portal_offices\n", "")),
      ]) {
        await hr("/admin/database/analyze", { sql, expected: 400 });
      }
      assert.deepEqual(await records(), expected);
      await hr("/admin/database/restore", { sql: backup, expected: 400 });
      await hr("/admin/database/restore", {
        sql: backup,
        extra: {
          "X-Restore-Confirmation": "RESTORE",
          "X-Backup-Digest": "wrong",
        },
        expected: 409,
      });
      assert.deepEqual(await records(), expected);
    },
  );
  await t.test(
    "database lock excludes restore during requests and requests during restore",
    async () => {
      const gate = await db.connect();
      try {
        await gate.query("BEGIN");
        await gate.query("SELECT pg_advisory_xact_lock_shared(726381,1)");
        await hr("/admin/database/restore", { sql: backup, expected: 503 });
        await gate.query("ROLLBACK");
        await gate.query("BEGIN");
        await gate.query("SELECT pg_advisory_xact_lock(726381,1)");
        await hr("/auth/me", { method: "GET", expected: 503 });
      } finally {
        await gate.query("ROLLBACK");
        gate.release();
      }
      await hr("/auth/me", { method: "GET" });
    },
  );
  await t.test(
    "restore rolls back invalid records and retains a private recovery copy",
    async () => {
      const bad = checksum(
        backup.replace(
          new RegExp(
            `(INSERT INTO public.applications[^\\n]*"user_id"\\s*:\\s*")[^"]+`,
          ),
          `$1${randomUUID()}`,
        ),
      );
      const analysis = await hr("/admin/database/analyze", { sql: bad });
      const beforeSequence = (
        await db.query(
          "SELECT last_value::text,is_called FROM application_events_id_seq",
        )
      ).rows;
      await hr("/admin/database/restore", {
        sql: bad,
        expected: 400,
        extra: {
          "X-Restore-Confirmation": "RESTORE",
          "X-Backup-Digest": analysis.digest,
        },
      });
      assert.deepEqual(await records(), expected);
      assert.deepEqual(
        (
          await db.query(
            "SELECT last_value::text,is_called FROM application_events_id_seq",
          )
        ).rows,
        beforeSequence,
      );
      const copies = (await hr("/admin/database", { method: "GET" })).recovery;
      assert.ok(copies.length >= 1);
      assert.ok(
        (await hr(`/admin/database/recovery/${copies[0].name}`)).startsWith(
          "-- USTP",
        ),
      );
    },
  );
  await t.test(
    "failure to save recovery prevents any record replacement",
    async () => {
      const { rename, writeFile, unlink } = await import("node:fs/promises");
      const dir = process.env.BACKUP_DIRECTORY;
      await rename(dir, dir + ".held");
      try {
        await writeFile(dir, "simulate unavailable backup volume", {
          mode: 0o600,
        });
        await hr("/admin/database/restore", {
          sql: backup,
          expected: 500,
          extra: {
            "X-Restore-Confirmation": "RESTORE",
            "X-Backup-Digest": preview.digest,
          },
        });
        assert.deepEqual(await records(), expected);
      } finally {
        await unlink(dir);
        await rename(dir + ".held", dir);
      }
    },
  );
  await t.test(
    "oversized upload is rejected before parsing or changing records",
    async () => {
      await hr("/admin/database/analyze", {
        sql: "x".repeat(50 * 1024 * 1024 + 1),
        expected: 413,
      });
      assert.deepEqual(await records(), expected);
    },
  );
  await t.test(
    "restore replaces records, preserves bytes and clears sessions/reset tokens",
    async () => {
      await db.query(
        "UPDATE applications SET position='changed after backup' WHERE id=$1",
        [applicationId],
      );
      await db.query(
        "INSERT INTO password_resets(token_hash,user_id,requested_by,expires_at) VALUES($1,$2,$2,now()+interval '30 minutes')",
        [randomBytes(32).toString("hex"), adminId],
      );
      const result = await restore(backup, preview.digest);
      assert.match(result.recovery, /^recovery-/);
      assert.deepEqual(await records(), expected);
      assert.deepEqual(
        (
          await db.query(
            "SELECT contents FROM application_contracts WHERE application_id=$1",
            [applicationId],
          )
        ).rows[0].contents,
        binary,
      );
      assert.equal(
        (await db.query("SELECT count(*)::int AS n FROM portal_sessions"))
          .rows[0].n,
        0,
      );
      assert.equal(
        (await db.query("SELECT count(*)::int AS n FROM password_resets"))
          .rows[0].n,
        0,
      );
      await hr("/auth/me", { method: "GET", expected: 401 });
      await applicant("/auth/me", { method: "GET", expected: 401 });
      await login();
      assert.equal(
        (
          await db.query(
            "SELECT nextval('application_events_id_seq')::text AS n",
          )
        ).rows[0].n,
        "9007199254740994",
      );
      const recoverySql = await hr(
        `/admin/database/recovery/${result.recovery}`,
      );
      assert.ok(recoverySql.includes("changed after backup"));
      const recoveryPreview = await hr("/admin/database/analyze", {
        sql: recoverySql,
      });
      await restore(recoverySql, recoveryPreview.digest);
      assert.equal(
        (
          await db.query("SELECT position FROM applications WHERE id=$1", [
            applicationId,
          ])
        ).rows[0].position,
        "changed after backup",
      );
      await login();
    },
  );
  await t.test(
    "downloaded SQL is directly executable on the matching PostgreSQL schema",
    async () => {
      await db.query(backup);
      assert.deepEqual(await records(), expected);
      await login();
      const { stat } = await import("node:fs/promises");
      for (const name of (await readdir(process.env.BACKUP_DIRECTORY)).filter(
        (n) => n.endsWith(".sql"),
      )) {
        const file = `${process.env.BACKUP_DIRECTORY}/${name}`;
        assert.equal((await stat(file)).mode & 0o777, 0o600);
        assert.equal(
          checksum(await readFile(file, "utf8")),
          await readFile(file, "utf8"),
        );
      }
    },
  );
});
