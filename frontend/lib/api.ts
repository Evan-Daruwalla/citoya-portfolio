/**
 * Thin typed fetch wrapper for the FastAPI backend (see ../backend/app/api/routes).
 * `request()` handles the base URL, bearer token, JSON body, 204s, and unwraps the
 * backend's `{detail}` error into an `ApiError(status, message)`. The `api` object
 * below is one method per endpoint, grouped by domain (banners: `── Domain ──`) in
 * roughly the same order as the route modules.
 */
import { humanizeDetail } from "@/lib/humanize-detail";
import { collectPages } from "@/lib/paging";
import type {
  AdminOrg,
  Application,
  ApplicationWithOpportunity,
  AuditLogEntry,
  CalendarItem,
  ConsentContext,
  ConsentOverdue,
  ConsentManageContext,
  Endorsement,
  Goal,
  Hours,
  HoursBulkVerifyResponse,
  HoursWithOpportunity,
  LeaderboardEntry,
  Message,
  MfaChallenge,
  MyAwards,
  MyGoals,
  Notification,
  Opportunity,
  OpportunityCreateInput,
  OpportunityTemplate,
  OpportunityUpdateInput,
  OrgReviews,
  PublicOrg,
  PersonalEventInput,
  PublicPortfolio,
  PublicStats,
  RecoveryCodes,
  Review,
  OrgAnalytics,
  OrgReviewStatus,
  Token,
  TrafficSummary,
  TwoFactorEnabled,
  TwoFactorSetup,
  User,
} from "@/lib/types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

// The localStorage key the JWT is stored under. Defined HERE (not in
// auth-context) so the 401 interceptor below can clear it without importing
// auth-context — which imports this module and would form a cycle. auth-context
// re-exports it, so every existing `import { TOKEN_KEY } from "@/lib/auth-context"`
// still resolves.
export const TOKEN_KEY = "citoya_token";

// Dispatched on `window` when the server rejects the stored token (401), so auth-context
// can drop its in-memory user too: clearing localStorage alone left the UI signed in
// until a reload (audit DY Med 17, 2026-10-05).
export const SESSION_EXPIRED_EVENT = "citoya:session-expired";

// Dispatched on `window` when the server answers 403 MFA_ENROLLMENT_REQUIRED (an admin or
// org account with two-factor still off), so auth-context can send the user to /security
// (2FA build, 2026-10-13). A listener, not an import, for the same cycle reason as above.
export const MFA_ENROLLMENT_REQUIRED_EVENT = "citoya:mfa-enrollment-required";

