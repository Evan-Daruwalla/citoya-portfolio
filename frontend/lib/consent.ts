import type { User } from "./types";

/** The consent banner's sentence, reused where a gated control is withheld. */
export const CONSENT_GATED_COPY =
  "You can browse opportunities, but you can't sign up until a parent or guardian approves your account.";

/**
 * The backend's `consent_blocks`, mirrored so the UI never offers a write the gate
 * refuses (K3 + F12, audit 2026-09-24). Same boundaries: 18 TODAY (UTC) is ungated,
 * no dob is gated. `tests/test_frontend_consent_gate.py` checks it against the backend.
 */
export function consentGated(
  user: Pick<User, "role" | "dob" | "guardian_consent_status"> | null,
): boolean {
  if (!user || user.role !== "student") return false;
  if (!user.dob) return true;
  const today = new Date().toISOString().slice(0, 10);
  let age = Number(today.slice(0, 4)) - Number(user.dob.slice(0, 4));
  if (today.slice(5) < user.dob.slice(5, 10)) age -= 1;
  if (age >= 18) return false;
  return user.guardian_consent_status !== "verified";
}
