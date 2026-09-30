import { cookies } from "next/headers";
import { isAuthed, pinConfigured, SESSION_COOKIE } from "../../../lib/auth.js";
import { json } from "../../../lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const pinRequired = pinConfigured();
  const unlocked = !pinRequired || isAuthed(jar.get(SESSION_COOKIE)?.value);
  return json({ pinRequired, unlocked });
}
