# Boards

A free, self-hosted, real-time collaborative visual canvas — an infinite board where a team drops
images, notes, links and checklists and arranges them together, live.

Built because Milanote's free tier is too limited for real team use. Runs on a $5 box, and anyone
can self-host their own copy.

## What it does

- **Infinite canvas** — pan/zoom, drag, resize, freeform or a bento-style grid canvas
- **Eight note types** — text, image/video, link (auto-preview), checklist, column, nested board,
  shape, drawing
- **Real-time multiplayer** — several people on the same board at once, changes merged with a CRDT
  (Yjs), live cursors and presence avatars
- **Sharing** — invite by email or link; owner / editor / commenter / viewer roles enforced on both
  the REST API and the WebSocket
- **Layout tools** — seeded shuffle, templates, aspect-ratio presets, grid arrange, corner styles
- **Presentation mode** and PNG / video export

## Stack

| | |
|---|---|
| Client | Vite + React + TypeScript, React Flow canvas |
| Server | Express 5, `ws`, better-sqlite3 |
| Realtime | Yjs CRDT over a hand-rolled WebSocket protocol |
| Auth | email + password, bcrypt, JWT in an httpOnly cookie |

## Running locally

```bash
npm install                      # root (concurrently)
npm install --prefix client
npm install --prefix server

cp .env.example server/.env      # then set JWT_SECRET
npm run dev                      # client :5173, server :4000
```

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Deploying

The server holds **persistent WebSocket connections** and writes **SQLite and uploads to disk**. That
rules out serverless platforms — Vercel, Netlify and Cloudflare Pages cannot host it. It needs a host
that runs a long-lived Node process with a **mounted volume**: Railway, Fly.io, Render (paid tier), or
any VPS.

The provided `Dockerfile` builds one image that serves everything on a single origin — Express
handles `/api` and the `/yjs` WebSocket *and* serves the built client. That keeps the auth cookie
first-party and means there is no CORS to configure.

### Railway

1. Push this repo to GitHub.
2. Railway → **New Project** → **Deploy from GitHub repo**. It detects the `Dockerfile`.
3. **Variables**: set `JWT_SECRET` to a long random string. Leave everything else alone.
4. **Volume**: add one mounted at `/data`. This is not optional — without it the database and every
   uploaded image are destroyed on each redeploy.
5. **Settings → Networking**: generate a domain, or add a custom one.

### Custom domain behind Cloudflare

Point a CNAME at the host's domain, proxied. Cloudflare passes WebSocket upgrades through by
default, so `/yjs` keeps working.

Serving it at a **subpath** of an existing site (e.g. `example.com/bento`) is harder than it looks:
Vercel's rewrites do not proxy WebSocket upgrades, so it needs a Cloudflare Worker on that route
instead, plus rebuilding the client with a matching `base`. A subdomain avoids all of it.

### Environment

| Variable | Required | Notes |
|---|---|---|
| `JWT_SECRET` | **yes** | Server refuses to start without it. No default — that's deliberate. |
| `DATA_DIR` | in production | Where SQLite + uploads live. Point at the mounted volume (`/data`). |
| `PORT` | no | Defaults to 4000; most hosts set this for you. |
| `CLIENT_ORIGIN` | no | Only when the client is hosted on a *different* origin than the API. |

## Verification

There's no test framework. The repo ships browser drivers that exercise the real app through system
Chrome:

```bash
node client/drive-share.mjs    # two accounts: invite, join by link, live sync, roles, revoke
node client/drive-grid.mjs     # grid canvas: shuffle, resize/absorb, previews, image adjust
BASE_URL=http://localhost:4100 node client/drive-share.mjs   # against a production build
```

Typecheck gates:

```bash
cd client && npx tsc -b
cd server && npx tsc --noEmit
```

## Licence

ISC.
