import { beforeAll, describe, expect, it } from "vitest";
import { signUnsubscribeToken, verifyUnsubscribeToken } from "./unsubscribe";

beforeAll(() => {
  process.env.UNSUBSCRIBE_SECRET = "test-secret";
});

describe("unsubscribe tokens", () => {
  it("round-trips a user id", () => {
    expect(verifyUnsubscribeToken(signUnsubscribeToken("user_abc123"))).toBe("user_abc123");
  });
  it("rejects a tampered payload or signature, other users' ids and junk", () => {
    const [payload, sig] = signUnsubscribeToken("user_abc123").split(".");
    const other = Buffer.from("user_victim").toString("base64url");
    expect(verifyUnsubscribeToken(`${other}.${sig}`)).toBeNull(); // someone else's id, my signature
    expect(verifyUnsubscribeToken(`${payload}.${sig.slice(0, -2)}AA`)).toBeNull();
    expect(verifyUnsubscribeToken(`${payload}.${sig}.x`)).toBeNull();
    for (const bad of ["", "abc", ".", "a.b", null, undefined]) expect(verifyUnsubscribeToken(bad as string)).toBeNull();
  });
  it("does not verify under a different secret", () => {
    const token = signUnsubscribeToken("user_abc123");
    process.env.UNSUBSCRIBE_SECRET = "another-secret";
    expect(verifyUnsubscribeToken(token)).toBeNull();
    process.env.UNSUBSCRIBE_SECRET = "test-secret";
  });
});
