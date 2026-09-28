# features — citoya-v2

Last updated 2026-09-27.

## Milestone status (PRD M1–M11)
- **Done:** M1–M9 (see below), **M10 COMPLETE** (`docker compose up --build` verified by Evan
  2026-07-12 — full stack boots, migrations applied on real Postgres), **M12 v1 visual parity**
  (2026-07-12), and two off-roadmap Evan-directed 2026-07-13 blocks: **v1 EXACT-COPY** (all 13
  screens rebuilt in the scoped `.v1` architecture — see architecture.md/conventions.md) and a
  **public-portfolio slice**. **704 collected (699 passed + 5 skipped on SQLite; 704 passed on Postgres), migrations 0001-0040 (2026-09-27 22:12-22:20 CDT, record CX;
  supersedes 697 of ~20:43 (CQ), 691 of ~19:16 (CP), 684 of ~18:20 (CO), 682 of ~17:44 (CN), 673 of ~17:32 (CM), 665 of ~17:17 (CL), 646 of ~16:54 (CJ), 633 of 2026-09-26 ~23:23 (CG), 589 of ~01:14 (BV), 588 of ~00:40 (BU), 582 of 2026-09-25 ~22:06 (BS), 578 of 2026-09-24 ~23:49 (BR), 542 of ~22:43 (BQ), 533 of ~21:09 (BJ), 516 of 2026-09-23 ~22:20 CDT, 513 of 21:08, 512 of ~20:58, 509 of ~20:45, 508 of ~16:20, 507 of ~15:48 the same day and 454/0001–0029 of 2026-09-20, which superseded the 327/0001–0024 figure of 2026-08-19, which superseded 189/0001–0021). M11 launch = BLOCKED-ON-EVAN (host, domain/DNS, prod
  secrets, Resend key, Turnstile key, SUPPORT_EMAIL, legal).**
- **M13 / M14 (added 2026-09-02).** This section stopped at M9/M10/M12 while INDEX.md
  routed every reader here for milestone status — so a session following INDEX's own
  instruction found no mention of the two most launch-relevant milestones (audit
  2026-09-02). Current: **M13.1–.5 done**; **M13.6 REOPENED** — Evan reversed the
  skip 2026-08-31 and adopted SWR, now **20 units converted / 1 remaining** (2026-09-20, Appendix AA; the "of 22" denominator never
  reconciled and is retired). `grep -rl "useAuthedQuery\|usePublicQuery" app components
  --include=*.tsx` from `frontend/` lists files that USE the hook, not finished conversions:
  it prints 21 since 2026-09-26 (BV, record BX). Check each file's loads, never the count
  alone. **M13.6 COMPLETE 2026-09-26 (record BY): 21 units**, the last being
  `messages-section`'s thread fetch (`lib/use-api.ts`,
  `useAuthedQuery`/`usePublicQuery`; `dashboard` 2026-09-05, `applicants` 2026-09-06,
  `signup-section` + `hours` + `org-checkin-section` 2026-09-20). ~~**Remaining 1:**
  `messages-section`~~ (converted 2026-09-26, BY); **M14.1 site analytics DONE** (`route_hits`,
  migration 0025, admin-only `GET /analytics/traffic`, and the `/admin` "Site
  traffic" section that reads it — 2026-09-02; it had no frontend consumer at all
  until then); **M14.2 org analytics DONE 2026-09-03** — `GET /analytics/org` scoped
  by SQL to the caller, a per-opportunity view counter on the previously dead
  `Opportunity.views` that skips the owning org, and `returning_volunteers` as a
  COUNT (never names). Fill rate is shown only for one-time listings: the backend
  maintains `spots_remaining` for those alone, so a whole-listing percentage on a
  recurring listing would be fabricated. **(Counts as of 2026-09-22: see the M1–M10
  line above — this line quoted a stale 409 / 0001–0029 until then.)** HANDOFF.md remains the live snapshot; this line
  exists so INDEX's routing is not a dead end.
- **Public portfolio (2026-07-13):** `GET /portfolio/{id}` — public verified-service transcript
  (name, verified hours, hours-by-org, awards) for opted-in students only; opt-in via
  `portfolio_public` (migration 0021, minor consent-gated + name-minimized — see security.md).
  Frontend: public `/portfolio/[id]` page + own `/portfolio` toggle + copy-link.
