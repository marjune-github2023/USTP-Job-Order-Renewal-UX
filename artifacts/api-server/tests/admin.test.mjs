import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync, spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
const require = createRequire(
  new URL("../../../lib/db/package.json", import.meta.url),
);
const { Pool } = require("pg");
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const base = process.env.TEST_API_URL;
if (!base || !process.env.DATABASE_URL || !process.env.RESEND_BASE_URL)
  throw new Error(
    "Configure disposable DB, TEST_API_URL and local RESEND_BASE_URL.",
  );
if (
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.RESEND_BASE_URL).hostname,
  )
)
  throw new Error("Tests require a local email emulator.");
const tag = randomUUID(),
  password = randomBytes(24).toString("hex"),
  adminEmail = `admin-${tag}@example.test`;
execFileSync(process.execPath, ["lib/db/scripts/create-hrmo.mjs"], {
  env: { ...process.env, HRMO_EMAIL: adminEmail, HRMO_PASSWORD: password },
  stdio: "pipe",
});
function client(server = base) {
  let cookie = "";
  return async (path, method = "GET", body, expected = 200) => {
    const response = await fetch(`${server}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "USTP-Portal",
        Cookie: cookie,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.headers.get("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    const data = response.headers
      .get("content-type")
      ?.includes("application/json")
      ? await response.json()
      : Buffer.from(await response.arrayBuffer());
    assert.equal(
      response.status,
      expected,
      `${method} ${path}: ${JSON.stringify(data)}`,
    );
    return data;
  };
}
const hrmo = client(),
  applicant = client(),
  stranger = client();
let account, office, importedUser;
async function emailToken(email) {
  const headers = { Authorization: `Bearer ${process.env.RESEND_API_KEY}` };
  const list = await (
    await fetch(`${process.env.RESEND_BASE_URL}/emails`, { headers })
  ).json();
  const row = list.data
    .toReversed()
    .find((r) => (Array.isArray(r.to) ? r.to.includes(email) : r.to === email));
  assert.ok(row, "reset email was captured");
  const message = await (
    await fetch(`${process.env.RESEND_BASE_URL}/emails/${row.id}`, { headers })
  ).json();
  assert.match(message.subject, /password/i);
  const token = message.text.match(/reset-password=([a-f0-9]{64})/)?.[1];
  assert.ok(token, "reset email contains a link");
  return token;
}
const form = {
  position: "Computer Maintenance Technologist III",
  office: "",
  start_date: "2026-10-01",
  end_date: "2026-12-31",
  wizard_step: 8,
  personal_details: {
    first_name: "Alex",
    middle_name: "N/A",
    last_name: "Example",
    suffix: "III",
    birth_date: "1990-01-02",
    sex: "Male",
    civil_status: "Single",
    address: "Example Address, Claveria",
    ustp_id: "TEST-USTP-900",
    prc_license: "N/A",
  },
  education_details: {
    bachelor: "Bachelor of Science in Information Technology",
    master: "N/A",
    doctorate: "N/A",
    eligibility: "None",
  },
  contact_details: {
    email: "office@example.test",
    phone: "09123456789",
    tin: "N/A",
    pagibig: "TEST-PAGIBIG",
    sss: "N/A",
    philhealth: "N/A",
  },
  contract_details: {
    daily_rate: "594.96",
    supervisor: "Example Supervisor",
    supervisor_position: "Director, ICT Office",
  },
  tor_items: ["Maintain campus connectivity.", "Prepare monthly reports."],
  tor_sections: [],
};
test("HRMO administration and Google Form workflow", async (t) => {
  await t.test("role boundaries and office directory", async () => {
    await hrmo("/auth/login", "POST", { email: adminEmail, password });
    account = (
      await applicant("/auth/register", "POST", {
        name: "Alex Example",
        email: `alex-${tag}@example.test`,
        password,
      })
    ).user;
    await stranger("/admin/users", "GET", undefined, 401);
    for (const path of [
      "/admin/users",
      "/admin/offices",
      "/admin/contract-settings",
    ])
      await applicant(path, "GET", undefined, 403);
    await applicant(
      "/admin/users/import",
      "POST",
      { csv: "name,email\nX,x@example.test" },
      403,
    );
    await applicant("/admin/offices", "POST", { name: "No" }, 403);
    const seeded = await applicant("/offices");
    assert.ok(seeded.some((o) => o.name === "ICT Office"));
    office = await hrmo(
      "/admin/offices",
      "POST",
      { name: `Test office ${tag}` },
      201,
    );
    await hrmo(
      "/admin/offices",
      "POST",
      { name: office.name.toUpperCase() },
      409,
    );
    assert.ok((await applicant("/offices")).some((o) => o.id === office.id));
    await hrmo(`/admin/offices/${office.id}`, "PATCH", { active: false });
    assert.ok(!(await applicant("/offices")).some((o) => o.id === office.id));
    await hrmo(`/admin/offices/${office.id}`, "PATCH", { active: true });
    form.office = office.name;
  });
  await t.test(
    "CSV analysis, quoting, duplicates, no overwrites and concurrent imports",
    async () => {
      const csv = `\uFEFFemail,name\r\nnew-${tag}@example.test,"Example, New"\r\nNEW-${tag}@example.test,Duplicate\r\n${account.email.toUpperCase()},Overwrite Attempt\r\nnot-email,Bad\r\nother-${tag}@example.test,\r\n`;
      const analysis = await hrmo("/admin/users/analyze", "POST", { csv });
      assert.deepEqual(
        analysis.rows.map((r) => r.status),
        ["new", "duplicate", "existing", "invalid", "invalid"],
      );
      assert.equal(analysis.rows[0].name, "Example, New");
      await hrmo(
        "/admin/users/analyze",
        "POST",
        { csv: "name,email,role\nA,a@example.test,hrmo" },
        400,
      );
      await hrmo(
        "/admin/users/analyze",
        "POST",
        { csv: 'name,email\n"Unclosed,a@example.test' },
        400,
      );
      await hrmo(
        "/admin/users/import",
        "POST",
        { csv: csv + "Extra,x@example.test", digest: analysis.digest },
        409,
      );
      const results = await Promise.all([
        hrmo("/admin/users/import", "POST", { csv, digest: analysis.digest }),
        hrmo("/admin/users/import", "POST", { csv, digest: analysis.digest }),
      ]);
      assert.equal(
        results.reduce((n, r) => n + r.imported, 0),
        1,
      );
      const users = (await hrmo("/admin/users")).users;
      importedUser = users.find((u) => u.email === `new-${tag}@example.test`);
      assert.equal(importedUser.role, "applicant");
      assert.equal(users.find((u) => u.id === account.id).name, account.name);
      assert.ok(!users.some((u) => "password_hash" in u));
      assert.equal(
        (
          await hrmo("/admin/users/import", "POST", {
            csv,
            digest: analysis.digest,
          })
        ).imported,
        0,
      );
    },
  );
  await t.test(
    "new form validation, saved profile and active office enforcement",
    async () => {
      const app = await applicant("/applications", "POST", undefined, 201);
      form.id = app.id;
      assert.equal(app.form_version, 2);
      await applicant(
        `/applications/${app.id}/submit`,
        "POST",
        { version: 1 },
        400,
      );
      await applicant(
        `/applications/${app.id}`,
        "PUT",
        { ...form, office: "Unknown Office", version: 1 },
        400,
      );
      await applicant(
        `/applications/${app.id}`,
        "PUT",
        { ...form, tor_items: Array(31).fill("Duty"), version: 1 },
        400,
      );
      let saved = await applicant(`/applications/${app.id}`, "PUT", {
        ...form,
        contract_details: {
          ...form.contract_details,
          chancellor: "Unauthorized Signatory",
        },
        version: 1,
        form_version: 1,
      });
      assert.equal(saved.form_version, 2);
      assert.equal(saved.personal_details.full_name, "ALEX EXAMPLE III");
      assert.equal(saved.personal_details.valid_id, "TEST-USTP-900");
      assert.equal(saved.contract_details.chancellor, "");
      assert.equal(
        saved.education_details.bachelor,
        form.education_details.bachelor,
      );
      assert.equal(saved.contact_details.pagibig, "TEST-PAGIBIG");
      assert.equal(saved.wizard_step, 8);
      await hrmo(`/admin/offices/${office.id}`, "PATCH", { active: false });
      await applicant(
        `/applications/${app.id}/submit`,
        "POST",
        { version: saved.version },
        400,
      );
      await hrmo(`/admin/offices/${office.id}`, "PATCH", { active: true });
      for (const invalid of [
        {
          personal_details: {
            ...form.personal_details,
            birth_date: "2030-01-01",
          },
        },
        { education_details: { ...form.education_details, master: "" } },
        { contact_details: { ...form.contact_details, pagibig: "" } },
        { tor_items: ["N/A"] },
      ]) {
        saved = await applicant(`/applications/${app.id}`, "PUT", {
          ...form,
          ...invalid,
          version: saved.version,
        });
        await applicant(
          `/applications/${app.id}/submit`,
          "POST",
          { version: saved.version },
          400,
        );
      }
      saved = await applicant(`/applications/${app.id}`, "PUT", {
        ...form,
        version: saved.version,
      });
      await applicant(`/applications/${app.id}/submit`, "POST", {
        version: saved.version,
      });
      saved = await hrmo(`/applications/${app.id}`);
      await hrmo(
        `/applications/${app.id}`,
        "PUT",
        { ...form, version: saved.version },
        403,
      );
      await hrmo(`/applications/${app.id}/review`, "POST", {
        status: "approved",
        note: "Verified.",
        version: saved.version,
      });
    },
  );
  await t.test(
    "shared contract settings, stale settings and PDF generation",
    async () => {
      const initial = await hrmo("/admin/contract-settings");
      const details = {
        chancellor: "Example Chancellor, Ph.D.",
        chancellor_id: "TEST-CHANCELLOR",
        hrmo_director: "Example HRMO Director",
        finance_director: "Example Finance Director, CPA",
        contract_date: "2026-10-01",
      };
      await applicant(
        "/admin/contract-settings",
        "PUT",
        { details, revision: initial.revision },
        403,
      );
      await hrmo(
        "/admin/contract-settings",
        "PUT",
        {
          details: { ...details, contract_date: "2026-02-30" },
          revision: initial.revision,
        },
        400,
      );
      await hrmo("/admin/contract-settings", "PUT", {
        details,
        revision: initial.revision,
      });
      await hrmo(
        "/admin/contract-settings",
        "PUT",
        { details, revision: initial.revision },
        409,
      );
      const app = await hrmo(`/applications/${form.id}`);
      await hrmo(`/applications/${form.id}/contract`, "POST", {
        version: app.version,
      });
      const pdf = await applicant(`/applications/${form.id}/contract`);
      assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
      writeFileSync("/tmp/google-form-api-contract.pdf", pdf);
      await stranger(
        `/applications/${form.id}/contract`,
        "GET",
        undefined,
        401,
      );
    },
  );
  await t.test(
    "HRMO emails a single-use reset; changing password revokes sessions",
    async () => {
      await applicant(
        `/admin/users/${account.id}/reset-password`,
        "POST",
        undefined,
        403,
      );
      await hrmo(`/admin/users/${account.id}/reset-password`, "POST");
      await hrmo(
        `/admin/users/${account.id}/reset-password`,
        "POST",
        undefined,
        429,
      );
      const token = await emailToken(account.email);
      const stored = (
        await db.query(
          "SELECT token_hash FROM password_resets WHERE user_id=$1",
          [account.id],
        )
      ).rows[0];
      assert.notEqual(stored.token_hash, token);
      assert.equal(
        stored.token_hash,
        createHash("sha256").update(token).digest("hex"),
      );
      await stranger(
        "/auth/reset-password",
        "POST",
        { token, password: "short" },
        400,
      );
      const newPassword = randomBytes(24).toString("hex");
      await stranger("/auth/reset-password", "POST", {
        token,
        password: newPassword,
      });
      await stranger(
        "/auth/reset-password",
        "POST",
        { token, password: newPassword },
        400,
      );
      await applicant("/auth/me", "GET", undefined, 401);
      await stranger(
        "/auth/login",
        "POST",
        { email: account.email, password },
        401,
      );
      await stranger("/auth/login", "POST", {
        email: account.email,
        password: newPassword,
      });
      await hrmo(`/admin/users/${importedUser.id}/reset-password`, "POST");
      const setupToken = await emailToken(importedUser.email);
      await db.query(
        "UPDATE password_resets SET expires_at=now()-interval '1 second' WHERE user_id=$1",
        [importedUser.id],
      );
      await stranger(
        "/auth/reset-password",
        "POST",
        { token: setupToken, password: newPassword },
        400,
      );
      await db.query(
        "UPDATE password_resets SET created_at=now()-interval '2 minutes' WHERE user_id=$1",
        [importedUser.id],
      );
      await hrmo(`/admin/users/${importedUser.id}/reset-password`, "POST");
      const validToken = await emailToken(importedUser.email);
      await stranger(
        "/auth/reset-password",
        "POST",
        { token: setupToken, password: newPassword },
        400,
      );
      await stranger("/auth/reset-password", "POST", {
        token: validToken,
        password: newPassword,
      });
      await stranger("/auth/login", "POST", {
        email: importedUser.email,
        password: newPassword,
      });
    },
  );
  await t.test(
    "email provider failure rolls back the reset request",
    async () => {
      const fake = createServer((_req, res) => {
        res.writeHead(503);
        res.end("Unavailable");
      });
      await new Promise((resolve) => fake.listen(0, "127.0.0.1", resolve));
      const child = spawn(
        process.execPath,
        ["artifacts/api-server/dist/index.mjs"],
        {
          env: {
            ...process.env,
            PORT: "5003",
            RESEND_BASE_URL: `http://127.0.0.1:${fake.address().port}`,
          },
          stdio: "ignore",
        },
      );
      try {
        let ready = false;
        for (let n = 0; n < 50; n++) {
          try {
            ready = (await fetch("http://localhost:5003/api/healthz")).ok;
          } catch {}
          if (ready) break;
          await new Promise((r) => setTimeout(r, 100));
        }
        assert.ok(ready, "failure-test API ready");
        const failing = client("http://localhost:5003");
        await failing("/auth/login", "POST", { email: adminEmail, password });
        const before = (
          await db.query(
            "SELECT token_hash FROM password_resets WHERE user_id=$1",
            [account.id],
          )
        ).rows;
        await failing(
          `/admin/users/${account.id}/reset-password`,
          "POST",
          undefined,
          503,
        );
        assert.deepEqual(
          (
            await db.query(
              "SELECT token_hash FROM password_resets WHERE user_id=$1",
              [account.id],
            )
          ).rows,
          before,
        );
      } finally {
        child.kill("SIGTERM");
        await new Promise((resolve) => fake.close(resolve));
      }
    },
  );
});
test.after(async () => {
  await db.end();
});
