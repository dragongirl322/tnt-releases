import { healthcheck } from "../../../lib/db.js";
import { json } from "../../../lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const info = await healthcheck();
    return json({ ok: true, ...info });
  } catch (error) {
    console.error(error);
    return json({ ok: false, error: "Database unavailable" }, 503);
  }
}
