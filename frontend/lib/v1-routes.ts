import { LEADERBOARD_ENABLED } from "@/lib/flags";
import type { User } from "@/lib/types";

// Routes that render their own exact-v1 chrome (V1Shell = v1 nav + footer).
// The global SiteHeader/SiteFooter suppress themselves on these so there's no
// double nav. Add a route here the moment its page is converted to v1.
export const V1_ROUTES = ["/", "/discover", "/dashboard", "/applicants", "/leaderboard", "/login", "/register", "/welcome", "/forgot", "/reset", "/pricing", "/for-organizations", "/donate", "/privacy", "/terms", "/portfolio", "/admin", "/hours/report", "/security", "/logout"];

// Each account's home: admin -> /admin, org -> /applicants, student -> /dashboard, signed out
// -> /login. Shared by the login redirect, the nav's Dashboard link, /security's "Back to
// dashboard" and /logout's Cancel so they never point at different places.
export function dashboardPath(user: Pick<User, "role" | "is_admin"> | null | undefined): string {
  if (user?.is_admin) return "/admin";
  return user?.role === "org" ? "/applicants" : user?.role === "student" ? "/dashboard" : "/login";
}

export function isV1Route(pathname: string): boolean {
  // Hidden since 2026-10-25: /leaderboard is a 404, and the not-found page relies on the global
  // SiteHeader/SiteFooter, which suppress themselves on v1 routes (it showed with no nav).
  if (pathname === "/leaderboard" && !LEADERBOARD_ENABLED) return false;
  if (V1_ROUTES.includes(pathname)) return true;
  // Opportunity detail is dynamic (/opportunities/<id>) — v1-converted — but the
  // create form (/opportunities/new) is not yet, so exclude it.
  if (/^\/opportunities\/[^/]+$/.test(pathname) && pathname !== "/opportunities/new") return true;
  // Public portfolio transcript by id (/portfolio/<id>) — v1-converted.
  if (/^\/portfolio\/[^/]+$/.test(pathname)) return true;
  // Public organization page (/organizations/<id>) wraps itself in V1Shell.
  if (/^\/organizations\/[^/]+$/.test(pathname)) return true;
  return false;
}
