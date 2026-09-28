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
    banner: " We emailed them a link. If it hasn't arrived, ask them to check their spam or junk folder.",
    welcome:
      "We emailed your parent or guardian to approve your account. You can look around now. Signing up for opportunities unlocks once they approve.",
  },
  failed: {
    banner: " We couldn't send them the approval email yet. Press Resend to try again.",
    welcome:
      "We couldn't email your parent or guardian yet. Open your dashboard and press Resend approval email. You can look around now; signing up unlocks once they approve.",
  },
  unknown: {
    banner: " If they haven't received an approval email, ask them to check their spam folder, or press Resend.",
    welcome:
      "Your parent or guardian needs to approve your account. You can look around now. Signing up for opportunities unlocks once they approve.",
  },
};