- **Org sees applicant identity (2026-07-13):** `student_name`/`student_email` are populated on
  `GET /applications/org` and the org branch of `GET /hours` ONLY (None on a student's own lists) —
  org-scoped v1 parity, no public exposure. Applying is consent-gated, so a minor was consented
  WHEN they applied — but a later revoke keeps the row as `withdrawn` (`withdraw_from_rosters`, in `services/enrollment.py` since 2026-09-24),
  so presence here does NOT imply current consent (corrected 2026-09-22). CSV roster export
  includes them.
- **`GET /opportunities/mine` (2026-07-13):** org-only; returns the org's OWN listings INCLUDING
  inactive/expired (the public list filters `active`). Declared BEFORE `/{opportunity_id}` so "mine"
  isn't captured as an id. Powers the org dashboard's My Listings + Listing History.
- **Org listing Deactivate / Reactivate (2026-09-25, M11 item 8):** a button on each card in
  My Listings, and Deactivate only on Listing History cards, calls
  `PATCH /opportunities/{id}/active` (`api.setActive`). Account deletion refuses while any
  listing is active, expired ones included, and until this button nothing in the UI could
  deactivate one, so an org could not delete its account in-app.
- **Account deletion is recoverable for 48 hours (2026-09-26, record CF):** after DELETE the
  dashboards go to `/login?deleted=1`, which says so; logging in inside the window shows
  "This account is scheduled for deletion on <date>. Restore it?" (Restore / Keep deleted;
  `lib/pending-deletion.ts` reads the 409). Signups released at deletion are not restored.
- **Review takedown (2026-09-26, feature inventory #10, option B):** the author or an admin can
  delete a review (`DELETE /orgs/{org_id}/reviews/{review_id}`, 204); the reviewed org gets 403.
  The public listing marks the signed-in caller's own review (`mine`, optional token), and the
  page offers "Delete my review" or, for an admin, "Remove (admin)". Since 2026-09-26 (BW)
  every review but your own also has a "Report" link: the same `ReportConcern` mailto to
  support as listings and messages, handled under `docs/SUPPORT_PROCEDURES.md` P5.
- **Off-site hours (2026-09-27, M16.1, Evan's pick):** a student logs volunteering done outside
  Citoya (`POST /hours/offsite`: activity, date, hours up to 24, optional supervisor and note;
  consent-gated). The row has no listing, source `offsite`, status `unverified` forever, and
  shows labelled "Self-reported, unverified" on /hours and the dashboard, which totals it
  separately. It never reaches a verified total, the leaderboard, the portfolio, awards or any
  org (all count status `verified`; the org branch of `GET /hours` joins the listing). The
  student can delete their own off-site rows (`DELETE /hours/{id}`, 403 on a listing-backed
  row); account deletion hard-deletes them.
- **Hours PDF (2026-09-27, M16.2, Evan's pick: print layout, no PDF library):** the dashboard's
  Hours History tab links "Download PDF" to `/hours/report?print=1`, a `.v1` page laid out for
  paper that opens the browser's print dialog once the rows load; the student picks "Save as
  PDF". Every row, oldest first (`api.listAllHours` pages past the API's 200-row cap), with
  verified, pending and self-reported totals kept apart and a note saying what each means.
- **Calendar feed (2026-09-27, M16.5, Evan's pick: private, WITH addresses):** under the
  dashboard calendar, "Create my calendar link" gives Add to Apple Calendar (webcal://), Add to
  Google Calendar and Copy link, shown once; Reset and Turn off after. The feed
  (`/calendar/feed/{token}.ics`) is the same schedule as `/calendar/mine` for the past 30 and next
  181 days, as RFC 5545 from `services/ics.py`. Security rules: security.md (the second
  credential in a URL, after the stream ticket). A real subscribe needs a public HTTPS URL, so it is tested on staging.
- **Calendar and own events (2026-09-27, M16.4):** `GET /calendar/mine?start&end` (at most 62
  days) is the student's schedule: every occurrence of each APPROVED signup (excluded dates and
  single-date subscriptions honored; cancelled listings and unapproved orgs left out, as in
  auto-log) plus their own events (`POST/DELETE /calendar/events`: private, never hours, not
  consent-gated). `services/schedule.py` holds the date logic auto-log also uses. The dashboard
  Calendar tab reads it a month at a time with prev/next buttons; own events are gold chips (click
  to delete), signups link to the listing. Before, the tab drew one chip per application whatever
  its status, and only a recurring event's first date.
- **Goals replace awards on the dashboard (2026-09-27, M16.3):** `GET/POST /goals`,
  `PUT /goals/order`, `DELETE /goals/{id}` (student only, private, not consent-gated). The five
  old milestones are seeded once as default goals (`users.goals_seeded`, claimed with a
  conditional UPDATE so two first visits cannot both seed); presets add three repeating ones.
  Periods: all, week, month, year (repeating from the start date), calendar_year (Jan 1),
  custom every N days/weeks/months. Progress is computed in the browser (`lib/goals.ts`) from
  verified + off-site hours; met goals move to a Completed section until their period resets.
  Move up / Move down, no drag and drop. `/awards/my` and the portfolios still show awards (T4).
  Since then every student page reads ALL hours rows under `hours/mine` (`api.listAllHours`);
  it held the newest 100 only.
- **Roster CSV export is free for every org (2026-09-26, #8 option A).** The pricing page, the
  terms and the dashboard upgrade copy used to sell it as Pro. It is built in the browser from
  data the org already loads, so a plan gate would have enforced nothing.
- Hardening (M9): (M9.1) `RateLimitMiddleware` (`app/core/rate_limit.py`) — 60s window per
  (IP, bucket): WRITES under `/auth/` 30/min + other writes 120/min; reads free (`GET /auth/me` too, since 2026-09-22 — T1); 429 + Retry-After;
  config `RATE_LIMIT_*`; added before CORS; `reset()` called per test in conftest.
  **SHARED STORE since 2026-09-05** (migration 0027, `rate_limit_hits`): fixed windows with a
  weighted look-back, so instances share one view instead of each keeping its own count and
  doubling the effective limit. Postgres, not Redis — no new service. Costs ~4 ms on auth/write
  requests only; its failure behaviour lives in `performance.md` (withheld from the public
  mirror since 2026-09-10, because it describes current behaviour). (M9.2) `audit_log` table (migration 0020) + `append_audit()` on
  login/password_reset/consent_*/plan_*/hours_* events; admin-only `GET /audit-log`; admin =
  the `User.is_admin` column ONLY (2026-08-06; supersedes "seeded from ADMIN_EMAILS at register
  OR email in ADMIN_EMAILS at request time" — with no email verification anywhere, that handed
  admin to whoever registered a listed address first). Promotion is explicit SQL against an
  existing account: `docs/DEPLOY_RAILWAY.md` §Granting platform admin. (M9.3) leaderboard already met the no-PII spec; only added a PII-assertion test.
- Billing UI (M8.3): `plan` is on `UserRead`. `app/billing/page.tsx` (org-only) shows the plan +
  "Upgrade to Pro" (→ `POST /billing/checkout` → redirect to the Stripe URL). Featured toggle lives
  on the opportunity detail page for the owner (pro → Feature/Unfeature via `PATCH
  /opportunities/{id}/featured`; free → an Upgrade link).
- Billing (M8.1+M8.2, done 2026-07-09): `User.plan` "free"/"pro" (orgs only, migration 0018) —
  **never gates a student feature**. Free orgs capped at 3 active listings (4th `POST /opportunities`
  → 402); featuring via `PATCH /opportunities/{id}/featured` is pro-only (free → 402), cap 3 (→ 409),
  featured sorts first in Discover. M8.2: `POST /billing/checkout` (org-only, Stripe subscription
  Checkout Session, inline price_data, → `{url}`; 503 if unconfigured, 409 if already pro) +
  `POST /billing/webhook` (signature-verified via `stripe.Webhook.construct_event` over the RAW body;
  `checkout.session.completed`→pro + store `stripe_customer_id` (migration 0019),
  `customer.subscription.deleted`→free). `stripe==11.4.1`; test-mode keys in `.env`;
  `STRIPE_WEBHOOK_SECRET` from `stripe listen`. Tests mock stripe + monkeypatch `settings`. No
  self-serve plan flip — only the webhook does it. Tests flip plan via the `conftest.py` `db_session`
  fixture.
- Notifications (M6, done 2026-07-09): every domain event calls
  `app/services/notifications.py::create_notification`, which adds the in-app row AND fires
  `send_email` unless `User.email_notifications` is false (opt-out via `PATCH /auth/me`; default
  true, migration 0015). Every email carries `Reply-To: SUPPORT_EMAIL` when set (2026-09-22 —
  the sender is a noreply subdomain that receives nothing). Email is fire-and-forget, sent before the caller's commit (accepted
  at-most-once edge, no outbox). `GET /notifications` is paginated (`limit`/`offset`).
- Messaging (M7, done 2026-07-09): ONE `messages` table, two shapes via nullable `recipient_id` —
  NULL = shared per-opportunity thread (`GET/POST /opportunities/{id}/messages`); set =
  directed. **The thread is org-WRITE-only since 2026-09-22** (Evan): the owning org posts,
  approved applicants read — v1 let applicants post too, which put minors and adult students in
  one room. A student starts a conversation PRIVATELY with `POST …/messages/to-org` (directed to
  the org's inbox). Org broadcast `POST /opportunities/{id}/messages/broadcast` (audience all/
  approved/pending → one directed message + notification per applicant); inbox `GET /messages`
  (paginated); reply `POST /messages/{id}/reply` (to the original sender; reply-auth 404).
  **An org WRITES to students only while APPROVED**: `deps.require_approved_org` guards
  `verify_hours` and `decide_application` (2026-09-23, AO C2/C3) — use it for any new route
  where an org changes a student's record. Messaging (2026-09-22, landing-check): thread post, broadcast
  and an org's reply call `_require_approved_org_sender` — rejecting an org in `/admin`
  cuts its channel to students, which it did not before.
  **Minor messaging is consent-gated** — thread-post, `to-org` and reply depend on
  `require_consent`, and reply also checks the RECIPIENT. `list_messages` filters
  `recipient_id IS NULL` so the thread never leaks directed msgs.
- Shift templates (M7): `OpportunityTemplate` (own table, migration 0017) — a JSON `data` blob of an
  opportunity's reusable fields (no date/time or runtime fields). `POST/GET /opportunity-templates`,
  org-owner-gated. Create-from-template is a client-side pre-fill of the normal opportunity POST.
- Reviews shipped but is OUT of PRD scope (kept as a bonus at Evan's direction).

## Live updates (off-roadmap, 2026-09-07, Evan-directed)

**Proven end to end on real Postgres 2026-09-10:** a committed `create_notification` reached
an open stream under uvicorn, and the header badge went `(1)` → `(2)` with no reload and no
focus event.

Server-sent events over Postgres LISTEN/NOTIFY. **Shipped slice: the notification
badge.** A notification created anywhere pushes to that user's open stream and the
header's unread count re-reads itself with no refocus and no remount. Other
surfaces still update on focus/reconnect — the transport is there, the wiring is
not (applicants, inbox, hours are the obvious next `AFFECTED_KEYS` entries).

Not a replacement for polling: **nothing on this site has ever polled** (verified
2026-09-07 across 24 SWR call sites — no `setInterval`, no `refreshInterval`, no
`SWRConfig`). See architecture.md.

## Semantics (match v1 behavior; v1's CLAUDE.md §Key Concepts is the reference)
- Roles: `student` / `org` (+ `admin`). Students free forever.
- Recurrence stored as `recurrence` (one_time/weekly/monthly) + `series_end`; occurrence dates are
  DERIVED from `start_time`, UTC-anchored (`app/core/occurrences.py`) — do NOT port v1's UTC/local
  mixing bug. Monthly clamps to a short month's last day, no drift.
- One Application per (opp, user). Subset attendance via `excluded_dates` on an all-dates sub, or a
  single `single_date` — NOT multiple single-date rows (a scope reduction vs v1).
- Waitlist = one-time opps only; when full a new application is `waitlisted`; FIFO auto-promote on
  withdraw/reject (`app/services/enrollment.py::promote_from_waitlist`).
- Hours have 3 sources: `auto` (one pending row per past occurrence, deduped by occurrence_date),
  `self` (student self-report, null occurrence_date, pending), `checkin` (redeem a per-date code →
  instantly verified). A denied row can be appealed ONCE → `appealed` → org re-decides.
- Check-in codes: per-occurrence-date, org-generated, stored in `checkin_codes` JSON on Opportunity;
  redemption requires an approved signup covering that date + guardian consent; throttled.
- Awards: verified-hour thresholds ported from v1 (`app/core/awards.py`).
- Guardian consent statuses: not_required / pending / verified / declined / revoked.
