import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { READY_STATUSES, STATUSES } from "./constants.js";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS releases (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    distributor TEXT NOT NULL,
    format TEXT NOT NULL,
    street_date TEXT,
    eta TEXT,
    qty_ordered INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS releases_status ON releases (status)`,
  `CREATE INDEX IF NOT EXISTS releases_distributor ON releases (distributor)`,
];

const SEED = [
  {
    id: "seed-cedar-salt",
    title: "Cedar & Salt",
    artist: "The Edmonds Hour",
    distributor: "Alliance",
    format: "LP",
    streetDate: "2026-10-14",
    eta: "",
    qtyOrdered: 5,
    status: "Watch",
    notes: "Customer request from Saturday. Hold one copy if it lands.",
    createdAt: "2026-09-26T17:10:00.000Z",
    updatedAt: "2026-09-28T18:40:00.000Z",
  },
  {
    id: "seed-signal-fire",
    title: "Signal Fire",
    artist: "Kite Club",
    distributor: "URP",
    format: "7\"",
    streetDate: "2026-10-21",
    eta: "",
    qtyOrdered: 6,
    status: "Ordered",
    notes: "Street date is firm. Poster should arrive with the shipment.",
    createdAt: "2026-09-27T16:05:00.000Z",
    updatedAt: "2026-09-29T15:20:00.000Z",
  },
  {
    id: "seed-night-bus",
    title: "Night Bus",
    artist: "Marble Sound",
    distributor: "URP",
    format: "CD",
    streetDate: "2026-10-07",
    eta: "2026-10-03",
    qtyOrdered: 3,
    status: "ETA / In transit",
    notes: "Distributor shows it on the truck. Check the Friday delivery.",
    createdAt: "2026-09-22T19:00:00.000Z",
    updatedAt: "2026-09-30T14:05:00.000Z",
  },
  {
    id: "seed-wetlands",
    title: "Wetlands",
    artist: "Low Tide",
    distributor: "Sub Pop",
    format: "LP",
    streetDate: "2026-09-18",
    eta: "",
    qtyOrdered: 2,
    status: "Received",
    notes: "Both copies accounted for. One has a small corner bend.",
    createdAt: "2026-09-12T18:30:00.000Z",
    updatedAt: "2026-09-30T16:45:00.000Z",
  },
  {
    id: "seed-yellow-line",
    title: "Yellow Line",
    artist: "Platform Kids",
    distributor: "Alliance",
    format: "Cassette",
    streetDate: "2026-09-01",
    eta: "",
    qtyOrdered: 4,
    status: "On shelf",
    notes: "New arrivals bin, facing the front window.",
    createdAt: "2026-08-28T17:15:00.000Z",
    updatedAt: "2026-09-20T21:10:00.000Z",
  },
];

let opening;

function isPostgresUrl(url) {
  return typeof url === "string" && /^postgres(ql)?:\/\//i.test(url);
}

function toPg(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    distributor: row.distributor,
    format: row.format,
    streetDate: row.street_date || "",
    eta: row.eta || "",
    qtyOrdered: Number(row.qty_ordered) || 0,
    status: row.status,
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function connect() {
  const url = process.env.DATABASE_URL;
  if (isPostgresUrl(url)) {
    const local = /localhost|127\.0\.0\.1/.test(url);
    const needsSsl = /sslmode=require/i.test(url) && !local;
    const pool = new Pool({
      connectionString: url,
      max: 5,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    });
    return { kind: "postgres", pool };
  }

  let DatabaseSync;
  try {
    ({ DatabaseSync } = await import("node:sqlite"));
  } catch (error) {
    throw new Error(
      "SQLite needs Node.js 22.13 or newer. Set DATABASE_URL to use Postgres instead. " +
        error.message,
    );
  }

  const file = process.env.SQLITE_PATH || path.join(process.cwd(), "data", "tnt.sqlite");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 3000;");
  return { kind: "sqlite", db, file };
}

function sqliteQuery(db) {
  return {
    async get(sql, params = []) {
      return db.prepare(sql).get(...params) || null;
    },
    async all(sql, params = []) {
      return db.prepare(sql).all(...params);
    },
    async run(sql, params = []) {
      db.prepare(sql).run(...params);
    },
  };
}

function pgQuery(client) {
  return {
    async get(sql, params = []) {
      const result = await client.query(toPg(sql), params);
      return result.rows[0] || null;
    },
    async all(sql, params = []) {
      const result = await client.query(toPg(sql), params);
      return result.rows;
    },
    async run(sql, params = []) {
      await client.query(toPg(sql), params);
    },
  };
}

async function withDb(fn) {
  const backend = await getBackend();
  if (backend.kind === "sqlite") return fn(sqliteQuery(backend.db), backend);
  const client = await backend.pool.connect();
  try {
    return await fn(pgQuery(client), backend);
  } finally {
    client.release();
  }
}

async function migrate(backend) {
  if (backend.kind === "sqlite") {
    for (const statement of SCHEMA) backend.db.exec(statement);
    return;
  }
  for (const statement of SCHEMA) {
    await backend.pool.query(statement);
  }
}

function insertParams(item, now) {
  return [
    item.id,
    item.title,
    item.artist,
    item.distributor,
    item.format,
    item.streetDate || null,
    item.eta || null,
    item.qtyOrdered,
    item.status,
    item.notes || "",
    item.createdAt || now,
    item.updatedAt || now,
  ];
}

const INSERT_SQL = `INSERT INTO releases (
  id, title, artist, distributor, format, street_date, eta, qty_ordered, status, notes, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (id) DO NOTHING`;

async function queryFor(backend) {
  if (backend.kind === "sqlite") return sqliteQuery(backend.db);
  const client = await backend.pool.connect();
  return { client, q: pgQuery(client) };
}

async function seed(backend) {
  const handle = await queryFor(backend);
  const q = handle.q || handle;
  try {
    const existing = await q.get("SELECT value FROM app_meta WHERE key = ?", ["seeded"]);
    if (existing) return;
    const now = new Date().toISOString();
    for (const item of SEED) {
      await q.run(INSERT_SQL, insertParams(item, now));
    }
    await q.run(
      "INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING",
      ["seeded", now],
    );
  } finally {
    if (handle.client) handle.client.release();
  }
}

async function openBackend() {
  const backend = await connect();
  await migrate(backend);
  await seed(backend);
  return backend;
}

export async function getBackend() {
  if (!opening) {
    opening = openBackend().catch((error) => {
      opening = undefined;
      throw error;
    });
  }
  return opening;
}

export async function healthcheck() {
  const backend = await getBackend();
  await withDb(async (q) => {
    await q.get("SELECT 1 AS ok", []);
  });
  return { db: backend.kind };
}

const ORDER_SQL = `ORDER BY CASE status
  WHEN 'Watch' THEN 1
  WHEN 'Ordered' THEN 2
  WHEN 'ETA / In transit' THEN 3
  WHEN 'Received' THEN 4
  WHEN 'On shelf' THEN 5
  WHEN 'Advertise' THEN 6
  ELSE 9 END,
  CASE WHEN street_date IS NULL OR street_date = '' THEN 1 ELSE 0 END,
  street_date,
  artist,
  title`;

export async function listReleases({ status, distributor, ready } = {}) {
  const where = [];
  const params = [];
  if (ready) {
    where.push(`status IN (${READY_STATUSES.map(() => "?").join(", ")})`);
    params.push(...READY_STATUSES);
  } else if (status && STATUSES.includes(status)) {
    where.push("status = ?");
    params.push(status);
  }
  if (distributor) {
    where.push("distributor = ?");
    params.push(distributor);
  }
  const sql = `SELECT * FROM releases ${where.length ? `WHERE ${where.join(" AND ")} ` : ""}${ORDER_SQL}`;
  const rows = await withDb(async (q) => q.all(sql, params));
  return rows.map(mapRow);
}

export async function getRelease(id) {
  const row = await withDb(async (q) => q.get("SELECT * FROM releases WHERE id = ?", [id]));
  return mapRow(row);
}

export async function createRelease(input) {
  const now = new Date().toISOString();
  const id = randomUUID();
  await withDb(async (q) => {
    await q.run(
      `INSERT INTO releases (
        id, title, artist, distributor, format, street_date, eta, qty_ordered, status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      insertParams({ ...input, id, createdAt: now, updatedAt: now }, now),
    );
  });
  return getRelease(id);
}

export async function updateRelease(id, patch) {
  const current = await getRelease(id);
  if (!current) return null;
  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await withDb(async (q) => {
    await q.run(
      `UPDATE releases SET
        title = ?, artist = ?, distributor = ?, format = ?, street_date = ?, eta = ?,
        qty_ordered = ?, status = ?, notes = ?, updated_at = ?
      WHERE id = ?`,
      [
        next.title,
        next.artist,
        next.distributor,
        next.format,
        next.streetDate || null,
        next.eta || null,
        next.qtyOrdered,
        next.status,
        next.notes || "",
        next.updatedAt,
        id,
      ],
    );
  });
  return getRelease(id);
}

export async function deleteRelease(id) {
  const current = await getRelease(id);
  if (!current) return false;
  await withDb(async (q) => {
    await q.run("DELETE FROM releases WHERE id = ?", [id]);
  });
  return true;
}

export function resetBackendForTests() {
  opening = undefined;
}
