"use client";

import { TriangleAlert } from "lucide-react";
import { useState } from "react";

import { ApiError, api } from "@/lib/api";
import { TOKEN_KEY, useAuth } from "@/lib/auth-context";
import { CONSENT_GATED_COPY, INVITE_COPY, consentGated, inviteState } from "@/lib/consent";

/** Shown to a signed-in student who isn't yet consent-cleared (pending/declined/
 *  revoked). Lets them resend the guardian email and re-check their status. */
export function ConsentBanner() {
  const { user, refresh } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The backend's rule (live age from dob), not the stored status alone: a pending
  // student who has turned 18 is not gated, so is not told to wait.
  if (!user || !consentGated(user)) return null;
  const status = user.guardian_consent_status;

  async function resend() {
    setBusy(true);
    setMessage(null);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await api.requestConsent(token ?? "");
      setMessage(res.message);
      // The resend's outcome is now on the user; refresh so the line above stops saying
      // it failed once it has gone out.
      await refresh();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Couldn't resend the email.");
    } finally {
      setBusy(false);
    }
  }

  const heading =
    status === "pending"
      ? "Waiting on your parent/guardian's approval"
      : status === "declined"
        ? "Your parent/guardian declined approval"
        : "Your parent/guardian's approval was revoked";

  // v1 editorial styling (.consent-zone), not shadcn/Tailwind: this renders inside
  // the .v1 dashboard shell, where a generic amber utility box reads as foreign.
  const btn = { padding: "9px 18px", fontSize: ".83rem" } as const;
  return (
    <div className="consent-zone">
      <h4>
        <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
        {heading}
      </h4>
      <p>
        {CONSENT_GATED_COPY}
        {/* The spam line (pre-mortem 2026-09-22, T5): a new domain sending "approve your
            student's account" with a link looks like phishing, and a spam-foldered
            invite is invisible to us. The family is the only one who can look. */}
        {/* Only a SENT invite may claim an email (record AU's open item, 2026-09-27). */}
        {status === "pending"
          ? INVITE_COPY[inviteState(user)].banner
          : " Contact support if this was a mistake."}
      </p>
      {status === "pending" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button className="btn-p" style={btn} onClick={resend} disabled={busy}>
            {busy ? "Sending…" : "Resend approval email"}
          </button>
          <button className="btn-s" style={btn} onClick={refresh}>
            I&apos;ve been approved. Refresh
          </button>
        </div>
      )}
      {message && <p style={{ marginTop: 10, marginBottom: 0 }}>{message}</p>}
    </div>
  );
}
