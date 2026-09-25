# ADR 0002 — Billing at launch: ship orgs on the free Community tier only, defer live Stripe

- **Status:** ACCEPTED (Evan, 2026-08-31) — proposed 2026-07-16
- **Milestone:** M11 (launch hardening), task M11.4
- **Scope:** v2 only. Second v2 ADR (see ADR 0001 for the format precedent).

## Context

ServeLocal's business model funds a student-free platform with paid org
subscriptions: a free **Community** tier and a **Pro** tier. M8 built the
Stripe integration end to end, but it has never been wired to live keys. The
launch question (M11.4) is whether org monetization goes live at launch or is
deferred — and the deciding constraint is Evan's age.

> **Line numbers below were accurate at authoring (2026-07-16) and have drifted;
> file and symbol names still hold.** Verified 2026-09-03: the two 503 guards are
> at `billing.py:32` and `:66` (cited `:29-30` and `:61-62`), the webhook's
> event-type branches at `:90-132` (cited `:73-88`), and `STRIPE_PRO_PRICE_CENTS`
> at `config.py:83` (cited `:44`, which is now a closing paren). The $19-vs-$29
> discrepancy this ADR flags was re-checked on disk and is still open.

### The age constraint

Evan is 17. Stripe permits an account at 13+, but a minor's account cannot
transact without an adult assuming ownership:

> "You must be at least 13 years old to create a Stripe account." … "If you
> are under 18, a legal guardian must assume the role of owner of your account
> before your account can accept charges and funds can be transferred to your
> bank account."
> — Stripe Support, *Age requirement to create a Stripe account*,
> https://support.stripe.com/questions/age-requirement-to-create-a-stripe-account
> (retrieved 2026-07-16)

