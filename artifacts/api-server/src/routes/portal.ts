import admin from "./admin";
import { databaseGate } from "../lib/database-gate";
import { generateContract } from "../contract/generate";
import {
  personalDetails,
  educationDetails,
  contactDetails,
  contractDetails,
  torSections,
  torItems,
  numberedTor,
  validateSubmission,
  validateContract,
} from "../contract/validation";
import {
  Router,
  json,
  raw,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { randomBytes, randomUUID } from "node:crypto";
import { hash, passwordHash, verify } from "../lib/security";
import { HttpError, fail, field, id } from "../lib/http";
import { pool, type PoolClient } from "@workspace/db";
import {
  googleAuthEndpoints,
  googleAuthTokenRequest,
  validateUstpEmail,
  createOrUpdateUserFromGoogle,
} from "../lib/google-auth";

type User = {
  id: string;
  name: string;
  email: string;
  role: "applicant" | "hrmo";
};
function validate<T>(action: () => T): T {
  try {
    return action();
  } catch (error) {
    fail(400, error instanceof Error ? error.message : "Invalid form data.");
  }
}
const cookieName = "ustp_session";
function token(req: Request) {
  return (
    req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1) || ""
  );
}
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure:
    process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === "true"
      : process.env.NODE_ENV === "production",
  path: "/",
};
const portal: Router = Router();
portal.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Custom header prevents cross-origin form requests; CORS is deliberately disabled.
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.get("X-Requested-With") !== "USTP-Portal"
  ) {
    return next(new HttpError(403, "Invalid request origin."));
  }
  next();
});
portal.use(databaseGate);
portal.use(json({ limit: "1mb" }));
const attempts = new Map<string, { count: number; until: number }>();
portal.use("/auth", (req, _res, next) => {
  if (req.method !== "POST") return next();
  const now = Date.now();
  for (const [key, value] of attempts)
    if (value.until < now) attempts.delete(key);
  const key = req.ip || "unknown";
  const entry = attempts.get(key) || { count: 0, until: now + 15 * 60_000 };
  attempts.set(key, entry);
  if (++entry.count > 30)
    return next(
      new HttpError(429, "Too many attempts. Try again in 15 minutes."),
    );
  next();
});
async function session(
  res: Response,
  user: User,
  expectedPasswordHash?: string,
  skipResponse?: boolean,
) {
  const value = randomBytes(32).toString("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize login with password resets. An old password must never create
    // a fresh session after a reset has revoked all previous sessions.
    const current = await client.query(
      "SELECT password_hash FROM portal_users WHERE id=$1 FOR UPDATE",
      [user.id],
    );
    if (
      !current.rowCount ||
      (expectedPasswordHash &&
        current.rows[0].password_hash !== expectedPasswordHash)
    )
      fail(401, "Password changed. Sign in with your new password.");
    await client.query("DELETE FROM portal_sessions WHERE expires_at < now()");
    await client.query(
      "INSERT INTO portal_sessions VALUES ($1,$2,now() + interval '8 hours')",
      [hash(value), user.id],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  res.cookie(cookieName, value, { ...cookieOptions, maxAge: 8 * 60 * 60_000 });
  if (!skipResponse) res.json({ user });
}
// Google OAuth authentication
portal.get("/auth/google", async (req, res) => {
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!redirectUri || !clientId) {
    fail(503, "Google OAuth is not configured.");
  }

  const state = randomBytes(32).toString("hex");
  const stateHash = hash(state);

  await pool.query(
    "INSERT INTO google_oauth_states (state_hash, expires_at) VALUES ($1, now() + interval '10 minutes')",
    [stateHash],
  );

  const url = new URL(googleAuthEndpoints().authorize);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("hd", "ustp.edu.ph");

  res.redirect(303, url.href);
});

portal.get("/auth/google/callback", async (req, res) => {
  const state = req.query.state;
  const code = req.query.code;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!redirectUri || !clientId || !clientSecret) {
    fail(503, "Google OAuth is not configured.");
  }

  if (typeof state !== "string" || !/^[a-f0-9]{64}$/.test(state)) {
    fail(400, "Invalid OAuth state.");
  }

  if (typeof code !== "string" || code.length > 4096) {
    fail(400, "Invalid authorization code.");
  }

  const stateHash = hash(state);

  // Validate and consume state
  const claimed = await pool.query(
    "DELETE FROM google_oauth_states WHERE state_hash=$1 AND expires_at>now() RETURNING *",
    [stateHash],
  );

  if (!claimed.rowCount) {
    fail(400, "OAuth state expired or invalid.");
  }

  // Exchange code for tokens
  const tokens = await googleAuthTokenRequest({
    client_id: clientId,
    client_secret: clientSecret,
    code: code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  // Fetch user info
  const userResponse = await fetch(googleAuthEndpoints().userinfo, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!userResponse.ok) {
    fail(500, "Failed to fetch user information from Google.");
  }

  const profile = (await userResponse.json()) as {
    email?: string;
    name?: string;
    verified_email?: boolean;
    email_verified?: boolean;
  };

  if (
    !profile.email ||
    !profile.name ||
    profile.email.length > 254 ||
    !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(profile.email) ||
    !(profile.verified_email === true || profile.email_verified === true)
  ) {
    fail(400, "Invalid or unverified Google account.");
  }

  validateUstpEmail(profile.email);

  // Create or update user
  const user = await createOrUpdateUserFromGoogle(profile.email, profile.name);

  // Create session (skip JSON response so redirect works)
  await session(res, user, undefined, true);

  // Redirect to app
  const appUrl = process.env.PUBLIC_APP_URL || "/";
  res.redirect(303, appUrl);
});
portal.post("/auth/logout", async (req, res) => {
  await pool.query("DELETE FROM portal_sessions WHERE token_hash=$1", [
    hash(token(req)),
  ]);
  res.clearCookie(cookieName, cookieOptions).json({ ok: true });
});
portal.post("/auth/reset-password", async (req, res) => {
  const value = req.body?.token,
    password = req.body?.password;
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value))
    fail(400, "This reset link is invalid or expired.");
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  )
    fail(400, "Use a password of 12–128 characters.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Lock the user first, matching the reset-request lock order.
    const result = await client.query(
      "SELECT u.id FROM portal_users u JOIN password_resets r ON r.user_id=u.id WHERE r.token_hash=$1 FOR UPDATE OF u",
      [hash(value)],
    );
    if (!result.rowCount) fail(400, "This reset link is invalid or expired.");
    const consumed = await client.query(
      "DELETE FROM password_resets WHERE token_hash=$1 AND expires_at>now() RETURNING user_id",
      [hash(value)],
    );
    if (!consumed.rowCount) fail(400, "This reset link is invalid or expired.");
    await client.query("UPDATE portal_users SET password_hash=$1 WHERE id=$2", [
      await passwordHash(password),
      result.rows[0].id,
    ]);
    await client.query("DELETE FROM password_resets WHERE user_id=$1", [
      result.rows[0].id,
    ]);
    await client.query("DELETE FROM portal_sessions WHERE user_id=$1", [
      result.rows[0].id,
    ]);
    await client.query("COMMIT");
    res.clearCookie(cookieName, cookieOptions).json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});
