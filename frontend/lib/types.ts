/**
 * Client-side mirror of the backend response schemas (`backend/app/schemas/*`).
 * When a schema changes there, update the matching interface here, then the call
 * that returns it in `lib/api.ts`. Grouped by domain below — search the banners
 * (`── Domain ──`) to jump to a type.
 */

// ── Auth & user ──
// No "admin": the backend enum dropped it 2026-09-01 (assigned nowhere, and
// registration is Literal[student, org]). Platform admin is the separate
// `is_admin` flag below.
export type Role = "student" | "org";

export type ConsentStatus = "not_required" | "pending" | "verified" | "declined" | "revoked";

export interface User {
  id: string;
  email: string;
  role: Role;
  full_name: string | null;
  is_active: boolean;
  is_admin: boolean;
  /** M15.1 org-approval gate. Meaningful only for role === "org". */
  is_approved: boolean;
  /** M15.2: when an admin last decided. With `is_approved` false it means REJECTED,
   *  not pending. */
  org_reviewed_at: string | null;
  email_notifications: boolean;
  portfolio_public: boolean;
  plan: "free" | "pro";
  created_at: string;
  dob: string | null;
  guardian_consent_status: ConsentStatus;
  // The latest guardian invite's outcome: true sent, false failed, null never attempted.
  guardian_invite_sent?: boolean | null;
}

export interface ConsentContext {
  student_first_name: string;
  student_last_initial: string;
}

export interface ConsentManageContext extends ConsentContext {
  status: ConsentStatus;
}

export interface Token {
  access_token: string;
  token_type: string;
}

// ── Opportunities & applications ──
export interface Opportunity {
  id: string;
  org_id: string;
  org_name: string;
  title: string;
  category: string;
  location: string;
  lat: number | null;
  lng: number | null;
  start_time: string;
  end_time: string;
  duration_hours: number;
  skills: string[];
  commitment: string;
  spots_available: number;
  spots_remaining: number;
  description: string;
  requires_approval: boolean;
  min_age: number | null;
  format: string;
  recurrence: "one_time" | "weekly" | "monthly";
  series_end: string | null;
  /** IANA zone the event happens in (D1, 2026-09-22) — its dates are dates HERE. */
  timezone: string;
  active: boolean;
  featured: boolean;
  created_at: string;
}

export interface Application {
  id: string;
  opportunity_id: string;
  user_id: string;
  // "withdrawn" is set by a guardian's revoke, which takes the student off the
  // roster while KEEPING the row so the org retains its record (2026-08-11).
  // Every backend consumer keys on "approved", so this one value removes them
  // from check-in, auto-log, thread access, reviews and spot counting at once.
  status: "pending" | "approved" | "rejected" | "waitlisted" | "withdrawn";
  subscription_type: "all_dates" | "single_date";
  single_date: string | null;
  excluded_dates: string[];
  created_at: string;
  resolved_at: string | null;
}

export interface ApplicationWithOpportunity extends Application {
  opportunity: Opportunity;
  // Org-facing only (GET /applications/org); null on a student's own list.
  student_name?: string | null;
  student_email?: string | null;
  // Account deleted/deactivated, or a guardian revoked consent. Deliberately one
  // flag that does not say which — see INACTIVE_ACCOUNT_HINT.
  student_inactive?: boolean;
}

// ── Hours & awards ──
export interface Hours {
  id: string;
  // Null only for an off-site entry (2026-09-27): volunteering outside Citoya.
  opportunity_id: string | null;
  user_id: string;
  occurrence_date: string | null;
  hours: number;
  // "unverified" is off-site only: no organization can confirm it, ever.
  status: "pending" | "verified" | "denied" | "appealed" | "unverified";
  source: "auto" | "self" | "checkin" | "offsite";
  note: string | null;
  supervisor_name: string | null;
  deny_note: string | null;
  appeal_note: string | null;
  appealed: boolean;
  // What an off-site entry was; null on every other row.
  activity: string | null;
  created_at: string;
}

export interface HoursWithOpportunity extends Hours {
  opportunity: Opportunity | null;
  // Org-facing only (org branch of GET /hours); null on a student's own list.
  student_name?: string | null;
  student_email?: string | null;
  // See ApplicationWithOpportunity.student_inactive.
  student_inactive?: boolean;
}

// ── Calendar (M16.4, 2026-09-27) ──
// One entry on the student's calendar: an occurrence of an approved signup, or one of
// the student's own events (private, never hours).
export interface CalendarItem {
  kind: "signup" | "personal";
  id: string;
  opportunity_id: string | null;
  title: string;
  org_name: string | null;
  date: string; // local date in `timezone`
  all_day: boolean;
  starts_at: string | null; // UTC instant; null for an all-day own event
  ends_at: string | null;
  timezone: string;
  location: string | null;
  note: string | null;
}

