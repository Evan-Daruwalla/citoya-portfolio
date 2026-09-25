"use client";

import { TriangleAlert } from "lucide-react";
import { useState } from "react";

import { ApiError, api } from "@/lib/api";
import { TOKEN_KEY, useAuth } from "@/lib/auth-context";

/** Shown to a signed-in student who isn't yet consent-cleared (pending/declined/
 *  revoked). Lets them resend the guardian email and re-check their status. */
export function ConsentBanner() {
  const { user, refresh } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user || user.role !== "student") return null;
  const status = user.guardian_consent_status;
  if (status === "not_required" || status === "verified") return null;

  async function resend() {
    setBusy(true);
    setMessage(null);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await api.requestConsent(token ?? "");
      setMessage(res.message);
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
        You can browse opportunities, but you can&apos;t sign up until a parent or guardian approves
        your account.
        {/* The spam line (pre-mortem 2026-09-22, T5): a new domain sending "approve your
            student's account" with a link looks like phishing, and a spam-foldered
            invite is invisible to us. The family is the only one who can look. */}
        {status === "pending"
          ? " We emailed them a link. If it hasn't arrived, ask them to check their spam or junk folder."
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
