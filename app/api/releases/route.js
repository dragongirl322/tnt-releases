import { DISTRIBUTORS } from "../../../lib/constants.js";
import { createRelease, listReleases } from "../../../lib/db.js";
import { json, readJson, requireFloor } from "../../../lib/http.js";
import { parseRelease } from "../../../lib/validate.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const denied = await requireFloor();
  if (denied) return denied;

  const url = new URL(request.url);
  const ready = url.searchParams.get("ready") === "1";
  const status = url.searchParams.get("status") || "";
  const distributor = url.searchParams.get("distributor") || "";
  if (distributor && !DISTRIBUTORS.includes(distributor)) {
    return json({ error: "Distributor must be Alliance, URP, or Sub Pop." }, 400);
  }

  try {
    const releases = await listReleases({
      ready,
      status: ready ? "" : status,
      distributor,
    });
    return json({ releases });
  } catch (error) {
    console.error(error);
    return json({ error: "Database unavailable" }, 503);
  }
}

export async function POST(request) {
  const denied = await requireFloor();
  if (denied) return denied;

  const parsed = parseRelease(await readJson(request));
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  try {
    const release = await createRelease(parsed.value);
    return json({ release }, 201);
  } catch (error) {
    console.error(error);
    return json({ error: "Database unavailable" }, 503);
  }
}
