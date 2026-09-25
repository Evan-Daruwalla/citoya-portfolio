# ADR 0001 — Token storage for launch: keep localStorage-JWT, do not switch to cookie sessions

- **Status:** ACCEPTED (Evan, 2026-08-31) — proposed 2026-07-16
- **Milestone:** M11 (launch hardening), task M11.1(a)
- **Scope:** v2 only. This is v2's first ADR; v1's 15 ADRs live in the separate v1 repo.

## Context

v2 authenticates with a signed JWT the browser stores in `localStorage` and sends
as an `Authorization: Bearer` header on every authed request. The question for
launch is whether that scheme is safe enough to ship to a platform whose users
include minors, or whether we should switch to HttpOnly-cookie sessions before M11.

Verified reality of the current scheme in **this** codebase:

> **Line numbers below were accurate when this ADR was written (2026-07-16) and
> have since drifted; the file and symbol names still hold.** Verified 2026-09-03:
> the TTL is `ACCESS_TOKEN_EXPIRE_MINUTES` in `config.py` (cited `:29`~~, now `:57`~~),
> and rate limits are `RATE_LIMIT_AUTH_PER_MIN` (cited `:50`~~, now `:104`~~) (2026-09-24,
> audit: both "now" lines had drifted again; find each constant by name). **One is
> wrong about the FILE, not just the line:** `TOKEN_KEY` is no longer defined in
> `frontend/lib/auth-context.tsx` — it moved to `frontend/lib/api.ts` and is only
> imported and re-exported there. Prefer the symbol over the line when following
> any citation in this document.

- **Token minting / TTL.** HS256 JWT via PyJWT, claims `sub` + `tv` + `exp`
  (`backend/app/core/security.py:35`). TTL is **7 days**:
  `ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days`
  (`backend/app/core/config.py:29`). There is **no refresh token**.
- **Storage + transport (client).** Token is written to `localStorage` under
  ~~`servelocal_token` (`frontend/lib/auth-context.tsx:16`, set at `:58`, read at
  `:44`/`:68`)~~ `citoya_token` (2026-09-24, audit: the key was renamed in the in-repo
  rename, root record BA; it is `TOKEN_KEY` in `frontend/lib/api.ts`, set by `login`
  and read on mount in `frontend/lib/auth-context.tsx`) and attached as
  `Authorization: Bearer ${token}` in the fetch wrapper (~~`frontend/lib/api.ts:48`~~
  `request` in `frontend/lib/api.ts`). Every authed API method takes the token as an
  explicit argument.
- **Server-side invalidation.** `token_version` (int on `User`) is embedded as JWT
  claim `tv` and compared in `get_current_user` (`backend/app/api/deps.py:32`). It
  is bumped on **password reset** (`backend/app/api/routes/auth.py:307`) **and on
  account deletion** (`backend/app/api/routes/auth.py:246`), invalidating every JWT
  issued before that event. It is **not** bumped on logout — `logout()` only
  removes the key from `localStorage` client-side
  (`frontend/lib/auth-context.tsx:72`); there is no server logout endpoint, so a
  copied token stays valid until `exp`.
- **XSS-theft calculus (materially changed 2026-07-16 by the CSP).** The whole
  argument against `localStorage` tokens is that script running in the page can
  read them. That surface is now tightly constrained:
  - CSP header on every route (`frontend/next.config.mjs:17-27`):
    `default-src 'self'`, `frame-ancestors 'none'`, `base-uri 'self'`,
    `form-action 'self'`, `connect-src 'self' <apiOrigin>`,
    `img-src 'self' data:`, `font-src 'self'`. **Production has no
    `'unsafe-eval'`** — it is gated behind `isDev` at `:19` for Next HMR only.
  - `connect-src` is limited to self + the API origin, so even if an attacker
    executed script, exfiltrating a stolen token to an attacker host is blocked by
    CSP (no arbitrary `fetch`/`XHR`/`WebSocket` egress).
  - Remaining CSP gap: `script-src` keeps `'unsafe-inline'` (`:19`). Inline script
    is still allowed, so CSP is not a hard stop against a reflected/stored-XSS
    injection **if one existed**.
  - But the stored-XSS surface itself is minimal: React auto-escapes all rendered
    values and there is **zero** `dangerouslySetInnerHTML` in the frontend
    (grep, 2026-07-16; corroborated by the stored-XSS audit 2026-07-15). No
    `v-html`-style raw-injection path exists.
