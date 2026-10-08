import test from "node:test";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../../lib/db/package.json", import.meta.url),
);
const { Pool } = require("pg");
const legacyDb = new Pool({ connectionString: process.env.DATABASE_URL });
test.after(() => legacyDb.end());
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const base = process.env.TEST_API_URL;
if (!base || !process.env.DATABASE_URL)
  throw new Error(
    "Set TEST_API_URL and DATABASE_URL to a disposable test deployment.",
  );
const tag = randomUUID();
const password = randomBytes(24).toString("hex");
function client() {
  let cookie = "";
  return async (
    path,
    { method = "GET", body, headers = {}, expected = 200, raw = false } = {},
  ) => {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        "X-Requested-With": "USTP-Portal",
        "Content-Type": raw ? "application/octet-stream" : "application/json",
        Cookie: cookie,
        ...headers,
      },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      cookie = setCookie.split(";")[0];
      if (path !== "/auth/logout") assert.match(setCookie, /HttpOnly/i);
    }
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
    // Exercise applications saved under the original eight-step schema.
    // New Google Form applications are covered separately in admin.test.mjs.
    if (
      path === "/applications" &&
      method === "POST" &&
      response.status === 201
    ) {
      await legacyDb.query(
        "UPDATE applications SET form_version=1 WHERE id=$1",
        [data.id],
      );
      data.form_version = 1;
    }
    return { data, response };
  };
}
const alice = client(),
  bob = client(),
  hrmo = client(),
  anonymous = client();
const pdf = Buffer.from("%PDF-1.4\nSynthetic integration test TOR\n%%EOF");
const documentHeaders = {
  "X-File-Name": "terms.pdf",
  "X-Document-Kind": "tor",
};
let applicationId, documentId;
const details = {
  position: "Administrative Assistant",
  wizard_step: 3,
  education_details: {
    highest_education: "College graduate",
    school: "Example College",
    course: "Information Technology",
    graduation_year: "2020",
  },
  contact_details: { email: "alice@example.test", phone: "09123456789" },
  contract_details: {
    contract_date: "2026-10-01",
    daily_rate: "1227.27",
    duration: "Three months",
    chancellor: "Example Chancellor, Ph.D.",
    chancellor_id: "Test ID 002",
    supervisor: "Example Supervisor",
    hrmo_director: "Example HRMO Director",
    finance_director: "Example Finance Director, CPA",
  },
  office: "Test office",
  start_date: "2026-10-01",
  end_date: "2026-12-31",
  personal_details: {
    full_name: "Alice Applicant",
    nationality: "Filipino",
    civil_status: "single",
    address: "123 Example Street, Claveria",
    valid_id: "Test ID 001",
  },
  tor_sections: [
    {
      title: "Core Functions",
      weight: 90,
      functions: [
        { text: "Maintain records", activities: ["Prepare monthly reports."] },
      ],
    },
    {
      title: "Mandatory Support Functions",
      weight: 10,
      functions: [
        {
          text: "Attend meetings",
          activities: ["Participate in the general assembly."],
        },
      ],
    },
  ],
};
// Provision through the same local-only administrative command used by operators.
execFileSync(process.execPath, ["lib/db/scripts/create-hrmo.mjs"], {
  env: {
    ...process.env,
    HRMO_EMAIL: `hrmo-${tag}@example.test`,
    HRMO_PASSWORD: password,
  },
  stdio: "pipe",
});

