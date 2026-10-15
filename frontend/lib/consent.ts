import type { User } from "./types";

/** The consent banner's sentence, reused where a gated control is withheld. */
export const CONSENT_GATED_COPY =
  "You can browse opportunities, but you cannot sign up until a parent or guardian approves your account.";

/**
 * Whole years old on `today`'s UTC date, from a "YYYY-MM-DD" dob (audit DY Low 39,
 * 2026-10-07). Extracted from `consentGated` unchanged so the register form's age uses
 * the same UTC rule as the server's gate, not the browser's local date.
 */
export function ageFromDobUtc(dob: string, today: Date = new Date()): number {
  const day = today.toISOString().slice(0, 10);
  let age = Number(day.slice(0, 4)) - Number(dob.slice(0, 4));
  if (day.slice(5) < dob.slice(5, 10)) age -= 1;
  return age;
}

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
  if (ageFromDobUtc(user.dob) >= 18) return false;
  return user.guardian_consent_status !== "verified";
}

/**
 * Whether the latest guardian invite went out (`guardian_invite_sent` on /auth/me). The
 * welcome page and the consent banner said "We emailed" from fixed text, even after a
 * failed send (record AU's open item, fixed 2026-09-27). Only "sent" may claim an email.
 * `tests/test_frontend_consent_gate.py` pins the three states and their copy.
 */
export type InviteState = "sent" | "failed" | "unknown";

export function inviteState(user: Pick<User, "guardian_invite_sent">): InviteState {
  if (user.guardian_invite_sent === true) return "sent";
  if (user.guardian_invite_sent === false) return "failed";
  return "unknown";
}

export const INVITE_COPY: Record<InviteState, { banner: string; welcome: string }> = {
  sent: {
    banner: " We emailed them a link. If it has not arrived, ask them to check their spam or junk folder.",
    welcome:
      "We emailed your parent or guardian to approve your account. You can look around now. Signing up for opportunities unlocks once they approve.",
  },
  failed: {
    banner: " We could not send them the approval email yet. Press Resend to try again.",
    welcome:
      "We could not email your parent or guardian yet. Open your dashboard and press Resend approval email. You can look around now; signing up unlocks once they approve.",
  },
  unknown: {
    banner: " If they have not received an approval email, ask them to check their spam folder, or press Resend.",
    welcome:
      "Your parent or guardian needs to approve your account. You can look around now. Signing up for opportunities unlocks once they approve.",
  },
};