- **No CSRF surface today.** The app sets **zero cookies**; auth rides an explicit
  header, which browsers do not attach automatically cross-site. There is nothing
  for a CSRF attack to ride. A cookie switch would *create* this surface.
- **SSR does not touch authed content.** There is no `middleware.ts`/edge auth
  (glob, 2026-07-16) and `auth-context.tsx` is `"use client"`; every authed fetch
  is client-side with the token passed explicitly. The usual "HttpOnly cookies let
  the server render authed pages" benefit does not apply here.
- **Rate limiting.** Per-IP sliding-window limiter, `/auth/*` at 30/min
  (`backend/app/core/config.py:50`, `backend/app/core/rate_limit.py`), which blunts
  online brute-force / credential stuffing. In-memory / single-process; a shared
  store is already flagged for M11.
- **Minors threat model.** Students frequently use **shared** machines (school
  labs, public library). A token that survives tab-close and stays valid for a week
  is a real-world exposure on those machines — but note this is a *persistence +
  TTL + logout* problem, not intrinsically a *storage-mechanism* problem: a
  non-session HttpOnly cookie on a shared machine persists the same way.

## Options considered

### Option A — Keep localStorage-JWT + Authorization header (current)

**Pros**
- Zero new attack surface: no cookies → no CSRF to defend, no SameSite edge cases.
- The one classic weakness (script reads the token) is heavily mitigated *in this
  codebase*: no `dangerouslySetInnerHTML`, React escaping, prod CSP with no
  `'unsafe-eval'` and a `connect-src` allowlist that blocks token exfiltration.
- No engineering work on the critical path to launch; nothing new to get subtly
  wrong right before shipping to minors.
- Matches how the frontend already works (client-side fetches, explicit token) —
  no SSR benefit is being left on the table.

**Cons**
- Token is readable by any script that runs in the page; `'unsafe-inline'` in
  `script-src` means CSP is not a hard backstop if a stored-XSS hole ever appears.
- **7-day TTL is long** and there is no refresh/rotation, so a stolen or
  shoulder-surfed token is valid for a week.
- **Logout is client-only** — it does not invalidate the token server-side, so a
  token copied off a shared machine keeps working after the student "logs out."

### Option B — Switch to HttpOnly + Secure cookie sessions before launch

**Pros**
- Token becomes unreadable to page JavaScript (defeats XSS *theft* specifically).
- `Max-Age`/session-scoping can bound persistence on shared machines.

**Cons**
- **Creates a CSRF surface that does not exist today.** Requires SameSite=Lax/Strict
  *and* a CSRF-token scheme for state-changing requests — new machinery, new tests,
  new ways to be wrong, landed on the launch critical path.
- Touches a lot: `security.py` (issue via `Set-Cookie`), `deps.py` (read token from
  cookie), a real server-side logout that clears the cookie, `api.ts` (drop the
  header, add `credentials: 'include'`), `auth-context.tsx` (can no longer read the
  token — hydrate purely from `/auth/me`), CORS (`allow_credentials` + exact
  origins), plus new CSRF middleware and its tests.
- Cross-site `connect-src`/CORS + credentialed requests get fiddly across the
  frontend origin and the API origin (they are distinct today).
- **Does not fix the actual weaknesses** (long TTL, no server logout, shared-machine
  persistence) unless we *also* do the TTL/logout work — which we can do far more
  cheaply under Option A.
- Buys the least where we're already covered (no SSR authed content; CSP already
  blocks exfiltration) and costs the most where it hurts (launch timeline, new CSRF
  risk on a minors platform).

## Decision

**Keep the current localStorage-JWT + Authorization-header scheme for launch
(Option A).** Do **not** switch to cookie sessions for M11.

Reasoning grounded in this codebase, not generic guidance:

1. The single reason to prefer HttpOnly cookies — XSS token theft — is already
   heavily mitigated here: no `dangerouslySetInnerHTML`, React escaping, and a
   production CSP (`next.config.mjs:17-27`) with no `'unsafe-eval'` and a
   `connect-src` allowlist that blocks exfiltrating a stolen token off-origin.
2. The cookie switch would **introduce** a CSRF attack surface we do not have today
   (zero cookies) and put brand-new CSRF/SameSite machinery on the launch path for a
   platform serving minors — the wrong time to add subtle, security-critical code.
