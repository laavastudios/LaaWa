import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "laawa_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function createSessionToken(username: string, secret: string, now = Date.now()) {
  const value = `${username}.${now}`;
  return `${value}.${sign(value, secret)}`;
}

export function verifySession(cookie: string | undefined, now = Date.now()) {
  const secret = process.env.LAAWA_SESSION_SECRET;
  if (!secret || !cookie) return false;

  const parts = cookie.split(".");
  if (parts.length < 3) return false;

  const signature = parts.pop() ?? "";
  const value = parts.join(".");
  const timestamp = Number(value.slice(value.lastIndexOf(".") + 1));

  if (
    !Number.isFinite(timestamp) ||
    timestamp <= 0 ||
    now - timestamp > SESSION_MAX_AGE_SECONDS * 1000 ||
    timestamp - now > 60_000
  ) {
    return false;
  }

  const expected = sign(value, secret);
  const actualBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (actualBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(actualBuffer, expectedBuffer);
}
