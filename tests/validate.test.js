import assert from "node:assert/strict";
import { test } from "node:test";
import { isIsoDate, isReleaseId, parseRelease } from "../lib/validate.js";

const sample = {
  title: "Cedar & Salt",
  artist: "The Edmonds Hour",
  distributor: "Alliance",
  format: "LP",
  streetDate: "2026-10-14",
  eta: "",
  qtyOrdered: 5,
  status: "Watch",
  notes: "Hold one.",
};

test("accepts a full release", () => {
  const parsed = parseRelease(sample);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.distributor, "Alliance");
  assert.equal(parsed.value.qtyOrdered, 5);
});

test("rejects unknown distributors and stages", () => {
  assert.equal(parseRelease({ ...sample, distributor: "Other" }).ok, false);
  assert.equal(parseRelease({ ...sample, status: "Shelved" }).ok, false);
});

test("rejects impossible dates and bad quantities", () => {
  assert.equal(isIsoDate("2026-02-31"), false);
  assert.equal(parseRelease({ ...sample, streetDate: "2026-02-31" }).ok, false);
  assert.equal(parseRelease({ ...sample, qtyOrdered: -1 }).ok, false);
  assert.equal(parseRelease({ ...sample, qtyOrdered: 1.5 }).ok, false);
});

test("partial patch can change only the stage", () => {
  const parsed = parseRelease({ status: "Received" }, { partial: true });
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.value, { status: "Received" });
});

test("release ids stay url-safe", () => {
  assert.equal(isReleaseId("seed-cedar-salt"), true);
  assert.equal(isReleaseId("../etc"), false);
});