export class ApiError extends Error {
  status: number;
  /** The backend's raw `detail`, before `humanizeDetail` turns it into a sentence. */
  detail: unknown;
  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string; keepSessionOn401?: boolean } = {}
): Promise<T> {
  const { token, keepSessionOn401, headers, ...rest } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    // A rejected token must never linger. If we attached a token and the server
    // rejected it (401 — expired, or invalidated by a logout/reset elsewhere),
    // drop it so the app hydrates logged-out instead of a confusing half-signed-in
    // state. Tokenless 401s (e.g. a failed login) attach no token and clear nothing.
    // `keepSessionOn401` (2FA build, 2026-10-13): the two-factor calls answer 401 "Invalid code"
    // for a wrong code from a signed-in user whose token is fine; dropping the token there
    // signed them out on a typo.
    if (res.status === 401 && token && !keepSessionOn401 && typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // response wasn't JSON — fall back to statusText
    }
    if (
      res.status === 403 &&
      typeof window !== "undefined" &&
      detail !== null &&
      typeof detail === "object" &&
      (detail as { code?: unknown }).code === "MFA_ENROLLMENT_REQUIRED"
    ) {
      window.dispatchEvent(new Event(MFA_ENROLLMENT_REQUIRED_EVENT));
    }
    throw new ApiError(res.status, humanizeDetail(detail), detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// audit DY Low 35, 2026-10-07: every dynamic path segment below goes through
// encodeURIComponent, so a value holding "/", "?" or "#" cannot rewrite the path.
export const api = {
  // ── Auth & account ──
  register: (input: {
    email: string;
    password: string;
    full_name?: string;
    role?: string;
    dob?: string;
    guardian_name?: string;
    guardian_email?: string;
    turnstile_token?: string;
    accepted_terms?: boolean;
  }) => request<User>("/auth/register", { method: "POST", body: JSON.stringify(input) }),

  // `restore` answers the "Restore it?" prompt for an account inside its 48-hour
  // deletion window (2026-09-26); the backend ignores it on any other account.
  // With two-factor on, a right password answers an MfaChallenge instead of a Token; the
  // code step is `loginMfa` (2FA build, 2026-10-13).
  login: (input: { email: string; password: string; restore?: boolean }) =>
    request<Token | MfaChallenge>("/auth/login", { method: "POST", body: JSON.stringify(input) }),
  loginMfa: (input: { mfa_token: string; code: string; restore?: boolean }) =>
    request<Token>("/auth/login/mfa", { method: "POST", body: JSON.stringify(input) }),

  // Two-factor management (all signed in). Enable/disable answer a NEW token because they
  // bump token_version; the caller must store it (auth-context `adoptToken`).
  twoFactorSetup: (token: string) =>
    request<TwoFactorSetup>("/auth/2fa/setup", { method: "POST", token }),
  twoFactorEnable: (token: string, code: string) =>
    request<TwoFactorEnabled>("/auth/2fa/enable", {
      method: "POST",
      body: JSON.stringify({ code }),
      token,
      keepSessionOn401: true,
    }),
  twoFactorDisable: (token: string, password: string, code: string) =>
    request<{ access_token: string }>("/auth/2fa/disable", {
      method: "POST",
      body: JSON.stringify({ password, code }),
      token,
      keepSessionOn401: true,
    }),
  // A wrong current password is a 403 (not 401), so no keepSessionOn401. Answers a NEW token.
  changePassword: (token: string, current_password: string, new_password: string) =>
    request<{ access_token: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
      token,
    }),
  twoFactorRecoveryCodes: (token: string, code: string) =>
    request<RecoveryCodes>("/auth/2fa/recovery-codes", {
      method: "POST",
      body: JSON.stringify({ code }),
      token,
      keepSessionOn401: true,
    }),

  me: (token: string) => request<User>("/auth/me", { token }),
  // Server-side logout: invalidates the token (bumps token_version). Best-effort
  // from the client — auth-context clears localStorage regardless of the result.
  logout: (token: string) => request<void>("/auth/logout", { method: "POST", token }),
  updateMe: (
    token: string,
    input: { email_notifications?: boolean; portfolio_public?: boolean; public_name_visible?: boolean },
  ) =>
    request<User>("/auth/me", { method: "PATCH", body: JSON.stringify(input), token }),

  // Data export + account deletion (M13.3)
  exportMe: (token: string) => request<Record<string, unknown>>("/auth/me/export", { token }),
  deleteMe: (password: string, token: string) =>
    request<void>("/auth/me", { method: "DELETE", body: JSON.stringify({ password }), token }),

  // Password reset (M4)
  forgotPassword: (email: string, turnstile_token?: string) =>
    request<{ message: string }>("/auth/forgot", {
      method: "POST",
      body: JSON.stringify({ email, turnstile_token }),
    }),
  resetPassword: (token: string, new_password: string) =>
    request<{ message: string }>("/auth/reset", {
      method: "POST",
      body: JSON.stringify({ token, new_password }),
    }),

  // Guardian consent (M5)
  requestConsent: (token: string) =>
    request<{ message: string }>("/consent/request", { method: "POST", token }),
  // The approve token travels in the same header as the manage token below, for
  // the same reason: as a path segment it reached every access log, and it is the
  // token that grants consent (2026-09-23, AO H1).
  consentContext: (linkToken: string) =>
    request<ConsentContext>(`/consent/decide`, {
      headers: { "X-Guardian-Token": linkToken },
    }),
  decideConsent: (linkToken: string, decision: "approve" | "decline") =>
    request<{ message: string }>(`/consent/decide`, {
      method: "POST",
      headers: { "X-Guardian-Token": linkToken },
      body: JSON.stringify({ decision }),
    }),
  // The guardian manage token travels in a HEADER, never the URL. It is
  // PERMANENT by design (a parent must be able to revoke years later), so a path
  // segment would have written a non-expiring credential into every access log,
  // proxy log and browser history entry. The emailed link carries it in the URL
  // FRAGMENT, which browsers never transmit; the page reads it and forwards it
  // here (2026-09-20, Appendix R H4 sibling).
  manageContext: (linkToken: string) =>
    request<ConsentManageContext>(`/consent/manage`, {
      headers: { "X-Guardian-Token": linkToken },
    }),
  revokeConsent: (linkToken: string) =>
    request<{ message: string }>(`/consent/manage`, {
      method: "POST",
      headers: { "X-Guardian-Token": linkToken },
      body: JSON.stringify({ action: "revoke" }),
    }),
  // Export and delete need a single-use code emailed to the guardian (Appendix R H4); the
  // code rides in its own header, never the URL, like the token (K4, 2026-09-27).
  guardianStepUp: (linkToken: string, action: "export" | "delete") =>
    request<{ message: string }>(`/consent/manage/step-up?action=${action}`, {
      method: "POST",
      headers: { "X-Guardian-Token": linkToken },
    }),
  guardianExport: (linkToken: string, code: string) =>
    request<Record<string, unknown>>(`/consent/manage/export`, {
      headers: { "X-Guardian-Token": linkToken, "X-Guardian-Confirm": code },
    }),
  guardianDelete: (linkToken: string, code: string) =>
    request<{ message: string }>(`/consent/manage/delete`, {
      method: "POST",
      headers: { "X-Guardian-Token": linkToken, "X-Guardian-Confirm": code },
    }),

  // ── Opportunities & applications ──
  // Every discoverable listing. The list endpoint caps a call at 200 rows (60 by
  // default), so one call silently drops the rest (audit DY Med 15, 2026-10-05).
  listAllOpportunities: (params: { category?: string; query?: string; org_id?: string } = {}) =>
    collectPages((limit, offset) => {
      const qs = new URLSearchParams();
      if (params.category) qs.set("category", params.category);
      if (params.query) qs.set("query", params.query);
      if (params.org_id) qs.set("org_id", params.org_id);
      qs.set("limit", String(limit));
      qs.set("offset", String(offset));
      return request<Opportunity[]>(`/opportunities?${qs.toString()}`);
    }),

  // Public counts for the home tile, the leaderboard band and the admin tiles.
  stats: () => request<PublicStats>("/stats"),

  // The token is OPTIONAL and the route stays public — a shared listing link must
  // render for a signed-out visitor. But the backend BRANCHES on the caller, and
  // until 2026-09-20 this call sent no Authorization header at all, so both
  // branches were dead in the browser: M14.2's "don't count the owning org's own
  // views" (opportunities.py) never fired in production, and M15.1's owner
  // exception would have shipped broken. `test_org_analytics.py` passed throughout
  // because TestClient sends a header the app never sent.
  getOpportunity: (id: string, token?: string) =>
    request<Opportunity>(`/opportunities/${encodeURIComponent(id)}`, token ? { token } : {}),

  // Org's OWN listings incl. inactive/expired (the public list hides those).
  myOpportunities: (token: string) => request<Opportunity[]>("/opportunities/mine", { token }),

  createOpportunity: (input: OpportunityCreateInput, token: string) =>
    request<Opportunity>("/opportunities", { method: "POST", body: JSON.stringify(input), token }),

  // Owner edit (decision 13A, 2026-10-09). Send only the fields that changed: the logistics
  // fields (times, zone, spots, location, ...) 409 while anyone is signed up, even when the
  // value sent equals the stored one.
  updateOpportunity: (id: string, patch: OpportunityUpdateInput, token: string) =>
    request<Opportunity>(`/opportunities/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
      token,
    }),

  apply: (
    opportunityId: string,
    token: string,
    body?: { subscription_type: "all_dates" | "single_date"; single_date?: string }
  ) =>
    request<Application>(`/opportunities/${encodeURIComponent(opportunityId)}/apply`, {
      method: "POST",
      token,
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),

  withdraw: (opportunityId: string, token: string) =>
    request<void>(`/opportunities/${encodeURIComponent(opportunityId)}/apply`, { method: "DELETE", token }),

  excludeDate: (opportunityId: string, date: string, action: "exclude" | "include", token: string) =>
    request<Application>(`/opportunities/${encodeURIComponent(opportunityId)}/exclude-date`, {
      method: "PATCH",
      body: JSON.stringify({ date, action }),
      token,
    }),

  // Optional token for the same reason getOpportunity takes one (M15.1): the route
  // is public, but the backend branches on the caller so the OWNING org can still
  // see the dates of a listing awaiting review. Both call sites must pass it
  // identically — they share one SWR key, and a key must mean one fetcher.
  dateSpots: (opportunityId: string, token?: string) =>
    request<Record<string, number>>(
      `/opportunities/${encodeURIComponent(opportunityId)}/date-spots`,
      token ? { token } : {},
    ),

  myApplications: (token: string) =>
    request<ApplicationWithOpportunity[]>("/applications/my", { token }),

  orgApplications: (token: string) =>
    collectPages((limit, offset) =>
      request<ApplicationWithOpportunity[]>(`/applications/org?limit=${limit}&offset=${offset}`, { token }),
    ),

  decideApplication: (applicationId: string, action: "approve" | "reject", token: string) =>
    request<ApplicationWithOpportunity>(`/applications/${encodeURIComponent(applicationId)}`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
      token,
    }),

  // ── Hours & check-in ──
  autoLogHours: (token: string) => request<{ created: number }>("/hours/auto-log", { method: "POST", token }),

  listHours: (token: string) =>
    collectPages((limit, offset) =>
      request<HoursWithOpportunity[]>(`/hours?limit=${limit}&offset=${offset}`, { token }),
    ),

  verifyHours: (hoursId: string, action: "approve" | "deny", token: string, note?: string) =>
    request<HoursWithOpportunity>(`/hours/${encodeURIComponent(hoursId)}/verify`, {
      method: "PATCH",
      body: JSON.stringify({ action, note }),
      token,
    }),

  verifyHoursBulk: (ids: string[], token: string) =>
    request<HoursBulkVerifyResponse>("/hours/verify-bulk", {
      method: "POST",
      body: JSON.stringify({ ids }),
      token,
    }),

  selfReportHours: (input: { opportunity_id: string; hours: number; note?: string }, token: string) =>
    request<HoursWithOpportunity>("/hours", { method: "POST", body: JSON.stringify(input), token }),

  // Volunteering outside Citoya (2026-09-27): no listing, always "unverified".
  logOffsiteHours: (
    input: { activity: string; occurrence_date: string; hours: number; note?: string; supervisor_name?: string },
    token: string,
  ) => request<HoursWithOpportunity>("/hours/offsite", { method: "POST", body: JSON.stringify(input), token }),

  // Every row, for the hours PDF (M16.2). `GET /hours` returns 100 by default and
  // at most 200 a page, so one call would silently cut a long history short; this
  // pages through `collectPages`.
  listAllHours: (token: string) =>
    collectPages((limit, offset) =>
      request<HoursWithOpportunity[]>(`/hours?limit=${limit}&offset=${offset}`, { token }),
    ),

  // ── Calendar (M16.4) ──
  // `end` is exclusive; the backend allows a window of up to 62 days.
  myCalendar: (start: string, end: string, token: string) =>
    request<CalendarItem[]>(`/calendar/mine?start=${start}&end=${end}`, { token }),
  createCalendarEvent: (input: PersonalEventInput, token: string) =>
    request<unknown>("/calendar/events", { method: "POST", body: JSON.stringify(input), token }),
  deleteCalendarEvent: (eventId: string, token: string) =>
    request<void>(`/calendar/events/${encodeURIComponent(eventId)}`, { method: "DELETE", token }),

  // The calendar feed (M16.5): the link is shown once, so these return the raw token
  // only from create. The URLs point at the API itself, which serves the .ics.
  calendarFeedStatus: (token: string) => request<{ active: boolean }>("/calendar/feed", { token }),
  createCalendarFeed: (token: string) => request<{ token: string }>("/calendar/feed", { method: "POST", token }),
  deleteCalendarFeed: (token: string) => request<void>("/calendar/feed", { method: "DELETE", token }),
  calendarFeedUrls: (feedToken: string) => {
    const https = `${API_URL}/calendar/feed/${encodeURIComponent(feedToken)}.ics`;
    const webcal = https.replace(/^https?:\/\//, "webcal://");
    return { https, webcal, google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` };
  },

  // ── Goals (M16.3) ──
  listGoals: (token: string) => request<MyGoals>("/goals", { token }),
  createGoal: (
    input: Pick<Goal, "title" | "target_hours" | "period" | "every" | "unit"> & { start_date?: string },
    token: string,
  ) => request<Goal>("/goals", { method: "POST", body: JSON.stringify(input), token }),
  deleteGoal: (goalId: string, token: string) => request<void>(`/goals/${encodeURIComponent(goalId)}`, { method: "DELETE", token }),
  reorderGoals: (ids: string[], token: string) =>
    request<Goal[]>("/goals/order", { method: "PUT", body: JSON.stringify({ ids }), token }),

  // Off-site entries only; the backend refuses a listing-backed row (403).
  deleteHours: (hoursId: string, token: string) =>
    request<void>(`/hours/${encodeURIComponent(hoursId)}`, { method: "DELETE", token }),

  appealHours: (hoursId: string, note: string, token: string) =>
    request<HoursWithOpportunity>(`/hours/${encodeURIComponent(hoursId)}/appeal`, {
      method: "POST",
      body: JSON.stringify({ note }),
      token,
    }),

  createCheckinCode: (opportunityId: string, date: string, token: string) =>
    request<{ date: string; code: string }>(`/opportunities/${encodeURIComponent(opportunityId)}/checkin-codes`, {
      method: "POST",
      body: JSON.stringify({ date }),
      token,
    }),

  redeemCheckin: (opportunityId: string, code: string, token: string) =>
    request<Hours>(`/opportunities/${encodeURIComponent(opportunityId)}/checkin`, {
      method: "POST",
      body: JSON.stringify({ code }),
      token,
    }),

  // ── Awards ──
  myAwards: (token: string) => request<MyAwards>("/awards/my", { token }),

  // ── Bookmarks ──
  listSaved: (token: string) => request<Opportunity[]>("/saved", { token }),
  listSavedIds: (token: string) => request<string[]>("/saved/ids", { token }),
  save: (opportunityId: string, token: string) =>
    request<void>(`/saved/${encodeURIComponent(opportunityId)}`, { method: "PUT", token }),
  unsave: (opportunityId: string, token: string) =>
    request<void>(`/saved/${encodeURIComponent(opportunityId)}`, { method: "DELETE", token }),

  // ── Community (leaderboard + public portfolio) ──
  leaderboard: () => request<LeaderboardEntry[]>("/leaderboard"),

  // Public verified-service transcript (only for students who opted in; else 404).
  publicPortfolio: (userId: string) => request<PublicPortfolio>(`/portfolio/${encodeURIComponent(userId)}`),

  // An organization's public page (PRD M17.1, 2026-10-06). The token is optional for
  // the reason reviews take one: the route is public, but the org itself and an admin
  // can see an unapproved page that everyone else gets a 404 for.
  publicOrg: (orgId: string, token?: string) =>
    request<PublicOrg>(`/orgs/${encodeURIComponent(orgId)}`, token ? { token } : {}),

  // ── Reviews ──
  // The token is optional: the listing is public, and with one it marks the caller's own review.
  orgReviews: (orgId: string, token?: string) =>
    request<OrgReviews>(`/orgs/${encodeURIComponent(orgId)}/reviews`, { token }),
  deleteReview: (orgId: string, reviewId: string, token: string) =>
    request<void>(`/orgs/${encodeURIComponent(orgId)}/reviews/${encodeURIComponent(reviewId)}`, { method: "DELETE", token }),
  updateReview: (orgId: string, reviewId: string, input: { rating?: number; text?: string }, token: string) =>
    request<Review>(`/orgs/${encodeURIComponent(orgId)}/reviews/${encodeURIComponent(reviewId)}`, { method: "PATCH", body: JSON.stringify(input), token }),
  createReview: (orgId: string, input: { rating: number; text: string }, token: string) =>
    request<Review>(`/orgs/${encodeURIComponent(orgId)}/reviews`, { method: "POST", body: JSON.stringify(input), token }),

  // ── Notifications ──
  notifications: (token: string) => request<Notification[]>("/notifications", { token }),
  unreadCount: (token: string) => request<{ unread: number }>("/notifications/unread-count", { token }),
  // Exchanges the access token for a 30s ticket that opens the SSE stream.
  // EventSource cannot send an Authorization header and the access token must
  // never appear in a URL, so the stream gets its own short-lived credential.
  streamTicket: (token: string) =>
    request<{ ticket: string; expires_in: number }>("/events/ticket", { method: "POST", token }),
  markNotificationRead: (id: string, token: string) =>
    request<Notification>(`/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH", token }),
  markAllNotificationsRead: (token: string) =>
    request<{ unread: number }>("/notifications/read-all", { method: "POST", token }),

  // ── Messaging (per-opportunity threads) ──
  messages: (opportunityId: string, token: string) =>
    request<Message[]>(`/opportunities/${encodeURIComponent(opportunityId)}/messages`, { token }),
  postMessage: (opportunityId: string, body: string, token: string) =>
    request<Message>(`/opportunities/${encodeURIComponent(opportunityId)}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
      token,
    }),
  // An applicant's private message to the org (2026-09-22) — the thread is org-only.
  messageOrg: (opportunityId: string, body: string, token: string) =>
    request<Message>(`/opportunities/${encodeURIComponent(opportunityId)}/messages/to-org`, {
      method: "POST",
      body: JSON.stringify({ body }),
      token,
    }),

  // ── Directed messaging (M7): inbox, reply, org→applicant broadcast ──
  inbox: (token: string) => request<Message[]>("/messages", { token }),
  replyMessage: (id: string, body: string, token: string) =>
    request<Message>(`/messages/${encodeURIComponent(id)}/reply`, { method: "POST", body: JSON.stringify({ body }), token }),
  broadcast: (
    opportunityId: string,
    body: string,
    audience: "all" | "approved" | "pending",
    token: string
  ) =>
    request<{ sent: number }>(`/opportunities/${encodeURIComponent(opportunityId)}/messages/broadcast`, {
      method: "POST",
      body: JSON.stringify({ body, audience }),
      token,
    }),

  // ── Shift templates (M7) ──
  templates: (token: string) => request<OpportunityTemplate[]>("/opportunity-templates", { token }),
  saveTemplate: (opportunity_id: string, name: string, token: string) =>
    request<OpportunityTemplate>("/opportunity-templates", {
      method: "POST",
      body: JSON.stringify({ opportunity_id, name }),
      token,
    }),

  deleteTemplate: (id: string, token: string) =>
    request<void>(`/opportunity-templates/${encodeURIComponent(id)}`, { method: "DELETE", token }),

  // ── Billing (M8) ──
  createCheckout: (token: string) =>
    request<{ url: string }>("/billing/checkout", { method: "POST", token }),
  setFeatured: (opportunityId: string, featured: boolean, token: string) =>
    request<Opportunity>(`/opportunities/${encodeURIComponent(opportunityId)}/featured`, {
      method: "PATCH",
      body: JSON.stringify({ featured }),
      token,
    }),
  setActive: (opportunityId: string, active: boolean, token: string) =>
    request<Opportunity>(`/opportunities/${encodeURIComponent(opportunityId)}/active`, {
      method: "PATCH",
      body: JSON.stringify({ active }),
      token,
    }),

  // ── Analytics (M14.1, admin-only) ──
  // 403s for a non-admin; the caller holds the key null until `is_admin`, so the
  // request is not merely rejected, it is never sent.
  // Org's own numbers. 403s for a student; the caller holds the key null until the
  // user is an org, so the request is never sent.
  orgAnalytics: (token: string) => request<OrgAnalytics>("/analytics/org", { token }),

  siteTraffic: (days: number, token: string) => {
    const qs = new URLSearchParams({ days: String(days) });
    return request<TrafficSummary>(`/analytics/traffic?${qs.toString()}`, { token });
  },

  // ── Organization review (M15.2, admin-only) ──
  adminOrgs: (status: OrgReviewStatus, token: string) =>
    request<AdminOrg[]>(`/admin/orgs?status=${status}`, { token }),
  approveOrg: (orgId: string, token: string) =>
    request<AdminOrg>(`/admin/orgs/${encodeURIComponent(orgId)}/approve`, { method: "POST", token }),
  rejectOrg: (orgId: string, token: string) =>
    request<AdminOrg>(`/admin/orgs/${encodeURIComponent(orgId)}/reject`, { method: "POST", token }),
  consentOverdue: (token: string) => request<ConsentOverdue>("/admin/consent/overdue", { token }),
  // Audit log screen and consent reopen (PRD possible feature #11, 2026-10-09).
  auditLog: (limit: number, offset: number, token: string) =>
    request<AuditLogEntry[]>(`/audit-log?limit=${limit}&offset=${offset}`, { token }),
  reopenConsent: (userId: string, token: string) =>
    request<{ message: string }>(`/consent/admin/${encodeURIComponent(userId)}/reopen`, { method: "POST", token }),

  // ── Skill endorsements (PRD M17.3, 2026-10-09) ──
  endorse: (studentId: string, skill: string, token: string) =>
    request<Endorsement>("/endorsements", {
      method: "POST",
      body: JSON.stringify({ student_id: studentId, skill }),
      token,
    }),
  myEndorsements: (token: string) => request<Endorsement[]>("/endorsements/mine", { token }),
  givenEndorsements: (token: string) => request<Endorsement[]>("/endorsements/given", { token }),
  deleteEndorsement: (id: string, token: string) =>
    request<void>(`/endorsements/${encodeURIComponent(id)}`, { method: "DELETE", token }),
};
