# conventions — citoya-v2

Last updated 2026-09-27 (supersedes the 2026-07-13 version, which predated the role-guard, data-fetch and status-map conventions below).

## Visual / UI standards → `ui.md` (canonical)
Editorial language, the two coexisting visual systems (`.v1` scoped vs shadcn —
don't mix on one page), palette/fonts, the `@layer components` v1 class library,
and the emil-design-eng micro-interaction polish rules all live in **`ui.md`**.
Shared chrome (`components/site-header.tsx`/`site-footer.tsx`) wraps all pages
via `app/layout.tsx`.

## Backend feature slice (in this order)
model (`app/models/x.py` + register in `app/models/__init__.py`) → Alembic revision (autogenerate
then read it) → schema (`app/schemas/x.py`) → route module (`app/api/routes/x.py` + **`include_router`
in `app/api/router.py`**) → tests (`backend/tests/test_x.py`).

## Frontend slice
types in `lib/types.ts` → calls in `lib/api.ts` → **fetch through `lib/use-api.ts`** → page/component
→ verify in the browser (zero console errors). `useSearchParams` must sit under a `<Suspense>` boundary or the static build fails
(`/billing` does this; `/reset` stopped needing it on 2026-09-23, when its token moved to
the `#fragment`, read with `useSyncExternalStore`). Dynamic route params use `useParams` (no Suspense needed).

## Authorization: one definition per question (2026-08-31)
- **Caller-role checks go through `require_student` / `require_org` in `app/api/deps.py`** — never a
  fresh inline `if current_user.role != ...`. 25 inlined copies were consolidated; 15 of them were
  the same check written 15 times.
- **On a CONSENT-GATED route the role guard goes in the DECORATOR**, not the signature:
  `@router.post(..., dependencies=[Depends(require_student)])` while the signature keeps
  `current_user: User = Depends(require_consent)`. `test_consent_gate_coverage` detects the launch
  gate by the *name* `require_consent` at the top level of the route's dependencies — put the role
  guard in the signature instead and you either break that test or silently ungate the route.
- **NOT every role check belongs in a dependency.** Four shapes share the syntax and only the first
  converts: (1) pure caller-role → dependency; (2) role AND ownership (`role != org or opp.org_id !=
  user.id`) → needs the loaded resource, stays inline; (3) a check on a SUBJECT rather than the
  caller (consent's `dob` predicates, portfolio's 404 union) → different question, stays; (4) bespoke
  user-facing copy ("Only students can apply") → changing a 403 a user reads is a copy decision.
  Classify before sweeping — a regex over these four nearly shipped an ungated `create_review`.
- **A new write route must be classified in `test_consent_gate_coverage`.** When it fails, decide
  whether a student acting there reaches a real organization, a public surface, or their hours —
  do NOT add the route to the allowlist to go green.

## Capacity: never `db.get(Opportunity, ...)` on a path that moves spots (2026-09-05)

- Use **`enrollment.get_opportunity_for_update(db, id)`**. `spots_remaining` is a
  read-modify-write, and six sites did it unlocked: two concurrent applies to a
  one-spot listing both read `> 0`, both wrote `0`, both committed an approved
  application — two students holding one physical seat, with a counter that looks
  plausible afterwards so nothing alerts.
- ~~Four fetch sites are locked (apply, withdraw, org decide, guardian revoke) and
  `tests/test_capacity_locking.py` pins that count at 4, so a fifth spots-touching
  path cannot quietly skip it.~~ Since 2026-09-24 (audit F6) `tests/test_capacity_locking.py`
  scans every routes and services file and pins a count per file: the org-rejection path in
  `admin.py` was a fifth locked site the old 3-file scan could not see. `promote_from_waitlist` is NOT one of them — it
  receives an already-loaded `opp`, so its caller owns the lock.
- **`FOR UPDATE` is a no-op on SQLite**, so the race is still reproducible in the
  default suite; see `testing.md`.

## Duplicate inserts: a DB constraint plus `conflict_as_409` (2026-09-27, audit CH)

- **Every "already exists?" check is read-then-write**, so two simultaneous requests both
  pass it. The backstop is a unique constraint or index in the DB, and the route wraps the
  INSERT's flush/commit in `with conflict_as_409(db, <the checked path's message>):`
  (`app/api/conflict.py`) so the race answers the same 409, not a 500. Wrap the FLUSH when
  the route flushes early for the new id. Sites: apply, self-report, check-in, review.
- **Test it with a forced interleaving, not two sequential requests** (those never race):
  `tests/test_duplicate_races.py` commits the competing row from a second session inside a
  `before_flush` listener. Apply uses the same-flush mode: it holds the listing FOR UPDATE,
  and a second session's FK check would wait on it forever on Postgres.

## Batch jobs: one SAVEPOINT per item (2026-09-27, audit CH)

- **A loop over accounts or rows in one transaction runs each item in `with
  db.begin_nested():`** inside a try/except that logs and continues
  (`finalize_due_deletions`). A bare `except` is not enough: it would commit a failed
  item's partial writes, and on Postgres one failed statement aborts the transaction.
- **On SQLite (tests)** pysqlite opens the transaction at the first SAVEPOINT, so a RELEASE
  commits there; the end state is the same, but "does not commit" is not testable there.

## Data fetching: `useAuthedQuery` / `usePublicQuery` (2026-08-31, M13.6)
- **Never hand-roll `useEffect` + `useState(loading)` + `useState(error)` again.** Use
  `useAuthedQuery(key, fetcher)` for token-bearing endpoints and `usePublicQuery(key, fetcher)` for
  tokenless ones. They are separate on purpose: the public one must fetch for a signed-OUT visitor,
  the authed one must NOT fire until auth hydrates.
- **Render error and empty as DIFFERENT branches.** The hand-rolled pattern shipped this bug seven
  times — a failed load falling through to "No verified hours yet" / "No messages yet" / "No
  applicants", telling a user their real data does not exist. `loading` stays true while auth
  hydrates precisely so a page cannot render its empty state before it knows.
- **Split a 4xx from a transport failure with `error instanceof ApiError`, never
  `error.status`** (2026-09-03). A fetch network failure throws a raw `TypeError` with no
  `status`; `use-api.ts` casts its error to `ApiError | undefined`, so `error.status >= 400`
  TYPECHECKS and is `undefined` at runtime — a dropped connection then renders the page's
  "not found / private" copy. `portfolio/[id]` shipped exactly that bug for two months.
- **Never assert a number you do not have.** Stat tiles, counters and badges render `—` (or nothing)
  when the load failed — not `0`. Fixing the list and leaving `0 Verified Hours` in the summary above
  it is the same lie in the same viewport.
- Client errors (4xx) are never retried; the API's 403/404 are settled answers and the rate limiter
  counts every attempt.
- **A LOAD error and a WRITE error are two variables, never one** (2026-09-20, `signup-section`).
  Sharing one `error` string means the write's `setError(null)` erases a load failure that is
  still true — the user keeps looking at a control that cannot work, with nothing saying why.
  SWR owns the load error; the submit keeps its own `submitError`. `reviews-section`, the
  `opportunities/[id]` page, `signup-section` and `messages-section` (2026-09-26) all make
  this split.
- **Data outranks error in the branch order**: `loading -> data -> error -> empty`. SWR keeps the
  last good value when a background revalidation fails, so putting `error` above `data` throws
  away a working control because a refresh blipped. `loading` is only true when there is no data
  at all, which is what keeps that order coherent.
- **Hold a conditional fetch with a `null` key, never an `if` around the hook** — zero requests,
  hook rules intact (`signup-section`, which needs no dates for a one-time listing).
- **A select's default comes from the DATA during render, never from an effect**
  (2026-09-20, `org-checkin-section`): `const value = picked || options[0] || ""`, not a
  `useEffect` calling `setSelected(keys[0])`. Same behaviour, one less render pass, and it
  is what took the eslint baseline 9 -> 8 — `react-hooks/set-state-in-effect` is warning
  -level here precisely because most of the remaining sites are this shape.

## Live updates invalidate SWR KEYS, never components (2026-09-07)

Adding a live-updating surface is two edits: `publish(...)` at the backend site,
and one entry in `AFFECTED_KEYS` in `lib/use-event-stream.ts` mapping the event
name to the keys it dirties. Components stay ignorant of the transport — they
already read those keys, and SWR re-runs the fetcher. Nothing subscribes to a
component.

- `useEventStream()` is mounted ONCE, in `site-header.tsx`, which renders on every
  non-`.v1` route. A second mount = a second stream per tab for no benefit.
- **A shared key must be invalidated by whoever changes it, even from another
  page.** `/notifications` marking a row read changes the header's unread count,
  and that page's own `mutate()` only revalidates its own key — so the badge stayed
  stale until the header remounted. Use the global `mutate(key)` from
  `useSWRConfig()` for keys the page does not own. This was a real shipped bug,
  fixed 2026-09-07.

## A WRITE in a page's loader never goes inside a fetcher (2026-09-05)

- SWR revalidates on window focus and on reconnect, so anything inside a fetcher runs
  again on its own schedule. A loader that begins with a write (`dashboard` did:
  `POST /hours/auto-log`, then four GETs in one `Promise.all`) must have the write
  LIFTED OUT, not carried along. Converted shape (`dashboard` 2026-09-05, then `hours`
  2026-09-20 — the last page that had this problem, now closed):
  1. the reads become one `useAuthedQuery` per key, nothing special;
  2. the write runs in its OWN mount-once `useEffect` behind a `useRef` guard;
  3. on success it revalidates **only the keys that write can affect** (auto-log →
     `hours/mine` + `awards/my`, never `applications/my` or `saved`; since M16.3,
     2026-09-27, the dashboard and /hours revalidate `hours/mine` only, because goals
     re-derive from hours and `awards/my` is read only by /portfolio), and **only when
     the server says it changed something** (`created > 0`).
- Step 3's condition is why the new page is cheaper, not just safer: `{"created": 0}` is
  the common answer, and there the four queries already hold the truth. The old code
  always wrote and then always fetched.
- Idempotence on the server is NOT a licence to skip this. `/hours/auto-log` skips any
  `(opportunity, user, occurrence_date)` that already has a row, so a replay duplicates
  nothing — but it still spends a request against the rate limiter and writes an audit
  row on any run that mints something.
- **Verified by request count, not by the screen** (2026-09-05, dashboard): mount showed
  one GET per key + one POST; `created: 1` added exactly `hours/mine` + `awards/my`; a
  tab switch added nothing; a self-report added its POST + four GETs and NO second
  auto-log. **The focus-revalidation path IS verifiable after all and was verified
  2026-09-20 on `hours`** (3 GETs, 0 POSTs) — redefine `document.visibilityState` and
  `document.hidden` before dispatching `focus`; see `browser-verification.md`.
- **`hours` added one branch the dashboard did not need** (2026-09-20): gate a full-page
  error panel on `data === undefined`, not on `error` alone. Before SWR nothing
  revalidated by itself, so an error could only mean "the load you asked for failed";
  now a background revalidation can fail over good rows, and raising the panel there is
  new noise rather than new honesty. A failed refresh with data gets a quiet line + Retry.

## NEVER do blocking I/O in an `async` middleware or route (2026-09-05)

- `TrafficMiddleware.dispatch` is `async`; psycopg/SQLAlchemy are BLOCKING. The counter
  write ran straight on the event loop — **median 3.48 ms, p95 4.79 ms per counted
  request**, and up to `pool_timeout` (**30 s**) when the pool saturates. Blocking the
  loop delays EVERY concurrent request, including ones that never touch the DB. Fixed
  with `await run_in_threadpool(_record_hit_blocking, …)`.
- The 69 sync (`def`) routes (and 2 `async`; AST recount 2026-09-23, was 75) are fine — Starlette already runs those in the 40-worker
  threadpool. The hazard is specific to `async def` bodies, of which the middlewares are
  the main ones. **Measured limits, not assumed:** threadpool 40 (anyio default),
  `QueuePool` `pool_size` 5 + `max_overflow` 10 = **15 connections**, `pool_timeout` 30 s.
- A `try/except` around blocking work does NOT make it safe. `traffic_middleware`'s
  docstring promised "analytics must never cost a user their request" and it was the code
  most able to freeze the whole server — the exception guard addressed the wrong failure.
- Test it BEHAVIOURALLY: `test_traffic_write_runs_off_the_event_loop` spies on both
  `run_in_threadpool` (loop thread) and `record_hit` (must not be) and requires the two
  thread ids to differ. Proved to fail against the inline version before being trusted.
- **Beware the excluded route when timing this.** A first timing run read 0.01 ms and
  looked fine; it probed `/api/v1/health`, which is in `EXCLUDED_ROUTES`, so `record_hit`
  returned before any DB work. Time a COUNTED route.

## Cache keys name the ANSWER, not the endpoint (2026-09-02)
- If a response shape depends on WHO is asking, the asker's role is part of the
  answer and part of the key: `hours/mine` (a student's own ledger) vs
  `hours/org-queue` (an org's verification queue). Both call the same fetcher,
  and that is correct — a session has one role, so the two can never be live
  together. **Never a third spelling, never a bare `hours`.** If you cannot say
  what a key's value IS as a noun phrase without naming a page, the key is wrong.
- What makes that safe is STRUCTURAL (one role per session), and it holds only
  because the cache is cleared on identity change — see §Client-side cache is
  identity-scoped BELOW in this file (moved here from `security.md` 2026-09-03).
  The key rule and that clear are the same invariant from two sides.

## Status vocabulary: `lib/status.ts` is the only home (2026-08-31)
- Labels, pills and messages for application status and hours status live there — four copies across
  two *different* status domains were merged into one file with the domains kept apart. Do not
  reintroduce a local map.
- **Do NOT consolidate the `sp-*` CSS across `globals.css` and `v1.css`.** That duplication is the
  deliberate v1 exact-copy architecture, not drift.

## Analytics counters: own session, in the SERVICE (2026-09-03)
- A counter writes on a session it opens ITSELF, never the request's — analytics must
  never cost a reader their request, and a counter must never roll back the read that
  triggered it.
- Keep that session in the service (`services/traffic.py`), not the route. One symbol
  for tests to redirect; a new counting route adds no new patch point. The ROUTE owns
  the try/except, so a failure is logged once where a page is being served.
- Count as a SIDE EFFECT of an existing GET, not a new write route: a new POST must be
  classified in `test_consent_gate_coverage`'s allowlist, and a counter is not a student
  action, so that entry would be a false-but-passing classification.

## Role gating has TWO shapes, and they are not interchangeable (2026-09-03)
- `Depends(require_org)` — a pure role gate, visible to tests as a dependency.
- **Role AND ownership checked in the handler** (`opp.org_id != current_user.id`) —
  five routes do this because a role-only dependency cannot express ownership. The
  2026-08-31 consolidation moved the pure gates and deliberately left these. They are
  classified `ORG_OWNER_INLINE` in the consent allowlist, which asserts only that a user
  is required and says plainly what it cannot see.

## Client-side cache is identity-scoped — clear it on every identity change (2026-09-01)

- SWR's cache is **process-global** (no `<SWRConfig>` provider here), so an entry
  outlives a sign-out until a hard reload. `logout()` cleared the token and left
  the cache, so in ONE TAB the next account inherited the previous account's data
  — **one student's private list rendered in another student's session**.
  Introduced by `6d75394` (SWR adoption); before it, fetches were component-local.
- **Fix, and the rule:** `auth-context.tsx` `clearCache()` — `mutate(() => true,
  undefined, { revalidate: false })` — called from **both `login()` and
  `logout()`**. Login-side is NOT redundant: `lib/api.ts` drops the token on a 401
  *without* going through `logout()`, clearing no cache and not resetting `user`;
  the next login cleans up after it. Reproduced both directions on a production
  build; **see `gotchas.md` for the test trap that made the first attempt falsely
  pass**, which is why the fix was briefly weakened.
- Any future client-side cache inherits this: identity change ⇒ drop everything.
  (Moved from `security.md` 2026-09-03 — a frontend rule, not a security one.)

## Hard rules
**Definition of done, commit/push, and BLOCKED-ON-EVAN live in `CLAUDE.md` (always loaded) —
not restated here, so there is one copy to keep current.** Convention-specific only: response
schemas strip secrets (`security.md`); students free forever, no plan gate on a student
feature; editorial visual language is solid fills/tight radii/calm motion, plainer over
generic-AI-looking.

## Verification reality → `browser-verification.md`; status codes → `data.md`
Browser/CDP verification reality (Docker available, CDP screenshot times out,
async React `el.click()`, controlled-input handling, hidden-pane anim freeze) is
canonical in **`browser-verification.md`** (split out of testing.md 2026-09-19);
the 402/409/503 status-code contract is in
**`data.md`**. Always record honestly what was actually driven.
