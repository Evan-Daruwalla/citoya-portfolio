# gotchas — citoya-v2

Last updated 2026-09-10.

- **psycopg CANNOT run async on Windows' default ProactorEventLoop — and setting the loop
  policy in `main.py` does NOT fix it under uvicorn** (supersedes this entry's 2026-09-07
  version, which said it did). uvicorn creates its event loop BEFORE importing `app.main`,
  so a policy set at import time arrives after a Proactor loop already exists. The
  2026-09-07 'proof' set the policy before `asyncio.run` in a standalone script — the one
  ordering uvicorn never uses — and the test suite could not catch it because `conftest.py`
  imports `app.main` before any loop exists. Seen for real 2026-09-10: the server
  crash-looped on `InterfaceError`, backing off to 30s, while every test passed. **Fix: no
  async psycopg on the loop at all** — the SSE listener is a sync connection on a daemon
  thread, handing notifies over with `call_soon_threadsafe`. Lesson: verify a fix under the
  REAL entry point (`uvicorn app.main:app`), not a script that sets up conditions for you
  (2026-09-10).
- **Postgres READ COMMITTED RE-EVALUATES a blocked UPDATE's `WHERE` after the lock
  holder commits, and then applies it anyway** (2026-09-19; this is EvalPlanQual
  re-check). The consequence people miss: your statement was correct when it
  blocked and can be WRONG when it wakes, because the row it finally matches is a
  row somebody else just rewrote. So **every predicate you depend on must be IN
  the `WHERE`** — a condition checked by a previous statement is not carried
  forward. `Throttle._bump`'s reopen filtered on `scope` + `key` only, woke up,
  matched a window another caller had just opened, and reset the counter to 1, so
  the brute-force cap on check-in codes silently stopped counting (fixed in
  `core/throttle.py`, reproduced in `tests/test_throttle_reopen_race_pg.py`).
  `core/rate_limit.py` is NOT affected — it addresses rows by the fixed
  `(client, bucket, window_start)` triple, so there is no ambiguous row to
  re-match. Checked, not assumed.
- **`re.sub` interprets backslashes in the REPLACEMENT string, not just in the
  pattern** (2026-09-19). A Windows path used as a replacement turned `\U` into a
  truncated-unicode-escape error and mangled the output. Pass a callable
  (`lambda m: repl`) or use forward slashes, which dodges it entirely. This bit
  twice in one session — the second time while writing this very entry, in a
  Python source string rather than in `re.sub`.
- **GZipMiddleware silently breaks SSE.** It wraps a streaming response in a gzip
  buffer, so frames stop arriving promptly and the symptom reads as "events are
  slow", not as a compression bug. Starlette skips any response that already
  declares an encoding, so the stream sets `Content-Encoding: identity`. Confirmed
  on the wire: the response carries `content-encoding: identity` and frames arrive
  immediately (2026-09-07).
- **`settings.DATABASE_URL` is NOT the database the app is using, under test.**
  The suite builds its own SQLite engine and redirects modules at it while the
  setting still names the dev Postgres. Gating anything on the SETTING therefore
  fires in tests: the SSE lifespan did exactly that and started a real Postgres
  listener inside every SQLite test boot, crash-looping against a database the
  test was not using. Gate on `app.db.session.engine.dialect.name`, which
  `conftest._redirect_module_sessions` redirects alongside `SessionLocal`
  (2026-09-07).

- **A `NEXT_PUBLIC_*` var needs THREE edits, and missing one fails silently.**
  `lib/flags.ts` (or wherever it is read), an `ARG`+`ENV` pair in
  `frontend/Dockerfile` **before** `RUN npm run build`, and an entry in
  `docker-compose.yml`'s `web.build.args`. Docker forwards a build arg only for a
  DECLARED `ARG` and Next inlines these at BUILD time, so an undeclared one is
  dropped without a warning and the code reads `undefined` — the `=== "true"`
  comparison goes false and the feature simply never turns on. Live case:
  `NEXT_PUBLIC_LEGAL_SIGNOFF_COMPLETE` was undeclared until 2026-09-07, so
  following DEPLOY_RAILWAY Step 6 could never clear the legal draft banner, with
  no error in the build log, the app log, or the page (2026-09-07).
