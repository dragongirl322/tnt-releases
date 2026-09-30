import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

const dir = mkdtempSync(path.join(tmpdir(), "tnt-releases-"));
process.env.SQLITE_PATH = path.join(dir, "tnt.sqlite");
delete process.env.DATABASE_URL;

const db = await import("../lib/db.js");

describe("sqlite floor board", { concurrency: false }, () => {
test("seeds five sample releases once", async () => {
  const first = await db.listReleases();
  assert.equal(first.length, 5);
  const titles = first.map((release) => release.title);
  assert.ok(titles.includes("Wetlands"));
  assert.ok(titles.includes("Yellow Line"));
  const again = await db.listReleases();
  assert.equal(again.length, 5);
});

test("ready filter is Received, On shelf, or Advertise", async () => {
  const ready = await db.listReleases({ ready: true });
  assert.ok(ready.length >= 2);
  for (const release of ready) {
    assert.ok(["Received", "On shelf", "Advertise"].includes(release.status));
  }
});

test("create, stage change, and delete", async () => {
  const created = await db.createRelease({
    title: "Front Window",
    artist: "Test Press",
    distributor: "Sub Pop",
    format: "LP",
    streetDate: "2026-11-02",
    eta: "2026-10-28",
    qtyOrdered: 2,
    status: "Ordered",
    notes: "Sample write.",
  });
  assert.equal(created.distributor, "Sub Pop");
  assert.ok(created.createdAt);
  assert.ok(created.updatedAt);

  const moved = await db.updateRelease(created.id, { status: "Advertise" });
  assert.equal(moved.status, "Advertise");
  assert.notEqual(moved.updatedAt, created.updatedAt);

  const subPop = await db.listReleases({ distributor: "Sub Pop" });
  assert.ok(subPop.some((release) => release.id === created.id));

  assert.equal(await db.deleteRelease(created.id), true);
  assert.equal(await db.getRelease(created.id), null);
});

test("deleting the samples does not reseed", async () => {
  const all = await db.listReleases();
  for (const release of all) {
    await db.deleteRelease(release.id);
  }
  const after = await db.listReleases();
  assert.equal(after.length, 0);
});
});
