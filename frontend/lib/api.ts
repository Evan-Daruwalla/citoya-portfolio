/**
 * Thin typed fetch wrapper for the FastAPI backend (see ../backend/app/api/routes).
 * `request()` handles the base URL, bearer token, JSON body, 204s, and unwraps the
 * backend's `{detail}` error into an `ApiError(status, message)`. The `api` object
 * below is one method per endpoint, grouped by domain (banners: `── Domain ──`) in
 * roughly the same order as the route modules.
 */
import { humanizeDetail } from "@/lib/humanize-detail";
import type {
  AdminOrg,
  Application,
  ApplicationWithOpportunity,
  ConsentContext,
  ConsentOverdue,
  ConsentManageContext,
  Hours,
  HoursWithOpportunity,
  LeaderboardEntry,
  Message,
  MyAwards,
  Notification,
  Opportunity,
  OpportunityCreateInput,
  OpportunityTemplate,
  OrgReviews,
  PublicPortfolio,
  Review,
  OrgAnalytics,
  OrgReviewStatus,
  Token,
  TrafficSummary,
  User,
} from "@/lib/types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

// The localStorage key the JWT is stored under. Defined HERE (not in
// auth-context) so the 401 interceptor below can clear it without importing
// auth-context — which imports this module and would form a cycle. auth-context
// re-exports it, so every existing `import { TOKEN_KEY } from "@/lib/auth-context"`
// still resolves.
export const TOKEN_KEY = "citoya_token";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;
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
    if (res.status === 401 && token && typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
    }
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // response wasn't JSON — fall back to statusText
    }
    throw new ApiError(res.status, humanizeDetail(detail));
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

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

  login: (input: { email: string; password: string }) =>
    request<Token>("/auth/login", { method: "POST", body: JSON.stringify(input) }),

  me: (token: string) => request<User>("/auth/me", { token }),
  // Server-side logout: invalidates the token (bumps token_version). Best-effort
  // from the client — auth-context clears localStorage regardless of the result.
  logout: (token: string) => request<void>("/auth/logout", { method: "POST", token }),
  updateMe: (token: string, input: { email_notifications?: boolean; portfolio_public?: boolean }) =>
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

  // ── Opportunities & applications ──
  listOpportunities: (params: { category?: string; query?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.category) qs.set("category", params.category);
    if (params.query) qs.set("query", params.query);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<Opportunity[]>(`/opportunities${suffix}`);
  },

  // The token is OPTIONAL and the route stays public — a shared listing link must
  // render for a signed-out visitor. But the backend BRANCHES on the caller, and
  // until 2026-09-20 this call sent no Authorization header at all, so both
  // branches were dead in the browser: M14.2's "don't count the owning org's own
  // views" (opportunities.py) never fired in production, and M15.1's owner
  // exception would have shipped broken. `test_org_analytics.py` passed throughout
  // because TestClient sends a header the app never sent.
  getOpportunity: (id: string, token?: string) =>
    request<Opportunity>(`/opportunities/${id}`, token ? { token } : {}),

  // Org's OWN listings incl. inactive/expired (the public list hides those).
  myOpportunities: (token: string) => request<Opportunity[]>("/opportunities/mine", { token }),

  createOpportunity: (input: OpportunityCreateInput, token: string) =>
    request<Opportunity>("/opportunities", { method: "POST", body: JSON.stringify(input), token }),

  apply: (
    opportunityId: string,
    token: string,
    body?: { subscription_type: "all_dates" | "single_date"; single_date?: string }
  ) =>
    request<Application>(`/opportunities/${opportunityId}/apply`, {
      method: "POST",
      token,
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),

  withdraw: (opportunityId: string, token: string) =>
    request<void>(`/opportunities/${opportunityId}/apply`, { method: "DELETE", token }),

  excludeDate: (opportunityId: string, date: string, action: "exclude" | "include", token: string) =>
    request<Application>(`/opportunities/${opportunityId}/exclude-date`, {
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
      `/opportunities/${opportunityId}/date-spots`,
      token ? { token } : {},
    ),

  myApplications: (token: string) =>
    request<ApplicationWithOpportunity[]>("/applications/my", { token }),

  orgApplications: (token: string) =>
    request<ApplicationWithOpportunity[]>("/applications/org", { token }),

  decideApplication: (applicationId: string, action: "approve" | "reject", token: string) =>
    request<ApplicationWithOpportunity>(`/applications/${applicationId}`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
      token,
    }),

  // ── Hours & check-in ──
  autoLogHours: (token: string) => request<{ created: number }>("/hours/auto-log", { method: "POST", token }),

  listHours: (token: string) => request<HoursWithOpportunity[]>("/hours", { token }),

  verifyHours: (hoursId: string, action: "approve" | "deny", token: string, note?: string) =>
    request<HoursWithOpportunity>(`/hours/${hoursId}/verify`, {
      method: "PATCH",
      body: JSON.stringify({ action, note }),
      token,
    }),

  selfReportHours: (input: { opportunity_id: string; hours: number; note?: string }, token: string) =>
    request<HoursWithOpportunity>("/hours", { method: "POST", body: JSON.stringify(input), token }),

  appealHours: (hoursId: string, note: string, token: string) =>
    request<HoursWithOpportunity>(`/hours/${hoursId}/appeal`, {
      method: "POST",
      body: JSON.stringify({ note }),
      token,
    }),

  createCheckinCode: (opportunityId: string, date: string, token: string) =>
    request<{ date: string; code: string }>(`/opportunities/${opportunityId}/checkin-codes`, {
      method: "POST",
      body: JSON.stringify({ date }),
      token,
    }),

  redeemCheckin: (opportunityId: string, code: string, token: string) =>
    request<Hours>(`/opportunities/${opportunityId}/checkin`, {
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
    request<void>(`/saved/${opportunityId}`, { method: "PUT", token }),
  unsave: (opportunityId: string, token: string) =>
    request<void>(`/saved/${opportunityId}`, { method: "DELETE", token }),

  // ── Community (leaderboard + public portfolio) ──
  leaderboard: () => request<LeaderboardEntry[]>("/leaderboard"),

  // Public verified-service transcript (only for students who opted in; else 404).
  publicPortfolio: (userId: string) => request<PublicPortfolio>(`/portfolio/${userId}`),

  // ── Reviews ──
  // The token is optional: the listing is public, and with one it marks the caller's own review.
  orgReviews: (orgId: string, token?: string) =>
    request<OrgReviews>(`/orgs/${orgId}/reviews`, { token }),
  deleteReview: (orgId: string, reviewId: string, token: string) =>
    request<void>(`/orgs/${orgId}/reviews/${reviewId}`, { method: "DELETE", token }),
  createReview: (orgId: string, input: { rating: number; text: string }, token: string) =>
    request<Review>(`/orgs/${orgId}/reviews`, { method: "POST", body: JSON.stringify(input), token }),

  // ── Notifications ──
  notifications: (token: string) => request<Notification[]>("/notifications", { token }),
  unreadCount: (token: string) => request<{ unread: number }>("/notifications/unread-count", { token }),
  // Exchanges the access token for a 30s ticket that opens the SSE stream.
  // EventSource cannot send an Authorization header and the access token must
  // never appear in a URL, so the stream gets its own short-lived credential.
  streamTicket: (token: string) =>
    request<{ ticket: string; expires_in: number }>("/events/ticket", { method: "POST", token }),
  markNotificationRead: (id: string, token: string) =>
    request<Notification>(`/notifications/${id}/read`, { method: "PATCH", token }),
  markAllNotificationsRead: (token: string) =>
    request<{ unread: number }>("/notifications/read-all", { method: "POST", token }),

  // ── Messaging (per-opportunity threads) ──
  messages: (opportunityId: string, token: string) =>
    request<Message[]>(`/opportunities/${opportunityId}/messages`, { token }),
  postMessage: (opportunityId: string, body: string, token: string) =>
    request<Message>(`/opportunities/${opportunityId}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
      token,
    }),
  // An applicant's private message to the org (2026-09-22) — the thread is org-only.
  messageOrg: (opportunityId: string, body: string, token: string) =>
    request<Message>(`/opportunities/${opportunityId}/messages/to-org`, {
      method: "POST",
      body: JSON.stringify({ body }),
      token,
    }),

  // ── Directed messaging (M7): inbox, reply, org→applicant broadcast ──
  inbox: (token: string) => request<Message[]>("/messages", { token }),
  replyMessage: (id: string, body: string, token: string) =>
    request<Message>(`/messages/${id}/reply`, { method: "POST", body: JSON.stringify({ body }), token }),
  broadcast: (
    opportunityId: string,
    body: string,
    audience: "all" | "approved" | "pending",
    token: string
  ) =>
    request<{ sent: number }>(`/opportunities/${opportunityId}/messages/broadcast`, {
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

  // ── Billing (M8) ──
  createCheckout: (token: string) =>
    request<{ url: string }>("/billing/checkout", { method: "POST", token }),
  setFeatured: (opportunityId: string, featured: boolean, token: string) =>
    request<Opportunity>(`/opportunities/${opportunityId}/featured`, {
      method: "PATCH",
      body: JSON.stringify({ featured }),
      token,
    }),
  setActive: (opportunityId: string, active: boolean, token: string) =>
    request<Opportunity>(`/opportunities/${opportunityId}/active`, {
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
    request<AdminOrg>(`/admin/orgs/${orgId}/approve`, { method: "POST", token }),
  rejectOrg: (orgId: string, token: string) =>
    request<AdminOrg>(`/admin/orgs/${orgId}/reject`, { method: "POST", token }),
  consentOverdue: (token: string) => request<ConsentOverdue>("/admin/consent/overdue", { token }),
};