- **`/terms` and `/privacy` are `ƒ` dynamic, so there is no prerendered HTML to
  grep** — proving a flag's effect needs `next start` and a request, not a file
  search in `.next/`. And prove it BOTH ways: a page with no banner proves nothing
  until the rebuild WITHOUT the flag shows the banner return (2026-09-07).

- **Every role guard is literally named `guard`.** `require_org` and `require_student`
  are both closures returned by `_role_guard`, so matching a route's dependencies by
  `__name__` reports EVERY org route as unguarded and cannot tell the two roles apart.
  Compare the function OBJECT (`d.call is require_org`), not its name (2026-09-03).
- **`SessionLocal` in a test aims at the real database.** It binds to the configured
  `DATABASE_URL`, and `dependency_overrides` cannot reach code outside the dependency
  system — so a counter or middleware that opens its own session writes to Postgres
  while the suite runs SQLite. Patch it in `conftest.py`; see `testing.md` (2026-09-03).
- **`next-env.d.ts` flip-flops between `next dev` and `next build`** (2026-08-07, Next 16):
  Next rewrites its imports to `./.next/dev/types/...` after a dev run and `./.next/types/...`
  after a build, so the file shows up modified in `git status` depending on which you ran last.
  It is framework-generated ("should not be edited") — do NOT hand-fix it. ~~The committed
  version is the BUILD variant, which is what CI produces; if a dev run dirties it, run
  `npm run build` (or check it out) before committing rather than editing it.~~ **Untracked
  and in `frontend/.gitignore` since 2026-09-24 (audit F14)**, as the Next.js 16 docs advise.
  The committed copy had been the DEV variant since `bde920c`, so every build dirtied the tree.
- **`next dev` 404s every App Router route on this machine (found 2026-09-25):** `/`,
  `/login` and even `robots.txt` return 404 while `public/` files serve 200. The Turbopack
  cache in `frontend/.next/dev` dates from 2026-08-06, before the 2026-09-24 folder rename,
  and is ~~the likely cause (not proven)~~ the cause (proven 2026-09-26, below). Its dev run also rewrote `.next/dev/types/routes.d.ts`
  garbled, and `tsconfig.json` includes `.next/dev/types`, so the next `npm run build` failed
  its type check until those files were moved aside. Workaround used before the fix:
  `npm run build` + `npm run start`. **Fixed 2026-09-26 00:26 CDT (Evan's OK):** `frontend/.next/dev` was moved
  aside to `.next/dev.stale-2026-08-06` (gitignored; safe to delete). `next dev` then served
  every route 200, and a following `npm run build` passed with freshly generated dev types, so
  the pre-rename cache was the cause. After a folder move, move `.next/dev` aside first.
- **`next dev` and `npm run build` share the `.next/` dir** (2026-07-12): running the production
  build while a `next dev` server is live overwrites the chunks it serves from memory → the running
  app suddenly renders UNSTYLED with 404s on `/_next/static/.../layout.css` + chunk files. Not a
  code bug. Fix: restart the dev server after any `npm run build`; don't build against a live dev
  server on the same `.next`.

- **SQLite drops tz** on `DateTime(timezone=True)` columns — and it drops it by keeping an aware
  value's WALL-CLOCK time, not by converting: 6:30 pm Central stored as `18:30`, read back as
  18:30 UTC (found 2026-09-22). So normalize to UTC BEFORE storing (`OpportunityCreate` does)
  and never hand an API response's naive string to `new Date()` (it reads it as LOCAL time;
  `lib/event-time.ts` `eventInstant` treats zone-less as UTC). When comparing a stored expiry,
  normalize a naive value to UTC before comparing (done in `reset_password` and consent `_expired`).
  Tests run on SQLite, so this bites in tests, not just dev.
- **A new router must be `include_router`'d, not just imported.** 2026-07-08: the consent router was
  imported in `app/api/router.py` but never mounted → every consent call 404'd, and one test passed
  for the WRONG reason (unknown-token 404). After any new route module, confirm a call actually
  resolves.
- **Route order: literal before parameterized** — FastAPI/Starlette match in
  DECLARATION order, so `/opportunities/mine` must precede `/{opportunity_id}` and
  consent's `/request` + `/manage` must precede the bare `/{token}`, or the
  literal is swallowed as an id. Bitten twice (2026-07-08, 2026-07-13).
