import {
  googleStatus,
  publicAppUrl,
  googleEndpoints,
  sendGoogleMessage,
} from "./google-email";
import { fail } from "./http";
function configuration() {
  const key = process.env.RESEND_API_KEY,
    from = process.env.EMAIL_FROM,
    origin = process.env.PUBLIC_APP_URL;
  if (!key || !from || !origin) return null;
  try {
    const url = new URL(origin);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !["https:", "http:"].includes(url.protocol)
    )
      return null;
    if (
      url.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(url.hostname)
    )
      return null;
    return { key, from, url };
  } catch {
    return null;
  }
}
export async function emailStatus() {
  const { settings, ready } = await googleStatus();
  const useGoogle = settings.provider === "google";
  return {
    email_ready: useGoogle ? ready : Boolean(configuration()),
    email_local: useGoogle
      ? googleEndpoints().local
      : /^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(
          process.env.RESEND_BASE_URL || "",
        ),
    server_ready: Boolean(configuration()),
  };
}
export const emailConfigured = async () => (await emailStatus()).email_ready;
export async function sendPasswordReset(email: string, token: string) {
  const app = publicAppUrl();
  if (!app) fail(503, "The public portal URL is not configured.");
  app.hash = `reset-password=${token}`;
  const subject = "Set your USTP renewal portal password";
  const body = `HRMO requested a password reset for your USTP renewal portal account.\n\nChoose your password using this link (valid for 30 minutes, one use):\n${app.href}\n\nIf you did not expect this email, contact HRMO. Your current password remains unchanged until you complete the reset.`;
  const { settings } = await googleStatus();
  if (settings.provider === "google")
    return sendGoogleMessage(email, subject, body);
  const config = configuration();
  if (!config) fail(503, "Password reset email is not configured.");
  try {
    const response = await fetch(
      `${(process.env.RESEND_BASE_URL || "https://api.resend.com").replace(/\/$/, "")}/emails`,
      {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${config.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.from,
          to: [email],
          subject,
          text: body,
        }),
      },
    );
    if (!response.ok) throw new Error("Email provider rejected request");
    const result = (await response.json()) as { id?: string };
    if (!result.id) throw new Error("Email provider returned no receipt");
  } catch {
    fail(
      503,
      "The email service could not send the reset link. Please try again later.",
    );
  }
}
