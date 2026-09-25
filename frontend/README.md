# Citoya Frontend (v2)

Next.js (App Router) + React + TypeScript + Tailwind CSS + shadcn/ui. The web client
for the Citoya v2 rewrite; talks to the FastAPI backend in the sibling `../backend`.

> **Status: M1–M10 + M12 + M13 + v1 exact-copy complete; frontier = M11 public launch,
> BLOCKED-ON-EVAN** (updated 2026-08-25 — see `../HANDOFF.md` for the live snapshot).
> Guardian consent (M5) and billing (M8, Stripe test mode) both ship; TOTP MFA stays
> explicitly out of scope for this plan. `backend/README.md` has the exact scope status
> per slice, but it is **private-tree only** — it is not shipped to the public
> `citoya-portfolio` mirror, so a mirror reader following this pointer will find
> nothing there.

## Stack
- **Next.js 16** (App Router, React Server Components)
- **React 19** + **TypeScript**
- **Tailwind CSS 3** (shadcn design tokens in `app/globals.css`)
- **shadcn/ui** — copy-in component library (`components/ui/`)
- **lucide-react** icons

## Quick start
```bash
npm install
cp .env.example .env.local        # point NEXT_PUBLIC_API_URL at the backend
npm run dev                        # http://localhost:3000
```

## Adding shadcn components
The registry is configured in `components.json`. Add components as needed:
```bash
npx shadcn@latest add button card input dialog
```
They land in `components/ui/` and import the `cn()` helper from `@/lib/utils`.

## Layout
29 routes under `app/` as of 2026-08-25 (`find app -name page.tsx | wc -l`):
```
app/
  layout.tsx              # root layout — wraps children in AuthProvider
  page.tsx                # home: nav links by role, or Log in / Sign up
  login/page.tsx
  register/page.tsx       # includes a student/org role toggle
  forgot/page.tsx
  reset/page.tsx
  discover/page.tsx       # public opportunity browse + category filter
  opportunities/
    [id]/page.tsx         # opportunity detail + student Apply button
    new/page.tsx          # org-only post form
  applications/page.tsx   # student: my applications + status
  applicants/page.tsx     # org dashboard: listings, applicants, verify hours, analytics, profile
  hours/page.tsx           # student: auto-logs on load, lists hours, shows awards progress
  verify-hours/page.tsx    # org: verify/deny pending hours
  dashboard/page.tsx       # student dashboard (v1-exact-copy)
  saved/page.tsx
  leaderboard/page.tsx
  inbox/page.tsx
  notifications/page.tsx
  billing/page.tsx
  pricing/page.tsx
  for-organizations/page.tsx
  donate/page.tsx
  privacy/page.tsx
  terms/page.tsx
  welcome/page.tsx
  admin/page.tsx
  portfolio/
    page.tsx               # own public-portfolio toggle
    [id]/page.tsx           # public transcript by id
  consent/
    decide/page.tsx         # guardian approve/decline; token read from the URL fragment
    manage/page.tsx      # guardian revoke; token read from the URL fragment
  globals.css    # Tailwind directives + shadcn CSS variables (light/dark) + v1 component vocabulary
  v1.css         # v1's raw CSS ported verbatim, scoped under a `.v1` root
components/
  ui/            # shadcn components (4 files: button, input, label, card)
  v1/            # V1Shell (shared v1 nav/footer), category-icon
  consent-banner.tsx    # M5 gated-student resend/status surface
  site-header.tsx, site-footer.tsx  # non-v1 chrome
  student-cell.tsx      # applicant identity cell, greyed when inactive
  support-email.tsx     # renders SUPPORT_EMAIL or a placeholder
  turnstile-widget.tsx  # M11.1 Cloudflare Turnstile bot defense
lib/
  api.ts             # typed fetch wrapper around the backend (all routes)
  auth-context.tsx   # AuthProvider + useAuth(): token in localStorage (TOKEN_KEY, exported), current user
  types.ts           # types matching the backend schemas
  utils.ts           # cn() class-merge helper
  support.ts         # SUPPORT_EMAIL single source of truth (BLOCKED-ON-EVAN until set)
  humanize-detail.ts  # turns FastAPI's `detail` (string or {code,message}) into user-readable text
  v1-routes.ts        # V1_ROUTES + isV1Route() — which routes render v1's own chrome
  use-api.ts          # useAuthedQuery/usePublicQuery — the SWR data-fetching chokepoint
                      #   (M13.6: 20 units converted, 1 remaining, 2026-09-20 — recount with
                      #   grep -rl "useAuthedQuery\|usePublicQuery"). Returns {data,error,loading,retry}:
                      #   read `error`, or a failed load renders as an EMPTY state
  status.ts           # HOURS_/APPLICATION_ status label+pill maps (consolidated 2026-08-31
                      #   from 4 copies across 2 status domains)
  flags.ts            # NEXT_PUBLIC_BILLING_LIVE gate for the Pro surface (ADR-0002)
components.json   # shadcn config
tailwind.config.ts
```

## Auth
`useAuth()` (from `lib/auth-context.tsx`) exposes `user`, `loading`, `login()`,
`register()`, `logout()`. On mount it reads the token from `localStorage` and calls
`/auth/me` to restore the session; a failed/expired token is cleared silently. Pages
outside the auth context (e.g. the opportunity-apply button) read the token directly via
the exported `TOKEN_KEY` constant.

## Notes
- Uses Tailwind v3 for maximum ecosystem stability. To move to Tailwind v4 later,
  re-run `npx shadcn@latest init` and follow its migration.
- Deployment (future): static/SSR on Vercel, or containerize for AWS Amplify/App Runner,
  GCP Cloud Run, or Azure Static Web Apps / Container Apps. `NEXT_PUBLIC_API_URL` is the
  only required build/runtime var.