portal.use(async (req, res, next) => {
  const result = await pool.query(
    "SELECT u.id,u.name,u.email,u.role FROM portal_sessions s JOIN portal_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()",
    [hash(token(req))],
  );
  if (!result.rowCount) fail(401, "Please sign in.");
  res.locals.user = result.rows[0];
  res.locals.sessionHash = hash(token(req));
  next();
});
portal.get("/auth/me", (_req, res) => res.json({ user: res.locals.user }));
portal.use("/admin", admin);
portal.get("/offices", async (_req, res) =>
  res.json(
    (
      await pool.query(
        "SELECT id,name FROM portal_offices WHERE active ORDER BY name",
      )
    ).rows,
  ),
);
portal.get("/applications", async (_req, res) => {
  const user: User = res.locals.user;
  const result = await pool.query(
    `SELECT a.*,u.name AS applicant_name,u.email AS applicant_email FROM applications a JOIN portal_users u ON u.id=a.user_id WHERE ${user.role === "hrmo" ? "a.status <> 'draft'" : "a.user_id=$1"} ORDER BY a.updated_at DESC`,
    user.role === "hrmo" ? [] : [user.id],
  );
  res.json(result.rows);
});
portal.post("/applications", async (_req, res) => {
  const user: User = res.locals.user;
  if (user.role !== "applicant")
    fail(403, "Only applicants can create applications.");
  const result = await pool.query(
    "INSERT INTO applications (id,user_id,form_version) VALUES ($1,$2,2) RETURNING *",
    [randomUUID(), user.id],
  );
  res.status(201).json(result.rows[0]);
});
// Lock the application for each operation so submissions and document edits cannot race.
async function withApplication(
  req: Request,
  res: Response,
  action: (client: PoolClient, app: any, user: User) => Promise<unknown>,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "SELECT a.*,u.name AS applicant_name,u.email AS applicant_email FROM applications a JOIN portal_users u ON u.id=a.user_id WHERE a.id=$1 FOR UPDATE OF a",
      [id(req.params.id)],
    );
    const app = result.rows[0];
    const user: User = res.locals.user;
    if (
      !app ||
      (user.role !== "hrmo" && app.user_id !== user.id) ||
      (user.role === "hrmo" && app.status === "draft")
    )
      fail(404, "Application not found.");
    const payload = await action(client, app, user);
    await client.query("COMMIT");
    if (!res.headersSent) res.json(payload);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