3. The HttpOnly/SSR advantage does not apply: no authed content is server-rendered
   (no `middleware.ts`; `auth-context.tsx` is client-only).
4. The genuine weaknesses are **TTL length and logout semantics, not the storage
   mechanism** — and those are fixable cheaply within Option A (see Follow-ups). A
   cookie migration would not fix them for free either.

The honest flaw we are shipping with: a **7-day token, no server-side logout**, on a
platform whose users share machines. We accept this for launch *only paired with*
the Follow-up mitigations below (TTL tightening + real logout invalidation +
logout-on-401), which close most of the exposure without a storage rewrite.

## Consequences

- We ship on the existing auth code; no auth rewrite blocks M11.
- No CSRF surface is introduced.
- We carry a known, documented residual risk (long TTL / client-only logout) into
  launch, tracked here and addressed by the Follow-ups. If a stored-XSS hole is ever
  found, the token is stealable (CSP blocks *exfiltration*, not *reading*), so the
  no-`dangerouslySetInnerHTML` invariant and CSP must be treated as load-bearing and
  guarded in review.
- Revisit if any of these change: authed content moves to SSR; a third-party
  script/CDN gets added (widens the XSS surface and would need CSP relaxation);
  or session-UX needs (silent refresh, "remember me") push us toward a refresh-token
  design — at which point Follow-up 4 is the migration path.

## Follow-ups (NOT implemented here — orchestrator applies approved items)

Cheap mitigations that keep Option A and close the real gaps. Do not implement in
this ADR task (backend config is being edited concurrently by another worker).

1. **Tighten the access-token TTL.** `ACCESS_TOKEN_EXPIRE_MINUTES` is 7 days at
   `backend/app/core/config.py:29`. Shorten it (e.g. 12–24h). Tradeoff: with no
   refresh token, a shorter TTL forces more frequent re-login — pick a value that
   balances shared-machine exposure against student UX. This is the single
   highest-value mitigation.
2. **Make logout invalidate server-side.** Today `logout()` only clears
   `localStorage` (`frontend/lib/auth-context.tsx:72`); the JWT stays valid until
   `exp`. Add a logout endpoint that bumps `token_version` (same mechanism as reset
   at `backend/app/api/routes/auth.py:307`, checked at `backend/app/api/deps.py:32`)
   so "log out" actually kills the token — important on shared machines.
