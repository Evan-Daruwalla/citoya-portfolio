// Routes that render their own exact-v1 chrome (V1Shell = v1 nav + footer).
// The global SiteHeader/SiteFooter suppress themselves on these so there's no
// double nav. Add a route here the moment its page is converted to v1.
export const V1_ROUTES = ["/", "/discover", "/dashboard", "/applicants", "/leaderboard", "/login", "/register", "/welcome", "/forgot", "/reset", "/pricing", "/for-organizations", "/donate", "/privacy", "/terms", "/portfolio", "/admin"];

export function isV1Route(pathname: string): boolean {
  if (V1_ROUTES.includes(pathname)) return true;
  // Opportunity detail is dynamic (/opportunities/<id>) — v1-converted — but the
  // create form (/opportunities/new) is not yet, so exclude it.
  if (/^\/opportunities\/[^/]+$/.test(pathname) && pathname !== "/opportunities/new") return true;
  // Public portfolio transcript by id (/portfolio/<id>) — v1-converted.
  if (/^\/portfolio\/[^/]+$/.test(pathname)) return true;
  return false;
}
