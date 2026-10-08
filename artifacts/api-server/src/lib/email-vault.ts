import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { fail } from "./http";
export function vaultReady() {
  return /^[0-9a-f]{64}$/i.test(process.env.EMAIL_SETTINGS_KEY || "");
}
function key() {
  if (!vaultReady())
    fail(
      503,
      "The server administrator must configure EMAIL_SETTINGS_KEY before HRMO can save Google credentials.",
    );
  return Buffer.from(process.env.EMAIL_SETTINGS_KEY!, "hex");
}
export function seal(value: string, purpose: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(purpose));
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    data.toString("base64"),
  ].join(".");
}
export function unseal(value: string, purpose: string) {
  try {
    const [version, iv, tag, data] = value.split(".");
    if (version !== "v1" || !iv || !tag || !data)
      throw new Error("Invalid envelope");
    const cipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(iv, "hex"),
    );
    cipher.setAAD(Buffer.from(purpose));
    cipher.setAuthTag(Buffer.from(tag, "hex"));
    return Buffer.concat([
      cipher.update(Buffer.from(data, "base64")),
      cipher.final(),
    ]).toString("utf8");
  } catch {
    fail(
      503,
      "Stored Google credentials cannot be read. Check the server encryption key or save the credentials again.",
    );
  }
}
