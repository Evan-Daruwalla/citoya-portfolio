import type { User } from "./types";

/**
 * Whether the backend will let this viewer read a listing's message thread, so the page
 * fetches it only when the fetch can succeed (2026-09-26, record BV). Before this, every
 * signed-in viewer fetched and the 403 hid the section, which left a refused request in
 * the console for any student who never applied and for every other org.
 *
 * Mirrors `_load_opp_with_access` in backend/app/api/routes/messages.py: the owning org,
 * or a student whose application to THIS listing is approved. Anything else is refused
 * there. `tests/test_frontend_thread_access.py` checks it against that rule.
 */
export function canReadThread(
  user: Pick<User, "id" | "role"> | null | undefined,
  orgId: string,
  opportunityId: string,
  apps: { opportunity_id: string; status: string }[] | null | undefined,
): boolean {
  if (!user) return false;
  if (user.role === "org") return user.id === orgId;
  if (user.role !== "student" || !apps) return false;
  return apps.some((a) => a.opportunity_id === opportunityId && a.status === "approved");
}
