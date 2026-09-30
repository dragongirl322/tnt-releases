import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAuthed, pinConfigured, SESSION_COOKIE } from "./auth.js";

export function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function requireFloor() {
  if (!pinConfigured()) return null;
  const jar = await cookies();
  if (!isAuthed(jar.get(SESSION_COOKIE)?.value)) {
    return json({ error: "Enter the store PIN." }, 401);
  }
  return null;
}

export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0].trim() || "local";
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