test("persistent applicant-to-HRMO workflow and authorization boundaries", async (t) => {
  await t.test(
    "authentication, CSRF header, and role escalation protection",
    async () => {
      await anonymous("/applications", { expected: 401 });
      await anonymous("/auth/register", {
        method: "POST",
        headers: { "X-Requested-With": "" },
        expected: 403,
        body: {},
      });
      await anonymous("/auth/register", {
        method: "POST",
        expected: 400,
        body: { name: "Test", email: "bad", password },
      });
      const { data } = await alice("/auth/register", {
        method: "POST",
        body: {
          name: "Alice Applicant",
          email: `alice-${tag}@example.test`,
          password,
          role: "hrmo",
        },
      });
      assert.equal(data.user.role, "applicant");
      assert.equal(data.user.password_hash, undefined);
      await bob("/auth/register", {
        method: "POST",
        body: {
          name: "Bob Applicant",
          email: `bob-${tag}@example.test`,
          password,
        },
      });
      await anonymous("/auth/login", {
        method: "POST",
        body: {
          email: `alice-${tag}@example.test`,
          password: "incorrect password",
        },
        expected: 401,
      });
      await hrmo("/auth/login", {
        method: "POST",
        body: { email: `hrmo-${tag}@example.test`, password },
      });
    },
  );
  await t.test(
    "draft persistence, private records, and optimistic concurrency",
    async () => {
      const { data } = await alice("/applications", {
        method: "POST",
        expected: 201,
      });
      applicationId = data.id;
      await bob(`/applications/${applicationId}`, { expected: 404 });
      await hrmo(`/applications/${applicationId}`, { expected: 404 });
      await alice(`/applications/${applicationId}/submit`, {
        method: "POST",
        body: { version: 1 },
        expected: 400,
      });
      await alice(`/applications/${applicationId}`, {
        method: "PUT",
        body: { ...details, version: 1 },
      });
      await alice(`/applications/${applicationId}`, {
        method: "PUT",
        body: { ...details, office: "stale change", version: 1 },
        expected: 409,
      });
      const fresh = client();
      await fresh("/auth/login", {
        method: "POST",
        body: { email: `alice-${tag}@example.test`, password },
      });
      assert.equal(
        (await fresh(`/applications/${applicationId}`)).data.office,
        details.office,
      );
      assert.equal((await bob("/applications")).data.length, 0);
      assert.equal(
        (await hrmo("/applications")).data.some((a) => a.id === applicationId),
        false,
      );
      await alice(`/applications/${applicationId}/submit`, {
        method: "POST",
        body: { version: 1 },
        expected: 409,
      });
    },
  );
  await t.test(
    "file validation, private download, and draft deletion",
    async () => {
      await alice(`/applications/${applicationId}/documents`, {
        method: "POST",
        raw: true,
        body: Buffer.from("<html>bad</html>"),
        headers: documentHeaders,
        expected: 400,
      });
      await alice(`/applications/${applicationId}/documents`, {
        method: "POST",
        raw: true,
        body: Buffer.alloc(5 * 1024 * 1024 + 1),
        headers: documentHeaders,
        expected: 413,
      });
      await bob(`/applications/${applicationId}/documents`, {
        method: "POST",
        raw: true,
        body: pdf,
        headers: documentHeaders,
        expected: 404,
      });
      await alice(`/applications/${applicationId}/documents`, {
        method: "POST",
        raw: true,
        body: pdf,
        headers: documentHeaders,
      });
      documentId = (await alice(`/applications/${applicationId}`)).data
        .documents[0].id;
      await bob(`/applications/${applicationId}/documents/${documentId}`, {
        expected: 404,
      });
      const download = await alice(
        `/applications/${applicationId}/documents/${documentId}`,
      );
      assert.deepEqual(download.data, pdf);
      assert.match(
        download.response.headers.get("content-disposition"),
        /^attachment/,
      );
      await alice(`/applications/${applicationId}/documents/${documentId}`, {
        method: "DELETE",
      });
      await alice(`/applications/${applicationId}/documents/${documentId}`, {
        expected: 404,
      });
      await alice(`/applications/${applicationId}/documents`, {
        method: "POST",
        raw: true,
        body: pdf,
        headers: documentHeaders,
      });
    },
  );
  await t.test(
    "submission locks editing and appears in HRMO queue",
    async () => {
      const { data } = await alice(`/applications/${applicationId}`);
      documentId = data.documents[0].id;
      await alice(`/applications/${applicationId}/submit`, {
        method: "POST",
        body: { version: data.version },
      });
      await alice(`/applications/${applicationId}`, {
        method: "PUT",
        body: { ...details, version: data.version + 1 },
        expected: 403,
      });
      await alice(`/applications/${applicationId}/documents/${documentId}`, {
        method: "DELETE",
        expected: 403,
      });
      await alice(`/applications/${applicationId}/documents`, {
        method: "POST",
        raw: true,
        body: pdf,
        headers: documentHeaders,
        expected: 403,
      });
      assert.equal(
        (await hrmo("/applications")).data.some((a) => a.id === applicationId),
        true,
      );
      await hrmo(`/applications/${applicationId}/documents/${documentId}`);
      await alice(`/applications/${applicationId}/review`, {
        method: "POST",
        body: { status: "approved", note: "", version: data.version + 1 },
        expected: 403,
      });
    },
  );
  await t.test(
    "HRMO review, return, corrections, and approval history",
    async () => {
      let app = (await hrmo(`/applications/${applicationId}`)).data;
      await hrmo(`/applications/${applicationId}/review`, {
        method: "POST",
        body: { status: "returned", note: "", version: app.version },
        expected: 400,
      });
      await hrmo(`/applications/${applicationId}/review`, {
        method: "POST",
        body: {
          status: "under_review",
          note: "Checking documents",
          version: app.version,
        },
      });
      await hrmo(`/applications/${applicationId}/review`, {
        method: "POST",
        body: { status: "approved", note: "", version: app.version },
        expected: 409,
      });
      app = (await hrmo(`/applications/${applicationId}`)).data;
      await hrmo(`/applications/${applicationId}/review`, {
        method: "POST",
        body: {
          status: "returned",
          note: "Please clarify duties.",
          version: app.version,
        },
      });
      app = (await alice(`/applications/${applicationId}`)).data;
      assert.equal(app.events.at(-1).note, "Please clarify duties.");
      await alice(`/applications/${applicationId}`, {
        method: "PUT",
        body: {
          ...details,
          tor_sections: [
            {
              title: "Core Functions",
              weight: 100,
              functions: [
                {
                  text: "Updated duties with monthly deliverables.",
                  activities: ["Submit an accurate monthly report."],
                },
              ],
            },
          ],
          version: app.version,
        },
      });
      await alice(`/applications/${applicationId}/submit`, {
        method: "POST",
        body: { version: app.version + 1 },
      });
      app = (await hrmo(`/applications/${applicationId}`)).data;
      await hrmo(`/applications/${applicationId}/review`, {
        method: "POST",
        body: { status: "approved", note: "Complete.", version: app.version },
      });
      app = (await alice(`/applications/${applicationId}`)).data;
      assert.equal(app.status, "approved");
      assert.deepEqual(
        app.events.map((e) => e.status),
        ["submitted", "under_review", "returned", "submitted", "approved"],
      );
      await hrmo(`/applications/${applicationId}/review`, {
        method: "POST",
        body: {
          status: "under_review",
          note: "Invalid transition",
          version: app.version,
        },
        expected: 409,
      });
    },
  );
  await t.test(
    "structured TOR validation, submission without upload, and contract permissions",
    async () => {
      const created = (
        await alice("/applications", { method: "POST", expected: 201 })
      ).data;
      await alice(`/applications/${created.id}`, {
        method: "PUT",
        body: {
          ...details,
          version: created.version,
          tor_sections: [{ ...details.tor_sections[0], weight: 90 }],
        },
      });
      await alice(`/applications/${created.id}/submit`, {
        method: "POST",
        body: { version: 2 },
        expected: 400,
      });
      await alice(`/applications/${created.id}`, {
        method: "PUT",
        body: { ...details, version: 2 },
      });
      await alice(`/applications/${created.id}/submit`, {
        method: "POST",
        body: { version: 3 },
      });
      await hrmo(`/applications/${created.id}/contract`, {
        method: "POST",
        body: { version: 4 },
        expected: 409,
      });
      await alice(`/applications/${applicationId}/contract`, {
        method: "POST",
        body: { version: 1 },
        expected: 403,
      });
      await alice(`/applications/${applicationId}/contract-details`, {
        method: "PUT",
        body: { version: 1, contract_details: {} },
        expected: 403,
      });
      await bob(`/applications/${applicationId}/contract`, { expected: 404 });
      await alice(`/applications/${applicationId}/contract`, { expected: 404 });
    },
  );
  await t.test(
    "applicant owns encoding; HRMO only reviews and generates",
    async () => {
      let app = (await hrmo(`/applications/${applicationId}`)).data;
      await hrmo(`/applications/${applicationId}`, {
        method: "PUT",
        body: { ...details, version: app.version },
        expected: 403,
      });
      await hrmo(`/applications/${applicationId}/contract-details`, {
        method: "PUT",
        body: {
          contract_details: details.contract_details,
          version: app.version,
        },
        expected: 403,
      });
      await alice(`/applications/${applicationId}`, {
        method: "PUT",
        body: { ...details, version: app.version },
        expected: 403,
      });
      await hrmo(`/applications/${applicationId}/contract`, {
        method: "POST",
        body: { version: app.version },
      });
      const download = await alice(`/applications/${applicationId}/contract`);
      assert.equal(
        download.response.headers.get("content-type"),
        "application/pdf",
      );
      assert.equal(download.data.subarray(0, 5).toString(), "%PDF-");
      assert.match(
        download.response.headers.get("content-disposition"),
        /attachment/,
      );
      if (process.env.TEST_CONTRACT_OUTPUT)
        writeFileSync(process.env.TEST_CONTRACT_OUTPUT, download.data);
      await bob(`/applications/${applicationId}/contract`, { expected: 404 });
      app = (await hrmo(`/applications/${applicationId}`)).data;
      assert.equal(app.events.at(-1).status, "contract_generated");
      await hrmo(`/applications/${applicationId}/review`, {
        method: "POST",
        body: {
          status: "returned",
          note: "Please correct the compensation.",
          version: app.version,
        },
      });
      await alice(`/applications/${applicationId}/contract`, { expected: 404 });
      app = (await alice(`/applications/${applicationId}`)).data;
      const correction = {
        ...details,
        contract_details: {
          ...details.contract_details,
          daily_rate: "1300.00",
        },
        version: app.version,
        wizard_step: 5,
      };
      await alice(`/applications/${applicationId}`, {
        method: "PUT",
        body: correction,
      });
      app = (await alice(`/applications/${applicationId}`)).data;
      assert.equal(app.contract_details.daily_rate, "1300.00");
      assert.equal(app.wizard_step, 5);
      await alice(`/applications/${applicationId}/submit`, {
        method: "POST",
        body: { version: app.version },
      });
      app = (await hrmo(`/applications/${applicationId}`)).data;
      await hrmo(`/applications/${applicationId}/review`, {
        method: "POST",
        body: {
          status: "approved",
          note: "Corrections verified.",
          version: app.version,
        },
      });
      app = (await hrmo(`/applications/${applicationId}`)).data;
      await hrmo(`/applications/${applicationId}/contract`, {
        method: "POST",
        body: { version: app.version },
      });
      await alice(`/applications/${applicationId}/contract`);
    },
  );
  await t.test(
    "wizard resumes saved steps and requires complete applicant-entered contract data",
    async () => {
      const app = (
        await alice("/applications", { method: "POST", expected: 201 })
      ).data;
      const partial = {
        ...details,
        contract_details: { ...details.contract_details, daily_rate: "" },
        contact_details: { email: "", phone: "" },
        wizard_step: 5,
        version: 1,
      };
      await alice(`/applications/${app.id}`, { method: "PUT", body: partial });
      const saved = (await alice(`/applications/${app.id}`)).data;
      assert.equal(saved.wizard_step, 5);
      assert.equal(saved.education_details.school, "Example College");
      assert.equal(saved.contract_details.supervisor, "Example Supervisor");
      await alice(`/applications/${app.id}/submit`, {
        method: "POST",
        body: { version: 2 },
        expected: 400,
      });
      await alice(`/applications/${app.id}`, {
        method: "PUT",
        body: { ...details, version: 2, wizard_step: 9 },
        expected: 400,
      });
      await alice(`/applications/${app.id}`, {
        method: "PUT",
        body: {
          ...details,
          version: 2,
          contract_details: { ...details.contract_details, daily_rate: "NaN" },
        },
        expected: 400,
      });
      await alice(`/applications/${app.id}`, {
        method: "PUT",
        body: { ...details, version: 2, wizard_step: 8 },
      });
      await alice(`/applications/${app.id}/submit`, {
        method: "POST",
        body: { version: 3 },
      });
    },
  );
  await t.test("logout invalidates the server session", async () => {
    await alice("/auth/logout", { method: "POST" });
    await alice("/auth/me", { expected: 401 });
  });
});