- **SQLite constraint changes** need `op.batch_alter_table` (recreates the table); a plain
  in-place ALTER fails. Column ADDs are fine without batch (with `server_default` for non-null).
- Prefer SQLAlchemy `JSON`, not Postgres-only `JSONB`, so tests-on-SQLite and dev-on-Postgres agree.
- **Windows shell:** PowerShell 5.1 has no `&&` (use `;` or the Bash tool). Never rewrite JSON/data
  files with PowerShell (UTF-16/BOM corrupts multibyte). Avoid inline `node -e` with quotes/arrows
  (leaves 0-byte junk files). git's `LF→CRLF` warnings on commit are harmless.
- **0-byte junk files** occasionally appear at the backend root or the Citoya root from
  shell-quoting accidents (e.g. a stray `MessageResponse`) — harmless, never commit; delete your own
  before committing.
- **git-bash `/c/...` paths fail in SQLite URLs** (`unable to open database file`) — use a RELATIVE
  scratch file (`sqlite:///_mig.db`) or a `D:/...` absolute path for alembic scratch runs.
- **`.env` is `NAME=value`** — prose like `Stripe secret key: xxx` is silently ignored by
  pydantic-settings (bit Evan 2026-07-09; fixed by script without echoing the values).
- **Middleware order in `create_app`**: `RateLimitMiddleware` is added BEFORE `CORSMiddleware` so
  CORS wraps it (last-added = outermost) and 429s carry CORS headers. Keep that order.
- **The billing webhook needs the RAW request body** for signature verification — never add
  middleware/deps that consume or re-parse the body before `stripe.Webhook.construct_event` runs.
- **A heredoc silently ate `\b` and wrote a literal BACKSPACE byte (0x08)** (2026-09-01). A regex
  written as `re.compile(r"\b[A-Za-z0-9_-]{20,}\b")` through a `python - <<'EOF'` heredoc compiled
  to `'\x08[A-Za-z0-9_-]{20,}\x08'` — requiring an unprintable character on both sides, so it
  matched NOTHING while reading as protection. **`grep` cannot show you this**: the byte does not
  render, and the mutated line prints byte-identically to the clean one. Only `repr(pattern)` exposes
  it. The same heredoc then defeated the obvious fix. Build byte-sensitive content with explicit
  values (`bytes([8])`, `chr(92)`) or the Write tool, and after writing any regex that matters, print
  its `repr` and assert it matches a real positive. The record entry describing this bug initially
  contained the same byte. **FIVE occurrences across 2026-09-01/02** — in the
  regex, in the record entry about the regex, in the gotcha about both, and
  twice more while writing bins about it. Every one arrived through a
  `python - <<'EOF'` heredoc. Treat the heredoc as unable to carry a
  backslash escape at all: build such text with explicit byte values
  (`bytes([92, 98])`) or the Write tool, and scan afterwards —
  `bytes([8]) in path.read_bytes()` over every file you touched.
- **`git checkout -- <file>` is NOT a safe restore when the tree is dirty** (2026-09-01). Reverting a
  test mutation that sat on top of an UNCOMMITTED change reverted both — silently wiping a fix made
  minutes earlier. Copy the file aside first and restore from that copy, then prove it with
  `git diff`.
- **`git grep` with a pathspec is only trustworthy from the repo root** (2026-09-01). Run from a
  subdirectory, `git grep -n 'x' -- backend` returns NOTHING (the pathspec does not exist relative to
  cwd) — a false zero that reads exactly like a clean result.
- **A plain `<a>` click is a FULL PAGE LOAD in the Next App Router — only
  `<Link>`/`router.push` navigate softly** (2026-09-02). This invalidated a
  security test and nearly cost a real fix: reproducing a client-cache leak
  needs the JS context to survive an in-tab account switch, and
  `document.createElement("a").click()` destroys that context (and the cache
  with it) before the switch happens. The test passed no matter what the code
  did, and on that false negative the fix was weakened and the bug publicly
  retracted. **Put a `window.__marker` in any test that depends on the page not
  reloading, and assert it survived.** Corollary, worth more than the specific
  bug: *when a test reports "no bug", check that the test could have detected
  one.*
