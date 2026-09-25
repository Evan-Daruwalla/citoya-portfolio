/**
 * Turn FastAPI's `detail` into something a human should read.
 *
 * Three shapes reach the client and only one is a plain string:
 *  - `string` — most HTTPExceptions.
 *  - `{code, message}` — the guardian-consent gate (`deps.py` require_consent) and
 *    the expired-consent-token error. This is the M5 launch gate's user-facing
 *    error, and it was being `JSON.stringify`d, so a gated 13-year-old tapping
 *    Apply saw `{"code":"GUARDIAN_CONSENT_REQUIRED","message":"…"}` (audit
 *    2026-08-06).
 *  - `[{msg, loc, …}]` — pydantic 422s, which no client-side field length prevents.
 *
 * Falls back to JSON only when there is genuinely nothing readable, so a new
 * server error shape degrades to noisy rather than to silence.
 *
 * Lives in its own dependency-free module so it can be compiled and executed
 * directly — the frontend has no test runner, and this is the error text every
 * gated minor reads.
 */
export function humanizeDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) =>
        d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : null,
      )
      .filter((m): m is string => !!m);
    if (msgs.length) return msgs.join(". ");
  }
  if (detail && typeof detail === "object" && "message" in detail) {
    const m = (detail as { message: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return JSON.stringify(detail);
}