function editable(app: any, user: User) {
  if (
    user.role !== "applicant" ||
    user.id !== app.user_id ||
    !["draft", "returned"].includes(app.status)
  )
    fail(403, "This application is not editable.");
}
function version(req: Request, app: any) {
  if (req.body?.version !== app.version)
    fail(409, "This application changed. Refresh it before continuing.");
}
// Reuse only applicant-owned approved records. Locking the source serializes
// repeated clicks so they reopen the same unfinished renewal.
portal.post("/applications/:id/renew", (req, res) => {
  if (res.locals.user.role !== "applicant")
    fail(403, "Only applicants can start a renewal.");
  return withApplication(req, res, async (client, source, user) => {
    if (source.status !== "approved")
      fail(409, "Choose an approved application to renew.");
    const note = `Renewal created from application ${source.id}.`;
    const existing = await client.query(
      `SELECT a.* FROM applications a WHERE a.user_id=$1
       AND a.status IN ('draft','returned') AND EXISTS (
         SELECT 1 FROM application_events e WHERE e.application_id=a.id
         AND e.actor_id=$1 AND e.status='draft' AND e.note=$2
       ) ORDER BY a.created_at DESC LIMIT 1 FOR UPDATE OF a`,
      [user.id, note],
    );
    if (existing.rowCount)
      return { application: existing.rows[0], reused: true };
    const result = await client.query(
      `INSERT INTO applications (
        id,user_id,form_version,position,office,tor,tor_sections,tor_items,
        personal_details,education_details,contact_details,contract_details,wizard_step
       ) SELECT $1,user_id,form_version,position,
         CASE WHEN form_version <> 2 OR EXISTS (
           SELECT 1 FROM portal_offices o WHERE o.name=a.office AND o.active
         ) THEN office ELSE '' END,
         tor,tor_sections,tor_items,personal_details,education_details,contact_details,
         CASE WHEN form_version=2 THEN jsonb_build_object(
           'daily_rate',COALESCE(contract_details->>'daily_rate',''),
           'supervisor',COALESCE(contract_details->>'supervisor',''),
           'supervisor_position',COALESCE(contract_details->>'supervisor_position','')
         ) ELSE contract_details - 'contract_date' END,3
       FROM applications a WHERE a.id=$2 RETURNING *`,
      [randomUUID(), source.id],
    );
    await client.query(
      "INSERT INTO application_events (application_id,actor_id,status,note) VALUES ($1,$2,'draft',$3)",
      [result.rows[0].id, user.id, note],
    );
    res.status(201);
    return { application: result.rows[0], reused: false };
  });
});
portal.get("/applications/:id", (req, res) =>
  withApplication(req, res, async (client, app) => {
    const documents = await client.query(
      "SELECT id,name,kind,mime,octet_length(contents) AS size,created_at FROM application_documents WHERE application_id=$1 ORDER BY created_at",
      [app.id],
    );
    const events = await client.query(
      "SELECT e.id,e.status,e.note,e.created_at,u.name AS actor FROM application_events e JOIN portal_users u ON u.id=e.actor_id WHERE application_id=$1 ORDER BY e.id",
      [app.id],
    );
    const contract = await client.query(
      "SELECT generated_at,application_version FROM application_contracts WHERE application_id=$1",
      [app.id],
    );
    return {
      ...app,
      documents: documents.rows,
      events: events.rows,
      contract: contract.rows[0] || null,
    };
  }),
);
portal.put("/applications/:id", (req, res) =>
  withApplication(req, res, async (client, app, user) => {
    editable(app, user);
    version(req, app);
    const sections = validate(() =>
      torSections(req.body.tor_sections ?? app.tor_sections),
    );
    let personal = validate(() =>
      personalDetails(req.body.personal_details ?? app.personal_details),
    );
    const contract = validate(() =>
      contractDetails(req.body.contract_details ?? app.contract_details),
    );
    const education = validate(() =>
      educationDetails(req.body.education_details ?? app.education_details),
    );
    const contact = validate(() =>
      contactDetails(req.body.contact_details ?? app.contact_details),
    );
    const duties = validate(() =>
      torItems(req.body.tor_items ?? app.tor_items),
    );
    if (app.form_version === 2) {
      for (const key of ["first_name", "middle_name", "last_name", "suffix"])
        personal[key] = personal[key].toUpperCase();
      personal.full_name = [
        personal.first_name,
        personal.middle_name,
        personal.last_name,
        personal.suffix,
      ]
        .filter((v) => v && v !== "N/A")
        .join(" ");
      personal.valid_id = personal.ustp_id;
      personal.nationality = "";
      // University values are managed separately and cannot be set by an applicant.
      for (const key of [
        "chancellor",
        "chancellor_id",
        "hrmo_director",
        "finance_director",
        "contract_date",
        "duration",
      ])
        contract[key] = "";
      const office = field(req.body.office, "office", 160, false);
      if (
        office &&
        !(
          await client.query(
            "SELECT 1 FROM portal_offices WHERE name=$1 AND active",
            [office],
          )
        ).rowCount
      )
        fail(
          400,
          "Choose an active office from the dropdown. Ask HRMO to add a missing office.",
        );
    }
    const step = req.body.wizard_step ?? app.wizard_step;
    if (!Number.isInteger(step) || step < 1 || step > 8)
      fail(400, "Invalid application step.");
    const values = [
      field(req.body.position, "position", 160, false),
      field(req.body.office, "office", 160, false),
      field(req.body.start_date, "start date", 10, false),
      field(req.body.end_date, "end date", 10, false),
      app.form_version === 2
        ? duties.map((d, i) => `2.${i + 1} ${d}`).join("\n")
        : numberedTor(sections),
      JSON.stringify(sections),
      JSON.stringify(personal),
      JSON.stringify(contract),
      JSON.stringify(education),
      JSON.stringify(contact),
      step,
      JSON.stringify(duties),
    ];
    const result = await client.query(
      "UPDATE applications SET position=$1,office=$2,start_date=$3,end_date=$4,tor=$5,tor_sections=$6,personal_details=$7,contract_details=$8,education_details=$9,contact_details=$10,wizard_step=$11,tor_items=$12,version=version+1,updated_at=now() WHERE id=$13 RETURNING *",
      [...values, app.id],
    );
    return result.rows[0];
  }),
);
portal.post(
  "/applications/:id/documents",
  raw({ type: "application/octet-stream", limit: "5mb" }),
  (req, res) =>
    withApplication(req, res, async (client, app, user) => {
      editable(app, user);
      const name = field(
        req.get("X-File-Name")
          ? decodeURIComponent(req.get("X-File-Name")!)
          : "",
        "filename",
        180,
      ).replace(/[\r\n\\/]/g, "_");
      const kind = req.get("X-Document-Kind");
      if (kind !== "tor" && kind !== "supporting")
        fail(400, "Choose a document type.");
      const data = req.body;
      if (!Buffer.isBuffer(data) || !data.length)
        fail(400, "Choose a PDF, PNG or JPEG document.");
      const mime =
        data.subarray(0, 5).toString() === "%PDF-"
          ? "application/pdf"
          : data
                .subarray(0, 8)
                .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            ? "image/png"
            : data.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
              ? "image/jpeg"
              : "";
      if (!mime) fail(400, "Only PDF, PNG and JPEG documents are accepted.");
      const count = await client.query(
        "SELECT count(*)::int AS count FROM application_documents WHERE application_id=$1",
        [app.id],
      );
      if (count.rows[0].count >= 10)
        fail(400, "Maximum 10 documents per application.");
      await client.query(
        "INSERT INTO application_documents (id,application_id,name,kind,mime,contents) VALUES ($1,$2,$3,$4,$5,$6)",
        [randomUUID(), app.id, name, kind, mime, data],
      );
      await client.query(
        "UPDATE applications SET version=version+1,updated_at=now() WHERE id=$1",
        [app.id],
      );
      return { ok: true };
    }),
);
portal.delete("/applications/:id/documents/:documentId", (req, res) =>
  withApplication(req, res, async (client, app, user) => {
    editable(app, user);
    const result = await client.query(
      "DELETE FROM application_documents WHERE id=$1 AND application_id=$2",
      [id(req.params.documentId), app.id],
    );
    if (!result.rowCount) fail(404, "Document not found.");
    await client.query(
      "UPDATE applications SET version=version+1,updated_at=now() WHERE id=$1",
      [app.id],
    );
    return { ok: true };
  }),
);
portal.get("/applications/:id/documents/:documentId", (req, res) =>
  withApplication(req, res, async (client, app) => {
    const result = await client.query(
      "SELECT name,mime,contents FROM application_documents WHERE id=$1 AND application_id=$2",
      [id(req.params.documentId), app.id],
    );
    if (!result.rowCount) fail(404, "Document not found.");
    const doc = result.rows[0];
    res.setHeader("Content-Type", doc.mime);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
    );
    res.send(doc.contents);
  }),
);
portal.post("/applications/:id/submit", (req, res) =>
  withApplication(req, res, async (client, app, user) => {
    editable(app, user);
    version(req, app);
    validate(() => validateSubmission(app));
    if (
      app.form_version === 2 &&
      !(
        await client.query(
          "SELECT 1 FROM portal_offices WHERE name=$1 AND active",
          [app.office],
        )
      ).rowCount
    )
      fail(400, "Choose an active office before submitting.");
    await client.query(
      "UPDATE applications SET status='submitted',version=version+1,updated_at=now() WHERE id=$1",
      [app.id],
    );
    await client.query(
      "INSERT INTO application_events (application_id,actor_id,status,note) VALUES ($1,$2,'submitted',$3)",
      [
        app.id,
        user.id,
        app.status === "returned"
          ? "Resubmitted after corrections"
          : "Application submitted",
      ],
    );
    return { ok: true };
  }),
);
portal.post("/applications/:id/review", (req, res) =>
  withApplication(req, res, async (client, app, user) => {
    if (user.role !== "hrmo") fail(403, "HRMO access required.");
    version(req, app);
    const status = req.body?.status;
    const allowed: Record<string, string[]> = {
      submitted: ["under_review", "returned", "approved", "rejected"],
      under_review: ["returned", "approved", "rejected"],
      approved: ["returned"],
    };
    if (!allowed[app.status]?.includes(status))
      fail(409, "This review action is not available for the current status.");
    if (status === "approved") validate(() => validateSubmission(app));
    const note = field(
      req.body?.note,
      "review note",
      3000,
      status === "returned" || status === "rejected",
    );
    if (status === "returned")
      await client.query(
        "DELETE FROM application_contracts WHERE application_id=$1",
        [app.id],
      );
    await client.query(
      "UPDATE applications SET status=$1,version=version+1,updated_at=now() WHERE id=$2",
      [status, app.id],
    );
    await client.query(
      "INSERT INTO application_events (application_id,actor_id,status,note) VALUES ($1,$2,$3,$4)",
      [app.id, user.id, status, note],
    );
    return { ok: true };
  }),
);
// The legacy editing endpoint is closed: all encoding now belongs to the applicant form.
portal.put("/applications/:id/contract-details", (_req, _res) => {
  fail(
    403,
    "Contract details must be entered by the applicant in the application form. Return the application for corrections.",
  );
});
portal.post("/applications/:id/contract", (req, res) =>
  withApplication(req, res, async (client, app, user) => {
    if (user.role !== "hrmo") fail(403, "Only HRMO can generate contracts.");
    if (app.status !== "approved")
      fail(409, "Approve the application before generating its contract.");
    version(req, app);
    let settingsRevision: number | null = null;
    if (app.form_version === 2) {
      const settings = (
        await client.query(
          "SELECT * FROM portal_contract_settings WHERE singleton",
        )
      ).rows[0];
      app.contract_details = { ...app.contract_details, ...settings.details };
      settingsRevision = settings.revision;
      // Add contract settings to app for renderer
      (app as any).contract_settings = {
        contract_title: settings.contract_title,
        university_name: settings.university_name,
        university_address: settings.university_address,
        university_ra: settings.university_ra,
        whereas_1: settings.whereas_1,
        whereas_2: settings.whereas_2,
        whereas_3: settings.whereas_3,
        clause_4: settings.clause_4,
        clause_5: settings.clause_5,
        clause_6: settings.clause_6,
        clause_7: settings.clause_7,
        clause_8: settings.clause_8,
        clause_9: settings.clause_9,
        clause_10: settings.clause_10,
        clause_11: settings.clause_11,
        witness_whereof: settings.witness_whereof,
        signing_location: settings.signing_location,
        acknowledgment_text: settings.acknowledgment_text,
        header_logo: settings.header_logo && Buffer.isBuffer(settings.header_logo)
          ? settings.header_logo.toString("base64")
          : null,
      };
    }
    validate(() => validateContract(app));
    let pdf: Buffer;
    try {
      pdf = await generateContract(app);
    } catch {
      fail(
        503,
        "Contract generation is unavailable. Contact the administrator to check the PDF renderer.",
      );
    }
    await client.query(
      "INSERT INTO application_contracts (application_id,contents,generated_by,application_version,settings_revision) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (application_id) DO UPDATE SET contents=$2,generated_by=$3,application_version=$4,settings_revision=$5,generated_at=now()",
      [app.id, pdf, user.id, app.version, settingsRevision],
    );
    await client.query(
      "INSERT INTO application_events (application_id,actor_id,status,note) VALUES ($1,$2,'contract_generated','Contract PDF generated for signing')",
      [app.id, user.id],
    );
    return { ok: true };
  }),
);
portal.get("/applications/:id/contract", (req, res) =>
  withApplication(req, res, async (client, app) => {
    const result = await client.query(
      "SELECT contents FROM application_contracts WHERE application_id=$1 AND application_version=$2",
      [app.id, app.version],
    );
    if (app.status !== "approved" || !result.rowCount)
      fail(404, "HRMO has not generated the current contract yet.");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="USTP-Contract-${app.id.slice(0, 8)}.pdf"`,
    );
    res.send(result.rows[0].contents);
  }),
);
portal.use((error: any, req: Request, res: Response, _next: NextFunction) => {
  const status =
    error instanceof HttpError
      ? error.status
      : error.type === "entity.too.large"
        ? 413
        : error instanceof SyntaxError || error instanceof URIError
          ? 400
          : 500;
  if (status === 500)
    console.error("Portal request failed", error.code || error.name);
  if (!res.headersSent)
    res.status(status).json({
      error:
        error instanceof HttpError
          ? error.message
          : status === 413
            ? req.path.startsWith("/admin/database")
              ? "SQL backup exceeds the 50 MB limit."
              : "File or request is too large (documents: 5 MB; CSV files: 500 KB)."
            : status === 400
              ? "Invalid request."
              : "Unable to complete the request. Please try again.",
    });
});
export default portal;
