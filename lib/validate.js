import { DISTRIBUTORS, STATUSES } from "./constants.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function isIsoDate(value) {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function optionalDate(value, label) {
  const text = cleanString(value);
  if (!text) return { ok: true, value: "" };
  if (!isIsoDate(text)) return { ok: false, error: `${label} must be a real date (YYYY-MM-DD).` };
  return { ok: true, value: text };
}

/**
 * Validate a create or patch body.
 * Partial patches may include any subset of fields.
 */
export function parseRelease(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Expected a JSON object." };
  }

  const value = {};
  const errors = [];
  let seen = 0;

  const take = (key, read) => {
    if (body[key] === undefined) {
      if (!partial) {
        const result = read(undefined);
        if (!result.ok) errors.push(result.error);
        else value[key] = result.value;
      }
      return;
    }
    seen += 1;
    const result = read(body[key]);
    if (!result.ok) errors.push(result.error);
    else value[key] = result.value;
  };

  take("title", (input) => {
    const text = cleanString(input);
    if (!text) return { ok: false, error: "Title is required." };
    if (text.length > 160) return { ok: false, error: "Title must be 160 characters or fewer." };
    return { ok: true, value: text };
  });

  take("artist", (input) => {
    const text = cleanString(input);
    if (!text) return { ok: false, error: "Artist is required." };
    if (text.length > 160) return { ok: false, error: "Artist must be 160 characters or fewer." };
    return { ok: true, value: text };
  });

  take("distributor", (input) => {
    const text = cleanString(input);
    if (!DISTRIBUTORS.includes(text)) {
      return { ok: false, error: "Distributor must be Alliance, URP, or Sub Pop." };
    }
    return { ok: true, value: text };
  });

  take("format", (input) => {
    const text = cleanString(input);
    if (!text) return { ok: false, error: "Format is required." };
    if (text.length > 40) return { ok: false, error: "Format must be 40 characters or fewer." };
    return { ok: true, value: text };
  });

  take("streetDate", (input) => optionalDate(input, "Street date"));
  take("eta", (input) => optionalDate(input, "ETA"));

  take("qtyOrdered", (input) => {
    if (input === undefined || input === "" || input === null) {
      return partial ? { ok: true, value: 0 } : { ok: false, error: "Qty ordered is required." };
    }
    const qty = Number(input);
    if (!Number.isInteger(qty) || qty < 0 || qty > 999) {
      return { ok: false, error: "Qty ordered must be a whole number from 0 to 999." };
    }
    return { ok: true, value: qty };
  });

  take("status", (input) => {
    const text = cleanString(input);
    if (!STATUSES.includes(text)) {
      return { ok: false, error: "Status must be one of the floor stages." };
    }
    return { ok: true, value: text };
  });

  take("notes", (input) => {
    const text = input === undefined || input === null ? "" : cleanString(input);
    if (text.length > 2000) return { ok: false, error: "Notes must be 2000 characters or fewer." };
    return { ok: true, value: text };
  });

  if (partial && seen === 0) {
    return { ok: false, error: "No changes to save." };
  }
  if (errors.length) return { ok: false, error: errors[0] };
  return { ok: true, value };
}

export function isReleaseId(id) {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(id);
}
