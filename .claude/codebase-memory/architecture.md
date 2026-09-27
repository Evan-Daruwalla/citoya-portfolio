# architecture — citoya-v2

Last updated 2026-09-24.

## Stack
**Dependencies + pinned versions → `dependencies.md`** (canonical). In brief:
FastAPI + SQLAlchemy 2.0 (**sync** sessions) + Alembic + PostgreSQL (dev) /
in-memory SQLite (tests); Next.js (App Router) + React 19 + TypeScript +
Tailwind 3 + shadcn/ui.

## Two frontend visual layers (BOTH live — know which a route uses)
- **Scoped `.v1` exact-copy (2026-07-13, the 13 v1 screens):** v1's raw CSS ported VERBATIM into
  `frontend/app/v1.css` under a `.v1` wrapper (all vars on `.v1{}`, every rule `.v1 …`-prefixed, 0
  unscoped rules, keyframes `v1`-namespaced) so it can't collide with shadcn's HSL tokens of the same
  name (`--border`/`--muted`/`--card`). Each converted page renders inside `<V1Shell>`
  (`components/v1/v1-shell.tsx` — v1's exact nav+footer + the `.v1` root). `lib/v1-routes.ts`
  `isV1Route(pathname)` lists the converted routes (+ regex for dynamic `/opportunities/<id>` and
  `/portfolio/<id>`); the global `SiteHeader`/`SiteFooter` return null on those to avoid double chrome.
- **shadcn-token pages (M12):** the `@layer components` classes in `globals.css` (see conventions.md).
  Routes NOT in `isV1Route` still use these. Don't mix the two systems on one page.

## Backend layout
- `app/main.py` app factory (runs `check_production_config`, registers `RateLimitMiddleware` before
  CORS) → `app/api/router.py` mounts every feature router under `/api/v1`.
- `app/core/` (config, security, awards, occurrences, consent, email, rate_limit); `app/db/`
  (session, base); `app/models/`, `app/schemas/`, `app/services/` (notifications, enrollment,
  checkin, password_reset, audit), `app/api/routes/`, `app/api/deps.py`.
- **Models register in `app/models/__init__.py`** — NEVER import them in `app/db/base.py` (circular
  import; see the comment in base.py). Import ORDER matters (relationships reference Opportunity).
- `app/core/config.py` anchors `.env` via `Path(__file__)`, not cwd — so uvicorn works from any dir.
  Settings incl. RESEND_API_KEY / EMAIL_FROM / APP_BASE_URL / CONSENT_TOKEN_TTL_HOURS /
  STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / STRIPE_PRO_PRICE_CENTS / RATE_LIMIT_* /
  TURNSTILE_SECRET_KEY / SUPPORT_EMAIL / ADMIN_EMAILS (inert — grants nothing).
  `check_production_config` raises on dev defaults in production (M10.2) and now fails
  CLOSED — details in security.md / tooling.md.
- One table, two shapes (M7): `messages.recipient_id` NULL = shared thread post, set = directed
  (inbox). **The shared thread is org-WRITE-only since 2026-09-22** (Evan): applicants read
  it and reach the org privately via `POST …/messages/to-org` or by replying to its directed
  messages; `post_message` 403s a student, and every org-sent route 403s an org that is
  not approved. Templates live in their OWN table (`opportunity_templates`, JSON `data` blob) so they
  never leak into opportunity queries.

## Frontend layout
- `lib/api.ts` (typed fetch wrapper + `ApiError`), `lib/auth-context.tsx` (AuthProvider/useAuth;
  token in localStorage under exported `TOKEN_KEY`; `login`/`register`/`refresh`/`logout`),
  `lib/types.ts`, `components/ui/` (hand-vendored button/card/input/label).
- NEXT_PUBLIC_API_URL (default `http://localhost:8000/api/v1`) is where the client hits the backend.
- **`proxy.ts` at the frontend root** (2026-08-07) runs on every non-static request and builds
  the per-request nonce CSP. Next 16 deprecated the `middleware.ts` filename in favour of
  `proxy.ts` — do NOT add a `middleware.ts`. Because a nonce cannot exist in build-time HTML,
  `app/layout.tsx` sets `dynamic = "force-dynamic"`, so every app route is server-rendered per
  request; only the 4 metadata routes (icon/OG/robots/sitemap) are still static. Details in
  security.md §Content-Security-Policy.

## Analytics: two surfaces, two mechanisms, on purpose (M14, 2026-09-01/03)
- **Site traffic** — `route_hits`, written by `core/traffic_middleware.py`, keyed by
  (day, route TEMPLATE, method). It deliberately never records WHICH opportunity was
  viewed; that is the privacy property, not an omission.
- **Per-opportunity views** — therefore CANNOT read from the above, and use a separate
  counter on `Opportunity.views`. The PRD's own sequencing claim that #2 reads #1's
  counters was falsified in writing on 2026-09-01.
- Reads: admin-only `GET /analytics/traffic`, org-scoped `GET /analytics/org`. Both in
  `routes/analytics.py`; the org one is scoped by SQL, not by filtering after the fact.
- **`get_current_user_optional`** (`api/deps.py`, 2026-09-03) — a second
  `OAuth2PasswordBearer` with `auto_error=False`. Returns `None` for every failure mode
  including an expired token, so a PUBLIC route can tell who is asking without
  requiring anyone to sign in. It must never raise: a stale token on a public page has
  to still render the page.

## Server push: SSE over Postgres LISTEN/NOTIFY (2026-09-07)

The site had NEITHER a poller nor a subscription before this — SWR revalidated on
focus and reconnect, so a server-side event reached the browser only when the user
refocused the tab. This is the missing channel, and it is a NEW capability, not a
replacement for polling (there was none to replace; verified across 24 SWR call
sites, zero `setInterval`, no `refreshInterval`, no `SWRConfig`).

Three layers in `core/events.py`, deliberately separable:

| Layer | What it does | Where it runs |
|---|---|---|
| `publish(db, ...)` | `SELECT pg_notify(...)` **inside the caller's transaction** | any request |
| `listen_forever()` | ONE sync psycopg connection per process on a daemon thread, handing each NOTIFY to the loop via `call_soon_threadsafe` (an AsyncConnection until 2026-09-10 — it never ran under uvicorn on Windows; see gotchas.md) | app lifespan |
| `deliver(user_id, ...)` | in-process fan-out to per-subscriber `asyncio.Queue`s | listener |

- **Why NOTIFY and not an in-process bus.** II.52/II.53 moved the limiter and the
  throttle onto shared tables precisely so the ONE-replica constraint could be
  lifted, concluding Redis was not needed. An in-process bus restores that
  constraint and fails SILENTLY — a user on replica A never sees an event from
  replica B, with no error. NOTIFY crosses replicas using the database already here.
- **Publish is transactional on purpose.** Postgres holds NOTIFY until COMMIT, so
  an event cannot outrun the row that caused it, and a rollback emits nothing.
- **One publish site**: `services/notifications.py`, the same chokepoint the
  `is_active` and `consent_blocks` guards live at. The **16** callers (13 when written; recounted 2026-09-23) get live updates
  without knowing the transport exists.
- **Wired to the UI by KEY, not by component**: `lib/use-event-stream.ts` maps an
  event name to the SWR keys it invalidates (`AFFECTED_KEYS`). Adding an event
  type = one entry there plus one `publish` call. See conventions.md.

## Migrations
**Migration chain, Alembic rules, and schema conventions → `data.md`**
(canonical).

## Deploy shape (M10 COMPLETE — `docker compose up` verified by Evan 2026-07-12)
- 3 containers: Postgres + API + web (frontend/Dockerfile, multi-stage → Next
  `output: "standalone"`); root `docker-compose.yml`. **NEXT_PUBLIC_* vars are baked into the
  client bundle at BUILD time** — each needs an ARG/ENV pair in frontend/Dockerfile (API_URL,
  APP_URL, TURNSTILE_SITE_KEY, and SUPPORT_EMAIL as of 2026-08-06) AND a compose
  `build.args`/Railway service-var.
- **Migrations are NOT in the api image** (corrected 2026-07-16; supersedes the "entrypoint runs
  alembic on boot" claim): backend/Dockerfile CMD is uvicorn-only; `alembic upgrade head` runs via
  docker-compose's `command:` override locally, and via `deploy.preDeployCommand` in
  `backend/railway.json` on Railway. Any OTHER deploy target must wire migrations explicitly.
  **2026-09-24 (record BH): `railway.json` is ignored on Railway now** - Config as Code is closed
  to services created after 2026-08-28, so the staging `api` runs `alembic upgrade head` as a
  pre-deploy step set by hand in the dashboard (see the banner atop `docs/DEPLOY_RAILWAY.md`).
- **Docker IS available in the dev session now** (2026-07-13; the old "no Docker in dev" note is
  obsolete). Iterate with `docker compose build web && docker compose up -d web` (rebuild the image —
  the web/api images bake code at build time, so a rebuild is required to pick up changes).
  All services back: `docker compose up -d`.
- Runbooks: `docs/DEPLOY.md` (compose) + `docs/DEPLOY_RAILWAY.md` (Railway config-as-code,
  2026-07-16 — per-service railway.json, DATABASE_URL needs `postgresql+psycopg://` scheme;
  config-as-code no longer applies since 2026-09-24, record BH - dashboard settings instead);
  secret inventory: `docs/API_KEYS.md` (registry only, never values).
