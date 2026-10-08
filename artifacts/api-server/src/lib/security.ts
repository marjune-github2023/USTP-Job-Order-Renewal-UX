import { randomBytes, scrypt, createHash, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${((await derive(password, salt, 64)) as Buffer).toString("hex")}`;
}
export async function verify(password: string, stored: string) {
  const [salt, encoded] = stored.split(":");
  const computed = (await derive(password, salt, 64)) as Buffer;
  const expected = Buffer.from(encoded, "hex");
  return (
    computed.length === expected.length && timingSafeEqual(computed, expected)
  );
}
