# TNT Releases

Phone-first floor board for **TNT Music Edmonds**. Staff track a release from the moment it is on the radar until it is ready to talk about on the floor.

**Watch → Ordered → ETA / In transit → Received → On shelf → Advertise**

Each card stores title, artist, distributor (Alliance, URP, or Sub Pop), format, street date, ETA, qty ordered, status, notes, and created/updated timestamps. Tap a card to move its stage. Filter by status or distributor, or use the purple **Ready to advertise** filter (Received, On shelf, or Advertise).

## Deploy on Railway from GitHub

The app is set up for [Railway](https://railway.com) to build with the included `Dockerfile` (Node 22). Nixpacks also works if you switch the builder; see `nixpacks.toml`.

1. Sign in at [railway.com](https://railway.com) and choose **New Project**.
2. Choose **Deploy from GitHub repo**.
3. Select **dragongirl322/tnt-releases**, branch **main**.
4. Railway reads `railway.json` and builds the Dockerfile. The service listens on `PORT`.
5. In the same project, choose **Add** → **Database** → **PostgreSQL**.
6. Open the app service → **Variables** → **Add variable reference** and set:

   `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`

   Use the Postgres service name Railway actually shows if it is not `Postgres`.
7. Optional: add `STORE_PIN` (a shared code for the store iPad). Leave it unset for an open board.
8. Open the app service → **Settings** → **Networking** → **Generate domain**.
9. Wait until the deploy is healthy (`/api/health` returns `{"ok":true,"db":"postgres"}`), then open the domain on a phone.

Redeploys keep the board because Postgres stores the rows. The five sample releases are inserted only the first time the database is empty.

### Without Postgres

If `DATABASE_URL` is unset, the app uses a SQLite file at `SQLITE_PATH` (default `./data/tnt.sqlite`, or `/data/tnt.sqlite` in the Docker image). That file is wiped when the container is replaced. For the shop, use Postgres. For a SQLite deploy, add a Railway volume mounted at `/data`.

## Store PIN

Set `STORE_PIN` on the service to require a shared PIN before the board loads. The PIN is checked on the server. A matching login sets an httpOnly cookie for 14 days (marked `Secure` when Railway forwards HTTPS). Use **Lock** on the board to clear it. There is no per-person account. Leave `STORE_PIN` empty to skip the gate.

Wrong PIN attempts are limited to 8 tries per 10 minutes per IP.

## Local development

Node.js **22.13 or newer** (built-in SQLite). No database install is required.

```bash
npm install
npm test
npm run build
npm start
```

Open http://localhost:3000. `npm run dev` starts the Next.js dev server.

Copy `.env.example` to `.env.local` if you want a PIN or a Postgres URL locally:

```bash
DATABASE_URL=postgres://localhost:5432/tnt_releases
STORE_PIN=2468
```

`DATABASE_URL` must start with `postgres://` or `postgresql://`. Anything else, including an empty value, uses SQLite.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness. Reports `sqlite` or `postgres`. |
| GET | `/api/session` | Whether a PIN is required and whether this browser is unlocked. |
| POST | `/api/auth` | `{ "pin": "..." }` unlocks the board. |
| DELETE | `/api/auth` | Locks the board. |
| GET | `/api/releases` | List. Optional `status`, `distributor`, and `ready=1`. |
| POST | `/api/releases` | Add a release. |
| PATCH | `/api/releases/:id` | Edit fields or move the stage. |
| DELETE | `/api/releases/:id` | Remove a release. |

When `STORE_PIN` is set, release routes return 401 until the cookie is present.
