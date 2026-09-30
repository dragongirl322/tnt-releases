import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "tnt_floor";

const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function storePin() {
  return (process.env.STORE_PIN || "").trim();
}

export function pinConfigured() {
  return storePin().length > 0;
}

export function sessionToken() {
  return createHmac("sha256", storePin()).update("tnt-releases-floor-v1").digest("hex");
}

export function isAuthed(cookieValue) {
  if (!pinConfigured()) return true;
  const expected = sessionToken();
  const got = String(cookieValue || "");
  if (got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

export function checkPin(pin, ip = "local") {
  const now = Date.now();
  const record = attempts.get(ip) || { count: 0, reset: now + WINDOW_MS };
  if (now > record.reset) {
    record.count = 0;
    record.reset = now + WINDOW_MS;
  }
  if (record.count >= MAX_ATTEMPTS) {
    attempts.set(ip, record);
    return { ok: false, limited: true };
  }

  const expected = storePin();
  const given = String(pin ?? "").trim();
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  const match = a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
  if (!match) {
    record.count += 1;
    attempts.set(ip, record);
    return { ok: false, limited: false };
  }
  attempts.delete(ip);
  return { ok: true, limited: false };
}

export function cookieSecure(request) {
  if (process.env.COOKIE_SECURE === "1") return true;
  if (process.env.COOKIE_SECURE === "0") return false;
  const proto = request?.headers?.get?.("x-forwarded-proto") || "";
  return proto.split(",")[0].trim() === "https";
}

export function resetPinAttempts() {
  attempts.clear();
}
