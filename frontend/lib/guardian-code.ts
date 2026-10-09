/**
 * The guardian manage page's step-up code input (K4, 2026-09-27).
 *
 * The emailed code is 43 URL-safe characters on a "Confirmation code: <code>" line, with no
 * link, so a parent copies it by hand. Whatever they paste (the code, the whole line, or the
 * code wrapped by a mail client) must become the exact code the backend hashes. The code's
 * alphabet has no ":" or whitespace, so dropping the label and every whitespace character
 * cannot change a real code. `backend/tests/test_frontend_guardian_code.py` feeds this the
 * real email and spends the result against the real export route.
 */
export function cleanCode(raw: string): string {
  return raw.replace(/confirmation\s*code\s*:/i, "").replace(/\s+/g, "");
}

/** The delete button's gate: a code, and DELETE typed exactly (as on the dashboard). */
export function canDelete(code: string, typed: string): boolean {
  return cleanCode(code) !== "" && typed === "DELETE";
}