The Stripe Services Agreement (https://stripe.com/legal/ssa, General Terms)
carries the same rule: a user under the age of majority must add an adult
**Representative** (which may be a parent or legal guardian) to the account,
both are bound by the Agreement, and the **Representative agrees to be
responsible and liable** for the account's actions and compliance. So a live
account run by Evan alone is not permitted by Stripe's own terms; any live
account before he turns 18 must be legally owned by a guardian who accepts
liability for everything the account does.

(Age-of-majority is 18 in Evan's US jurisdiction; if that ever differs, confirm
at account creation — Stripe keys the requirement to local age of majority.)

### What the code actually does today (test-mode only)

The M8 integration is complete but **gated on keys being present**, and no live
keys exist. Verified in the current codebase:

- **Checkout is a hard 503 without a secret key.** `create_checkout` returns
  `503 SERVICE_UNAVAILABLE` "Billing is not configured" before it ever calls
  Stripe when `STRIPE_SECRET_KEY` is empty
  (`backend/app/api/routes/billing.py:29-30`):
  ```py
  if not settings.STRIPE_SECRET_KEY:
      raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Billing is not configured")
  ```
- **The webhook is likewise a 503 without a webhook secret**
  (`backend/app/api/routes/billing.py:61-62`):
  ```py
  if not settings.STRIPE_WEBHOOK_SECRET:
      raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Billing is not configured")
  ```
- **The webhook is the only thing that flips a plan.** On
  `checkout.session.completed` it sets `user.plan = "pro"`; on
  `customer.subscription.deleted` it sets `user.plan = "free"`
  (`billing.py:73-88`). There is no self-serve upgrade endpoint — the code path
  from "user clicks upgrade" to "plan flips" runs entirely through Stripe and
  its signed webhook. With no keys, **neither half works**: checkout 503s before
  a session is created, so no `checkout.session.completed` is ever emitted, so
  no plan ever flips.
- **Config defaults are empty** (`backend/app/core/config.py:42-44`):
  ```py
  STRIPE_SECRET_KEY: str = ""
  STRIPE_WEBHOOK_SECRET: str = ""
  STRIPE_PRO_PRICE_CENTS: int = 2900  # $29/mo placeholder — Evan sets the real price
  ```

Net: today the org can create an account, sit on the free tier, and see a Pro
upgrade path in the UI — but the upgrade path dead-ends at a 503. Nothing
charges anyone; nothing flips a plan.

### What the UI currently promises

- **Pricing page** (`frontend/app/pricing/page.tsx`) advertises **Pro at
  $19/month** (line 56) with a full Pro feature list, and already carries a
  hedge: "Checkout is currently in demo mode — no payment is collected. Stripe
  goes live with deployment." (lines 73-75). Its CTAs (`Start Free` / `Get Pro`)
  both route to `/register`, not to checkout.
- **Billing page** (`frontend/app/billing/page.tsx`) shows the org's current
  plan and, for free orgs, an **"Upgrade to Pro"** button (line 73) that calls
  `api.createCheckout` and redirects to the returned Stripe URL. With no keys,
  that call gets the 503 and the page renders its error text — the ApiError
  surfaces the backend `detail`, so the user literally sees **"Billing is not
  configured"** (`frontend/lib/api.ts:53-61`, `billing/page.tsx:24-28`).

Two honest UI problems fall out of this and are called out in Consequences: the
dead-end upgrade button, and a **price mismatch** — the pricing page says
$19/mo while the config default is `2900` cents = $29/mo.

## Options considered

### Option A — Launch org-side on the free Community tier only; defer live Stripe *(PRD default)*

Ship with `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` unset. Every org is on
Community. Enable live Stripe later — when Evan turns 18 (account in his own
name) or sooner via a guardian-held account if he chooses (Option B).

**Pros**
- **Compliant by construction.** No live Stripe account exists, so Stripe's
  18+/guardian-owner rule is simply not triggered. No minor is operating
  payments.
- **Zero code change to ship.** The 503 gate is already the intended
  deferral mechanism (`billing.py:29-30,61-62`); the "students free forever"
  cross-bin invariant is untouched because billing only ever gated org
  features.
- **No money movement, no PCI/dispute/refund/tax surface at launch** — one
  fewer high-liability system to get right while also launching a minors
  platform.
- Reversible: flipping Pro live later is "set two env vars + a real price,"
  not a rebuild.

**Cons**
- **No org revenue at launch.** Hosting/vetting costs are unfunded until Pro
  goes live. (Low near-term risk: cost scales with usage, and a brand-new
  platform has little.)
- **Requires UI honesty work** so the pricing/billing pages don't advertise a
  purchasable Pro that 503s (see Consequences — this is a real, must-fix item,
  not optional).

### Option B — Stand up a guardian-held live Stripe account now

A parent/legal guardian creates and legally owns the Stripe account (per the
SSA), Evan operates under it, and Pro goes live at launch.

**Pros**
- Org revenue from day one; the advertised Pro tier is real.
- Exercises the full billing path (real webhooks, real disputes) in production
  early.

**Cons**
- **Puts real legal liability on a guardian.** Under the SSA the guardian
  Representative is "responsible and liable" for the account — chargebacks,
  disputes, tax reporting (1099-K), and compliance all land on them, for a
  product a 17-year-old operates. That is a serious ask, not a checkbox.
- **A minor is effectively operating a live payments system** — exactly the
  liability/optics concern a minors-serving platform should avoid at launch.
- Adds the full money-movement surface (refunds, disputes, failed renewals,
  tax) to the launch critical path, on top of the M5 consent gate and the rest
  of M11.
- Still needs the same price-consistency fix; and if the guardian later wants
  out, unwinding a live billing account mid-flight is messier than turning it
  on later.

### Option C — Delay org monetization entirely (indefinitely, decoupled from Evan's age)

Decide Pro is a post-launch/maybe-never feature and strip the monetization
promise from the product for now.

**Pros**
- Simplest possible launch story; no "coming soon" to maintain.

**Cons**
- **Largely the same end state as Option A** for launch day (no charging), but
  throws away the working M8 integration and the funding model rather than just
  deferring the switch. The only real difference from A is messaging — whether
  the product says "Pro is coming" or says nothing.
- Undercuts the business rationale ("orgs fund the student-free platform") that
  the pricing page and project premise rest on.

**⇒ C folds into A.** The only substantive question is *messaging*, not
architecture: A already defers charging; C just also hides the Pro tier. Treat
C not as a separate path but as one of the launch-UI choices under A (the
"remove Pro entirely" end of the spectrum vs. a "Pro launching soon" state).

## Decision

**Recommend Option A — launch org-side on the free Community tier only, with
live Stripe deferred.** Enable live billing when Evan turns 18 (account in his
own name), or earlier via a guardian-held account (Option B) only if Evan and a
guardian both actively choose to take that on.

Reasoning:

1. **It's the only option that needs no compliance judgment call.** With no
   live account, Stripe's 18+/guardian-owner rule is never engaged. Options B
   requires a guardian to knowingly accept legal liability for a minor's
   payments business; A requires nothing of anyone.
2. **The code is already built for exactly this deferral.** The 503 gate isn't
   a stub pretending to be live — it's the designed "keys absent → don't call
   Stripe" path (`billing.py:29-30,61-62`), and the docstrings/config comments
   already say live billing is deferred to M11.4. Shipping A is shipping what's
   there.
3. **It keeps the launch's highest-liability system out of the critical path.**
   Launching a platform for minors is already a lot of surface (consent, data
   handling); adding live money movement, disputes, and tax reporting in the
   same launch — operated by a 17-year-old — is the wrong risk to take on now.
4. **It's cleanly reversible.** Turning Pro live later is two env vars and a
   real price; nothing about A forecloses B or a solo account at 18.

The honest cost we accept: **no org revenue at launch**, and a **required piece
of UI-honesty work** so the app doesn't advertise a Pro plan that can't be
bought. Neither is a blocker — the first is immaterial at launch scale, the
second is a small, contained frontend change (a follow-up decision for Evan,
below).

## Consequences

- **We ship on the free tier; no billing code changes to launch.** The "only
  the Stripe webhook flips `User.plan`" invariant and "students free forever"
  invariant both hold unchanged.
- **The UI currently over-promises and dead-ends — this must be resolved before
  launch.** As shipped today:
  - The **billing page's "Upgrade to Pro" button** (`billing/page.tsx:73`)
    calls checkout, which 503s, and the page shows the raw backend detail
    **"Billing is not configured"** to the org user — a confusing, broken-looking
    dead end.
  - The **pricing page advertises Pro at $19/mo** (`pricing/page.tsx:56`) with a
    full feature list and a `Get Pro` CTA. It already hedges with a "demo mode …
    Stripe goes live with deployment" note (lines 73-75), but a live public
    launch shouldn't sell a plan that can't be purchased.
  - **Price mismatch to fix regardless:** the pricing page says **$19/mo** while
    `STRIPE_PRO_PRICE_CENTS` defaults to **2900 ($29/mo)**
    (`config.py:44`). Whatever the launch decision, these two numbers must agree
    before any Pro price is shown or charged.
- **Launch-UI options for Evan (follow-up decision — NOT implemented in this
  ADR):**
  - **(i) "Pro launching soon" state**, gated on an env var (e.g. a
    `billing_live` / feature flag derived from whether `STRIPE_SECRET_KEY` is
    set). The billing page hides/replaces the Upgrade button with a "coming
    soon" note; the pricing page relabels the Pro CTA. Flipping the env var when
    Stripe goes live restores the real flow with no code change. **Recommended** —
    keeps the funding story visible and honest, and is self-healing when keys
    land.
  - **(ii) Remove the Pro tier from the UI entirely** for launch (the Option-C
    messaging), showing only Community. Cleaner but discards the "orgs fund the
    platform" narrative and needs a second change to bring Pro back.
  - **(iii) Leave the 503 as-is** — rejected: a public launch that shows minors'
    guardians and orgs a broken "Billing is not configured" error is not
    acceptable UX.
- **Residual risk carried into launch:** no org revenue (accepted — immaterial
  at launch scale). Revisit the whole decision when Evan turns 18, or if a
  guardian volunteers to own a live account sooner.

## Follow-ups (NOT implemented here — Evan decides, orchestrator applies)

1. **Pick the launch-UI treatment (i/ii/iii above).** Recommended: (i), a
   `billing_live` env-gated "Pro launching soon" state. Files:
   `frontend/app/billing/page.tsx` (the Upgrade button branch, line 73) and
   `frontend/app/pricing/page.tsx` (Pro CTA + demo-mode note, lines 56/66/73-75).
   The natural gate signal is "is `STRIPE_SECRET_KEY` set" surfaced to the
   frontend (needs a small public config/endpoint, or a build-time env var).
2. **Reconcile the Pro price.** `STRIPE_PRO_PRICE_CENTS` = 2900 ($29) in
   `backend/app/core/config.py:44` vs. "$19 / month" in
   `frontend/app/pricing/page.tsx:56`. Set both to the real launch price before
   any Pro pricing is displayed or charged. **BLOCKED-ON-EVAN** (Evan sets the
   real price).
3. **When live billing is enabled** (Evan 18, or guardian-held): set
   `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` to live keys, register the
   webhook endpoint in the Stripe dashboard, confirm the account satisfies
   Stripe's ownership rule (self at 18, or guardian Representative per the SSA),
   and flip the launch-UI gate from #1. **BLOCKED-ON-EVAN** (account/keys).
4. **If Option B is ever chosen:** document the guardian as the legal account
   owner/Representative and their acceptance of SSA liability before going live —
   this is a legal commitment, not a config step.

## Accepted (appended 2026-08-31 ~22:12 CDT)

Evan decided: launch free-tier-only. In the same message he picked the launch
UI for the Pro surface — **"coming soon"** rather than leaving the would-503
upgrade path — built the same session (see the record entry of 2026-08-31
~22:12 CDT and the commit that follows it). The refund-policy draft (cancel
anytime, end-of-period, no proration) was accepted in the same batch; it is
moot while billing is free-tier-only but stands in the ToS.
