/**
 * The deadline from a login refused because the account is inside its 48-hour
 * deletion window (2026-09-26), or null for any other refusal.
 *
 * The backend answers 409 with `{code: "ACCOUNT_PENDING_DELETION", message,
 * delete_after}`, where `delete_after` carries its zone (`+00:00`): a zone-less string
 * would be read as local time. `backend/tests/test_frontend_pending_deletion.py` feeds
 * this the real 409 body, so a change on either side fails there.
 */
export function pendingDeletionDeadline(detail: unknown): Date | null {
  if (!detail || typeof detail !== "object") return null;
  const d = detail as { code?: unknown; delete_after?: unknown };
  if (d.code !== "ACCOUNT_PENDING_DELETION" || typeof d.delete_after !== "string") return null;
  const when = new Date(d.delete_after);
  return Number.isNaN(when.getTime()) ? null : when;
}
