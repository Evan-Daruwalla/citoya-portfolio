// The one home for status display vocabulary. These maps were defined
// independently in four files, which is how the `withdrawn` pill shipped broken
// (landing-check 2026-08-12): a status added on the backend must appear in
// every map below, and scattered copies get missed. Two DISTINCT domains share
// the word "status" — don't merge them:
//
//   * Application status: pending / approved / rejected / waitlisted / withdrawn
//   * Hours status:       pending / verified / denied / appealed / unverified
//                         (unverified = off-site only, 2026-09-27)
//
// Adding a status? Update every map in its domain — they sit adjacent so the
// sweep is visible. Pill classes (`sp-*`) are defined per CSS system in
// `app/globals.css` (non-.v1 routes) and `app/v1.css` (.v1 routes) — that
// duplication is the deliberate v1 exact-copy architecture; keys used here must
// exist in BOTH files. `sp-appealed` exists only in v1.css, so hours statuses
// map `appealed` to `sp-waitlisted`, which v1.css styles identically.
//
// NOT sourced from here, deliberately: `applicants/page.tsx` (org dashboard,
// v1-parity surface) renders raw status words via the identity mapping
// `sp-${status}` — its copy register is the org's, not the student's.

// ── Application status ──────────────────────────────────────────────────────

// Used by: app/applications/page.tsx
export const APPLICATION_STATUS_LABEL: Record<string, string> = {
  pending: "Pending approval",
  approved: "Approved",
  rejected: "Not accepted",
  waitlisted: "Waitlisted",
  // Set by a guardian's revoke (M5). Without an entry here the student saw the
  // raw word "withdrawn" in an amber "pending"-coloured pill, because both maps
  // fall back (landing-check 2026-08-12). The applications page is NOT
  // consent-gated — a revoked student can still sign in and read their own
  // state, which is the point — so it is a live surface, not a theoretical one.
  withdrawn: "Withdrawn",
};

// Used by: app/applications/page.tsx
export const APPLICATION_STATUS_PILL: Record<string, string> = {
  pending: "sp-pending",
  approved: "sp-approved",
  rejected: "sp-rejected",
  waitlisted: "sp-waitlisted",
  withdrawn: "sp-withdrawn",
};

// Used by: app/opportunities/[id]/signup-section.tsx (post-apply confirmation)
export const APPLICATION_STATUS_MESSAGE: Record<string, string> = {
  approved: "You're signed up!",
  pending: "Application submitted. Pending approval.",
  waitlisted: "You're on the waitlist. We'll sign you up if a spot frees.",
  // Shown on the listing page since L9 (2026-09-22); without it the raw word rendered.
  rejected: "This application wasn't approved.",
  // A guardian's revoke withdraws the signup (M5). Says what happened without
  // pretending it can be undone here — restoring consent is the guardian's
  // action, and re-signing-up is blocked by `require_consent` until it is.
  withdrawn: "This signup was withdrawn because guardian approval was removed.",
};

// ── Hours status ────────────────────────────────────────────────────────────

// Used by: app/hours/page.tsx
export const HOURS_STATUS_LABEL: Record<string, string> = {
  pending: "Pending verification",
  verified: "Verified",
  denied: "Denied",
  appealed: "Appeal under review",
  // Off-site entries (2026-09-27): the label says it every time, because nothing
  // else on the page distinguishes them from hours an organization confirmed.
  unverified: "Self-reported, unverified",
};

// Used by: app/dashboard/page.tsx (dense history table — compact register)
export const HOURS_STATUS_LABEL_COMPACT: Record<string, string> = {
  pending: "Pending",
  verified: "Verified",
  denied: "Denied",
  appealed: "Appealed",
  unverified: "Self-reported",
};

// Used by: app/hours/page.tsx, app/dashboard/page.tsx.
// `appealed` → sp-waitlisted because globals.css defines no sp-appealed and
// v1.css styles sp-appealed and sp-waitlisted with the same rule — one key that
// renders correctly in both CSS systems. `unverified` → sp-self, defined in both.
export const HOURS_STATUS_PILL: Record<string, string> = {
  pending: "sp-pending",
  verified: "sp-verified",
  denied: "sp-denied",
  appealed: "sp-waitlisted",
  unverified: "sp-self",
};