3. **Logout-on-401 interceptor.** In the fetch wrapper's error branch
   (~~`frontend/lib/api.ts:53`~~ `request` in `frontend/lib/api.ts`), on a 401 clear
   ~~`servelocal_token`~~ `citoya_token` (2026-09-24, audit: renamed, root record BA) and route to login,
   reusing `auth-context.tsx`'s `logout()`. Prevents a rejected/expired token from
   lingering in a confusing half-logged-in state (and pairs with #1's shorter TTL).
4. **Future — refresh-token rotation.** If/when session UX needs silent renewal,
   add a short-lived access token + a rotating refresh token (a refresh token is the
   one credential that genuinely belongs in an HttpOnly cookie). This is the
   incremental path to cookie-backed sessions *without* the full session rewrite
   Option B implies, and it can be scoped post-launch.
5. **Already tracked:** move the single-process rate limiter to a shared store for a
   multi-process deploy (`backend/app/core/rate_limit.py`, flagged for M11) — matters
   for brute-force resistance on `/auth/*` once we scale past one process.

---

## Follow-up status (appended 2026-08-06, verified against the code)

The Follow-ups above were written as "NOT implemented here". Three of them have
since landed. Recorded because an ADR whose follow-up list is stale is worse than
none — a launch reader would re-do work, or assume risk that is already closed.
Each line below was checked against the source, not against HANDOFF.

| # | Follow-up | Status |
|---|---|---|
| 1 | Tighten access-token TTL | **DONE** — 7 days → **24h**, `config.py` `ACCESS_TOKEN_EXPIRE_MINUTES = Field(default=60 * 24, ge=1)` (2026-08-05 audit). The `ge=1` bound is new too: a 0/negative value minted already-expired tokens. |
| 2 | Server-side logout invalidation | **DONE** — `POST /auth/logout` bumps `token_version` (`logout` in `auth.py`), checked in `get_current_user` (`deps.py`). Logging out now genuinely kills the token, which was the shared-machine gap. |
| 3 | Logout-on-401 interceptor | **DONE** — ~~`frontend/lib/api.ts:66`~~ `request` in `frontend/lib/api.ts` (2026-09-24, audit: line refs dropped) clears the token and routes to login on a 401 that carried a token. Tokenless 401s (a failed login) correctly clear nothing. |
| 4 | Refresh-token rotation | **NOT DONE, post-launch by design.** Unchanged. |
| 5 | Shared-store rate limiter | **DONE 2026-09-05/06** (added 2026-09-22; the text after this note is the earlier status, kept): the limiter moved to Postgres (`rate_limit_hits`, migration 0027) and the throttles followed (`throttle_state`, 0028), shared across instances. Earlier status: **NOT DONE.** Still single-process in-memory (`core/rate_limit.py`). A key-eviction sweep was added 2026-08-05 (an IPv6 /64 scan grew `_hits` without bound), but a multi-process deploy still needs Redis. **Relevant to Railway: more than one replica silently multiplies every rate limit by the replica count.** |

**The residual risk this ADR accepted is materially smaller than at signing.** The
decision paragraph says we ship "a 7-day token, no server-side logout" — both of
those are now fixed. What remains of Option A's downside is narrower: the token is
still readable by page script if a stored-XSS hole ever appears, and `script-src`
still carries `'unsafe-inline'`. The load-bearing invariants remain: **zero
`dangerouslySetInnerHTML`** (re-verified with two tools in the 2026-08-05 audit) and
the production CSP's `connect-src` allowlist blocking off-origin exfiltration.

**Status is unchanged: still Proposed.** Evan's sign-off is BLOCKED-ON-EVAN. The
implementation side of PRD criterion "documented token-storage decision ... implemented
before launch" is now satisfied; the sign-off side is not.

## CSP gap closed (appended 2026-08-07 ~05:38 CDT)

The paragraph above says `script-src` "still carries `'unsafe-inline'`". **That is
no longer true**, and the sentence is left in place rather than edited so the
sequence stays readable.

`frontend/proxy.ts` now mints a per-request nonce and builds the CSP there, so
`script-src` is `'self' 'nonce-<per-request>' https://challenges.cloudflare.com`
with **no `'unsafe-inline'`**. The static CSP was removed from `next.config.mjs`
in the same change — two `Content-Security-Policy` headers are intersected by the
browser, not overridden, so leaving the old one would have silently broken every
page.

This directly shrinks the residual risk this ADR accepted. The argument for
Option A leaned on "the stored-XSS surface itself is minimal" (zero
`dangerouslySetInnerHTML`, React auto-escaping) — an argument about there being
no *sink today*, which a single future mistake could invalidate. CSP is now an
actual backstop rather than a claim: an injected inline `<script>` is refused by
the browser even if a sink appears.

Verified in a production build (`npm run start`), not just read:

| Control | Result |
|---|---|
| Inline `<script>` with no nonce | **blocked** — console: "Executing inline script violates the following Content Security Policy directive"; the injected function never ran |
| Inline `<script>` carrying the served nonce | ran (this is the path Next's own bootstrap uses) |
| `https://challenges.cloudflare.com` script tag | loaded — Turnstile still works |
| Nonce value across two requests | different each time |
| App hydration + client-side nav | working (role toggle flips state, `/register` → `/login` without a document load) |

Two deliberate limits, so nobody reads this as stronger than it is:

- **`style-src` keeps `'unsafe-inline'`.** A nonce covers `<style>` elements but
  never `style="..."` attributes, and React's `style={{...}}` prop compiles to
  exactly that attribute — which the `.v1` pages use throughout. Removing it
  would break the layout of every screen. CSS-only injection is a much weaker
  primitive than script execution, but it is not zero.
- **No `'strict-dynamic'`.** It would make the browser ignore the Turnstile host
  allowlist, and Turnstile is injected by app code as a plain `<script>` tag.

Cost paid: the nonce cannot exist in HTML generated at build time, so
`app/layout.tsx` sets `export const dynamic = "force-dynamic"` and 28 routes
moved from static prerender to per-request render. Cheap for this app — every
page is a client shell that fetches from the API in the browser, so no
server-side data work was being cached — but it does mean the HTML is no longer
CDN-cacheable.

## Accepted (appended 2026-08-31 ~22:12 CDT)

Evan signed off: keep localStorage-JWT with the 24h TTL that has been live
since 2026-08-05. Nothing changes in code — this ratifies what runs. The
Proposed-era sections above are left as written per this file's own
convention.