export interface PersonalEventInput {
  title: string;
  date: string;
  start_time?: string;
  end_time?: string;
  timezone: string;
  location?: string;
  note?: string;
}

// ── Goals (M16.3, 2026-09-27) ──
export interface Goal {
  id: string;
  title: string;
  target_hours: number;
  period: "all" | "week" | "month" | "year" | "calendar_year" | "custom";
  every: number | null;
  unit: "day" | "week" | "month" | null;
  start_date: string;
  position: number;
  created_at: string;
}

export interface GoalPreset {
  key: string;
  title: string;
  target_hours: number;
  period: Goal["period"];
  every: number | null;
  unit: Goal["unit"];
}

export interface MyGoals {
  goals: Goal[];
  presets: GoalPreset[];
}

export interface Award {
  id: string;
  name: string;
  hours: number;
  description: string;
}

export interface MyAwards {
  verified_hours: number;
  earned: Award[];
  next: Award | null;
}

// ── Community (public leaderboard, portfolio, reviews) ──
export interface LeaderboardEntry {
  rank: number;
  name: string;
  hours: number;
}

export interface PublicPortfolio {
  name: string;
  verified_hours: number;
  organizations: number;
  hours_by_org: { org_name: string; hours: number }[];
  awards: Award[];
}

export interface Review {
  id: string;
  org_id: string;
  author_name: string;
  rating: number;
  text: string;
  created_at: string;
  // True only for the signed-in author; the listing sets it from an optional token.
  mine: boolean;
}

export interface OrgReviews {
  org_id: string;
  average_rating: number | null;
  count: number;
  reviews: Review[];
}

// ── Notifications & messaging ──
export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  opportunity_id: string;
  sender_id: string;
  sender_name: string;
  recipient_id: string | null;
  body: string;
  created_at: string;
}

// ── Templates & create/update inputs ──
export interface OpportunityTemplate {
  id: string;
  name: string;
  data: {
    title: string;
    category: string;
    location: string;
    lat: number | null;
    lng: number | null;
    skills: string[];
    commitment: string;
    spots_available: number;
    description: string;
    requires_approval: boolean;
    min_age: number | null;
    format: string;
    recurrence: "one_time" | "weekly" | "monthly";
    timezone?: string; // absent on templates saved before D1
  };
  created_at: string;
}

export interface OpportunityCreateInput {
  title: string;
  category: string;
  location: string;
  lat?: number | null;
  lng?: number | null;
  start_time: string;
  end_time: string;
  skills: string[];
  commitment: string;
  spots_available: number;
  description: string;
  requires_approval: boolean;
  min_age?: number | null;
  format: string;
  recurrence: "one_time" | "weekly" | "monthly";
  series_end?: string | null;
  /** With a zone, the times above are wall-clock times THERE ("2026-11-10T18:30"),
   *  converted by the API — the browser can only convert from its own zone. */
  timezone: string;
}

// ── Analytics (M14.1) ──
// Mirrors backend/app/schemas/analytics.py. `route_hits` has NO user, IP, session
// or opportunity column by design, so nothing derived from these types may ever be
// labelled "visitors", "users" or "views" — app/privacy/page.tsx promises the
// public that these are request counts and nothing else.
export interface RouteHitRead {
  day: string; // "YYYY-MM-DD" (UTC day)
  route: string; // full template incl. the /api/v1 prefix
  method: string;
  count: number;
}

export interface OrgListingStat {
  id: string;
  title: string;
  active: boolean;
  recurrence: "one_time" | "weekly" | "monthly";
  views: number; // lifetime detail views, owner's own visits excluded
  approved: number; // approved signups only — not pending/rejected/withdrawn
  spots_available: number;
  verified_hours: number;
}

export interface OrgAnalytics {
  listing_count: number;
  total_views: number;
  total_approved: number;
  total_verified_hours: number;
  // A COUNT, never names. Students appear nowhere in this payload — a backend test
  // fails if one ever does.
  returning_volunteers: number;
  listings: OrgListingStat[];
}

/** One organization in the admin review queue (M15.2). */
export interface AdminOrg {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  reviewed_at: string | null;
  review_status: OrgReviewStatus;
  listing_count: number;
}

export type OrgReviewStatus = "pending" | "approved" | "rejected";

/** T5: minors stuck behind an expired guardian invite. A count only, by design. */
export interface ConsentOverdue {
  count: number;
  hours: number;
}

export interface TrafficSummary {
  since: string; // "YYYY-MM-DD", inclusive
  until: string; // "YYYY-MM-DD", inclusive (today, UTC)
  total: number;
  rows: RouteHitRead[]; // one per (day, route, method); day desc, then count desc
}
