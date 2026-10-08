import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
const require = createRequire(
  new URL("../../../lib/db/package.json", import.meta.url),
);
const { Pool } = require("pg");
if (
  !process.env.TEST_API_URL ||
  !process.env.DATABASE_URL ||
  !new URL(process.env.DATABASE_URL).pathname.endsWith("_test")
)
  throw new Error("Use a disposable *_test database and API.");
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const password = randomBytes(24).toString("hex"),
  tag = randomUUID();
const adminEmail = `renewal-hrmo-${tag}@example.test`;
execFileSync(process.execPath, ["lib/db/scripts/create-hrmo.mjs"], {
  env: { ...process.env, HRMO_EMAIL: adminEmail, HRMO_PASSWORD: password },
  stdio: "pipe",
});
function client() {
  let cookie = "";
  return async (path, method = "GET", body, expected = 200) => {
    const response = await fetch(process.env.TEST_API_URL + "/api" + path, {
      method,
      headers: {
        "X-Requested-With": "USTP-Portal",
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.headers.has("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    const data = await response.json();
    assert.ok(
      [expected].flat().includes(response.status),
      `${path} status ${response.status}: ${JSON.stringify(data)}`,
    );
    return data;
  };
}
const owner = client(),
  other = client(),
  hr = client(),
  anonymous = client();
const form = {
  position: "Administrative Assistant",
  office: `Renewal test office ${tag}`,
  start_date: "2026-10-01",
  end_date: "2026-12-31",
  wizard_step: 8,
  personal_details: {
    first_name: "Jamie",
    middle_name: "N/A",
    last_name: "Example",
    suffix: "N/A",
    birth_date: "1990-01-02",
    sex: "Female",
    civil_status: "Single",
    address: "Example Address",
    ustp_id: "RENEW-001",
    prc_license: "N/A",
  },
  education_details: {
    bachelor: "Bachelor of Science in Information Technology",
    master: "N/A",
    doctorate: "N/A",
    eligibility: "None",
  },
  contact_details: {
    email: "renewal@example.test",
    phone: "09123456789",
    tin: "N/A",
    pagibig: "N/A",
    sss: "N/A",
    philhealth: "N/A",
  },
  contract_details: {
    daily_rate: "594.96",
    supervisor: "Example Supervisor",
    supervisor_position: "Office Head",
  },
  tor_items: ["Maintain records.", "Prepare monthly reports."],
  tor_sections: [],
};
async function approvedSource() {
  const draft = await owner("/applications", "POST", {}, 201);
  const saved = await owner(`/applications/${draft.id}`, "PUT", {
    ...form,
    version: draft.version,
  });
  await owner(`/applications/${draft.id}/submit`, "POST", {
    version: saved.version,
  });
  const submitted = await owner(`/applications/${draft.id}`);
  await hr(`/applications/${draft.id}/review`, "POST", {
    status: "approved",
    version: submitted.version,
    note: "Approved test fixture",
  });
  return owner(`/applications/${draft.id}`);
}
test("reuse approved applications for quarterly renewal", async (t) => {
  t.after(() => db.end());
  const account = (
    await owner("/auth/register", "POST", {
      name: "Jamie Example",
      email: `renewal-${tag}@example.test`,
      password,
    })
  ).user;
  await other("/auth/register", "POST", {
    name: "Other applicant",
    email: `other-renewal-${tag}@example.test`,
    password,
  });
  const admin = (
    await hr("/auth/login", "POST", { email: adminEmail, password })
  ).user;
  const office = await hr("/admin/offices", "POST", { name: form.office }, 201);
  let source = await approvedSource();
  await db.query(
    "INSERT INTO application_documents(id,application_id,name,kind,mime,contents) VALUES($1,$2,'previous.pdf','supporting','application/pdf',$3)",
    [randomUUID(), source.id, Buffer.from("%PDF-previous document")],
  );
  await db.query(
    "INSERT INTO application_contracts(application_id,contents,generated_by,application_version) VALUES($1,$2,$3,$4)",
    [
      source.id,
      Buffer.from("%PDF-previous contract"),
      admin.id,
      source.version,
    ],
  );
  source = await owner(`/applications/${source.id}`);
  let renewal;
  await t.test(
    "only the applicant can renew their own approved application",
    async () => {
      await anonymous(`/applications/${source.id}/renew`, "POST", {}, 401);
      await other(`/applications/${source.id}/renew`, "POST", {}, 404);
      await hr(`/applications/${source.id}/renew`, "POST", {}, 403);
      await owner("/applications/not-an-id/renew", "POST", {}, 400);
      const draft = await owner("/applications", "POST", {}, 201);
      await owner(`/applications/${draft.id}/renew`, "POST", {}, 409);
    },
  );
  await t.test(
    "prefills details and TOR while keeping dates, approval and documents separate",
    async () => {
      const result = await owner(
        `/applications/${source.id}/renew`,
        "POST",
        { status: "approved", user_id: admin.id, start_date: "2027-01-01" },
        201,
      );
      assert.equal(result.reused, false);
      renewal = await owner(`/applications/${result.application.id}`);
      assert.notEqual(renewal.id, source.id);
      assert.equal(renewal.user_id, account.id);
      assert.equal(renewal.status, "draft");
      assert.equal(renewal.version, 1);
      assert.equal(renewal.wizard_step, 3);
      assert.equal(renewal.start_date, "");
      assert.equal(renewal.end_date, "");
      for (const key of [
        "position",
        "office",
        "form_version",
        "personal_details",
        "education_details",
        "contact_details",
        "tor_items",
        "tor_sections",
        "tor",
      ])
        assert.deepEqual(renewal[key], source[key], key);
      for (const key of ["daily_rate", "supervisor", "supervisor_position"])
        assert.equal(
          renewal.contract_details[key],
          source.contract_details[key],
        );
      assert.equal(renewal.documents.length, 0);
      assert.equal(renewal.contract, null);
      assert.equal(renewal.events.length, 1);
      assert.match(renewal.events[0].note, new RegExp(source.id));
      await owner(
        `/applications/${renewal.id}/submit`,
        "POST",
        { version: renewal.version },
        400,
      );
      assert.deepEqual(await owner(`/applications/${source.id}`), source);
    },
  );
  await t.test(
    "edits and concurrent Renew clicks preserve a single independent draft",
    async () => {
      renewal = await owner(`/applications/${renewal.id}`, "PUT", {
        ...renewal,
        start_date: "2027-01-01",
        end_date: "2027-03-31",
        tor_items: ["Maintain records.", "Prepare quarterly reports."],
        wizard_step: 8,
      });
      const responses = await Promise.all(
        Array.from({ length: 4 }, () =>
          owner(`/applications/${source.id}/renew`, "POST", {}, 200),
        ),
      );
      for (const r of responses) {
        assert.equal(r.reused, true);
        assert.equal(r.application.id, renewal.id);
        assert.deepEqual(r.application.tor_items, renewal.tor_items);
      }
      assert.deepEqual(await owner(`/applications/${source.id}`), source);
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM application_events WHERE note=$1",
            [`Renewal created from application ${source.id}.`],
          )
        ).rows[0].n,
        1,
      );
    },
  );
  await t.test(
    "renewal requires a new submission and HRMO approval",
    async () => {
      await owner(`/applications/${renewal.id}/submit`, "POST", {
        version: renewal.version,
      });
      const submitted = await owner(`/applications/${renewal.id}`);
      assert.equal(submitted.status, "submitted");
      await hr(`/applications/${renewal.id}/review`, "POST", {
        version: submitted.version,
        status: "returned",
        note: "Check this period's TOR",
      });
      const resumed = await owner(
        `/applications/${source.id}/renew`,
        "POST",
        {},
        200,
      );
      assert.equal(resumed.application.id, renewal.id);
      assert.equal(resumed.application.status, "returned");
      await owner(`/applications/${renewal.id}/submit`, "POST", {
        version: resumed.application.version,
      });
      const resubmitted = await owner(`/applications/${renewal.id}`);
      await hr(`/applications/${renewal.id}/review`, "POST", {
        version: resubmitted.version,
        status: "approved",
        note: "Approved new period",
      });
      assert.equal(
        (await owner(`/applications/${renewal.id}`)).status,
        "approved",
      );
      const next = await owner(
        `/applications/${renewal.id}/renew`,
        "POST",
        {},
        201,
      );
      assert.deepEqual(next.application.tor_items, renewal.tor_items);
      assert.equal(next.application.start_date, "");
      assert.deepEqual(await owner(`/applications/${source.id}`), source);
    },
  );
  await t.test("new-form renewal clears a deactivated office", async () => {
    const second = await approvedSource();
    await hr(`/admin/offices/${office.id}`, "PATCH", { active: false });
    const created = await owner(
      `/applications/${second.id}/renew`,
      "POST",
      {},
      201,
    );
    assert.equal(created.application.office, "");
    assert.equal(
      (await owner(`/applications/${second.id}`)).office,
      form.office,
    );
    await hr(`/admin/offices/${office.id}`, "PATCH", { active: true });
  });
  await t.test(
    "legacy renewals retain weighted TOR and reset the signing date",
    async () => {
      const legacy = await approvedSource();
      const sections = [
        {
          title: "Core functions",
          weight: 100,
          functions: [
            { text: "Maintain records", activities: ["Prepare reports"] },
          ],
        },
      ];
      const contract = {
        ...form.contract_details,
        contract_date: "2026-10-01",
        duration: "Three months",
        chancellor: "Legacy Chancellor",
        chancellor_id: "LEGACY-ID",
        hrmo_director: "Legacy HRMO",
        finance_director: "Legacy Finance",
      };
      await db.query(
        "UPDATE applications SET form_version=1,tor_sections=$1,contract_details=$2 WHERE id=$3",
        [JSON.stringify(sections), JSON.stringify(contract), legacy.id],
      );
      const result = await owner(
        `/applications/${legacy.id}/renew`,
        "POST",
        {},
        201,
      );
      assert.equal(result.application.form_version, 1);
      assert.deepEqual(result.application.tor_sections, sections);
      assert.equal(
        result.application.contract_details.contract_date,
        undefined,
      );
      assert.equal(
        result.application.contract_details.duration,
        "Three months",
      );
      assert.equal(
        (await owner(`/applications/${legacy.id}`)).contract_details
          .contract_date,
        "2026-10-01",
      );
    },
  );
});
