import { checkPin, cookieSecure, pinConfigured, SESSION_COOKIE, sessionToken } from "../../../lib/auth.js";
import { clientIp, json, readJson } from "../../../lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!pinConfigured()) return json({ ok: true, pinRequired: false });

  const body = await readJson(request);
  const result = checkPin(body?.pin, clientIp(request));
  if (result.limited) {
    return json({ error: "Too many tries. Wait a few minutes and try again." }, 429);
  }
  if (!result.ok) return json({ error: "Wrong PIN." }, 401);

  const response = json({ ok: true });
  response.cookies.set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(request),
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}

export async function DELETE() {
  const response = json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
