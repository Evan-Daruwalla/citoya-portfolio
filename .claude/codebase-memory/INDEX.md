# Codebase memory — citoya-v2 (INDEX)

> **Size: cap is ~75 lines** — raised from ~25 on 2026-09-03 (Evan), because 16 bins need 16
> routing lines before a single invariant is written. Invariants stay one line each, reasoning
> in the owning bin. **Count it, do not quote it:** `wc -l < INDEX.md`. This header said "47
> lines" until 2026-09-20, when the file was 51 — the index of the memory system miscounting
> itself, the same drift its own bins keep catching elsewhere. The raise is recorded in the
> skill under the phrase "INDEX.md (≤75 lines)" in `templates.md`; the old pointer here named
> a line number in `SKILL.md` that had since moved to an unrelated paragraph.

Read this file, then ONLY the bins your task touches. Input/auth/secrets/rendering → always load
`security.md`; hot paths → `performance.md`. Bin facts are claims: if the code disagrees, trust the
code, fix the bin, note the correction. Absolute dates; nothing invented.

**Scope: citoya-v2 ONLY** (FastAPI/SQLAlchemy/Postgres + Next.js/TS). v1 (`../../ServeLocal
website`, zero-dependency Node) is a DIFFERENT stack — its facts never apply here.

Core bins (last-updated):
- `architecture.md` — layout, **two visual systems (`.v1` scoped + shadcn)**, **server push = SSE over Postgres LISTEN/NOTIFY (2026-09-07); nothing has ever polled**, backend/frontend structure, **`proxy.ts` + force-dynamic**, message/template shapes, deploy shape. (deps→dependencies.md, migrations→data.md)
- `features.md` — milestone status (**M1–M10, M12, M13.1–.5, v1-copy, public-portfolio done; M13.6 SWR 20 units converted / 1 remaining, 2026-09-20 — recount, never quote; M14 analytics COMPLETE (M14.1 site + M14.2 org); M11 launch BLOCKED-ON-EVAN**) + feature semantics.
- `conventions.md` — feature-slice pattern, **role guards (`require_student`/`require_org`, decorator-vs-signature on consent-gated routes)**, **data fetching via `useAuthedQuery`/`usePublicQuery`, and a WRITE in a loader never goes inside a fetcher**, **NO blocking I/O in an `async` middleware/route (threadpool 40, DB pool 15, `pool_timeout` 30s)**, **capacity paths MUST use `enrollment.get_opportunity_for_update`**, **`lib/status.ts`**, hard rules. (visual/UI-polish→ui.md, verification→testing.md, status codes→data.md)
- `gotchas.md` — **a `NEXT_PUBLIC_*` var needs 3 edits and fails SILENTLY if you miss the Dockerfile `ARG`**, **async psycopg never runs under uvicorn on Windows — the SSE listener is a thread (2026-09-10)**, **plain `<a>` = full page load, which silently blinded a security test and got a real fix weakened — when a test says "no bug", check it COULD have found one**, **Postgres READ COMMITTED re-evaluates a blocked UPDATE's WHERE and applies it anyway — every predicate you rely on must be IN that WHERE (the throttle reopen race, 2026-09-19)**, **heredocs eating `\b` into control bytes, and `re.sub` eating them in the REPLACEMENT string too**, `git checkout` unsafe on a dirty tree, route order, include_router, SQLite tz loss, raw-body webhook, middleware order, .next clobber.

Standards bins (the codebase's committed choices, one home each):
*(Per-bin dates were removed 2026-08-19: they disagreed with 5 of 11 bins' own
headers, in both directions. The header inside each bin is the single copy.)*

Cross-bin invariants — ONE LINE each, deliberately (compressed 2026-09-03). Each rule's
reasoning lives in the bin named after it; this list is the rule, not the argument for it.
- **Students are free forever** — no plan/billing logic may gate a student feature. → conventions
- **Never expose in a read schema**: check-in codes, guardian/reset/consent tokens, full last names. → security
- **Age is recomputed live from `dob`** — never store or derive an "is minor" flag. → consent
- **Public exposure is opt-in + minor-minimized**, and an unknown id 404s uniformly. → security, consent
- **A listing is public only if its ORG is approved** — `is_approved` is per-ORG and read only for orgs. → security
- **One Alembic revision per schema change; never edit an applied revision.** → data
- **Only the Stripe webhook flips `User.plan`** — no self-serve upgrade endpoint, ever. → security
- **A client cache is identity-scoped** — login OR logout drops every entry. → conventions
- **Error reports must not carry user data** — `scrub_event` / `scrub_transaction` BUILD each event from an allowlist (A3, 2026-09-23); never go back to filtering. → security
- **Site analytics are aggregate-only** — no user, IP, session or user-agent column. → architecture
- **The audit log is append-only**, deleted only by AGE, never a particular row. → audit-log
- **Account erasure empties FREE TEXT, not just names** — a retained row's prose is PII. → consent
- **Nothing leaves this project by pattern-match** — publication is an explicit per-file list. → disclosure
- **A pushed event invalidates SWR KEYS, not components** — one `publish` + one `AFFECTED_KEYS` entry. → conventions
- **Gate on the ENGINE, never on `settings.DATABASE_URL`** — they differ under test. → gotchas

> *Public mirror: this index is filtered. `DIRECTORY.md`, `audit-log.md`, `browser-verification.md`, `consent.md`, `data.md`, `dependencies.md`, `disclosure.md`, `performance.md`, `security.md`, `testing.md`, `tooling.md`, `ui.md` are not published — the security bin deliberately so, the rest simply out of scope for the mirror. The private repo carries all of them. Prose CROSS-REFERENCES to those files still appear throughout the bins below: the published bins are byte-identical copies, not rewrites, and silently editing their text to hide the gap would make the public copy disagree with the private one — a worse failure than a dead pointer.*
