import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { checkPin, isAuthed, pinConfigured, resetPinAttempts, sessionToken } from "../lib/auth.js";

describe("store pin", { concurrency: false }, () => {
test("open board when STORE_PIN is unset", () => {
  delete process.env.STORE_PIN;
  resetPinAttempts();
  assert.equal(pinConfigured(), false);
  assert.equal(isAuthed(undefined), true);
});

test("STORE_PIN gates the session cookie", () => {
  process.env.STORE_PIN = " 2468 ";
  resetPinAttempts();
  assert.equal(pinConfigured(), true);
  assert.equal(checkPin("2468").ok, true);
  assert.equal(checkPin("nope").ok, false);
  assert.equal(isAuthed(sessionToken()), true);
  assert.equal(isAuthed("not-the-token"), false);
  delete process.env.STORE_PIN;
  resetPinAttempts();
});
});
