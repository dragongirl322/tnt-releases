import { deleteRelease, updateRelease } from "../../../../lib/db.js";
import { json, readJson, requireFloor } from "../../../../lib/http.js";
import { isReleaseId, parseRelease } from "../../../../lib/validate.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request, context) {
  const denied = await requireFloor();
  if (denied) return denied;

  const { id } = await context.params;
  if (!isReleaseId(id)) return json({ error: "Release not found." }, 404);

  const parsed = parseRelease(await readJson(request), { partial: true });
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  try {
    const release = await updateRelease(id, parsed.value);
    if (!release) return json({ error: "Release not found." }, 404);
    return json({ release });
  } catch (error) {
    console.error(error);
    return json({ error: "Database unavailable" }, 503);
  }
}

export async function DELETE(_request, context) {
  const denied = await requireFloor();
  if (denied) return denied;

  const { id } = await context.params;
  if (!isReleaseId(id)) return json({ error: "Release not found." }, 404);

  try {
    const removed = await deleteRelease(id);
    if (!removed) return json({ error: "Release not found." }, 404);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return json({ error: "Database unavailable" }, 503);
  }
}
