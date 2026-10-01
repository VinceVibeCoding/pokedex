// Signed unsubscribe tokens for email links. A token is "<base64url userId>.<base64url HMAC>", so
// the link works without signing in (as it must — people click it from their inbox) but can't be
// forged for someone else. No expiry: an unsubscribe link in an old email must keep working.

import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET ?? process.env.CLERK_SECRET_KEY;
  if (!s) throw new Error("UNSUBSCRIBE_SECRET (or CLERK_SECRET_KEY) must be set to sign unsubscribe links");
  return s;
}

const b64 = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");
const mac = (payload: string) => createHmac("sha256", secret()).update(payload).digest();

export function signUnsubscribeToken(userId: string): string {
  const payload = b64(userId);
  return `${payload}.${b64(mac(payload))}`;
}

/** The user id inside a valid token, or null for anything malformed or tampered with. */
export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined) return null;
  const expected = mac(payload);
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    return Buffer.from(payload, "base64url").toString("utf8") || null;
  } catch {
    return null;
  }
}
