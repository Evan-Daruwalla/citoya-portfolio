"use client";

import { errorText } from "@/lib/errors";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { TurnstileWidget } from "@/components/turnstile-widget";
import { V1Shell } from "@/components/v1/v1-shell";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // audit DY Med 18, 2026-10-05: bumped on a failed submit to reset the spent token.
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.forgotPassword(email, turnstileToken ?? undefined);
      setMessage(res.message);
    } catch (err) {
      setError(errorText(err, "We could not send the reset email. Check your connection and try again."));
      setTurnstileReset((n) => n + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <V1Shell>
      <div className="auth-wrap">
        <div className="modal-card">
          <div className="mhdr">
            <div className="mtitle">Reset your password</div>
            <div className="msub">We will email you a reset link</div>
          </div>
          <div className="mbody">
            {message ? (
              <p style={{ fontSize: "var(--fs-sm)", color: "var(--muted)" }}>{message}</p>
            ) : (
              <form onSubmit={onSubmit}>
                {error && <div className="ferr" role="alert" style={{ display: "block" }}>{error}</div>}
                <p style={{ fontSize: "var(--fs-sm)", color: "var(--muted)", marginBottom: 14 }}>
                  Enter your account email and we will send you a reset link (valid for 1 hour).
                </p>
                <div className="fr">
                  <label htmlFor="forgot-email">Email</label>
                  <input id="forgot-email" className="fc" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <TurnstileWidget onToken={setTurnstileToken} resetSignal={turnstileReset} />
                <button className="fsubmit" style={{ width: "100%" }} type="submit" disabled={submitting}>
                  {submitting ? "Sending…" : "Send reset link"}
                </button>
              </form>
            )}
            <p style={{ fontSize: "var(--fs-label)", color: "var(--muted)", textAlign: "center", marginTop: 14 }}>
              <Link href="/login" style={{ color: "var(--green)", fontWeight: 600 }}>← Back to log in</Link>
            </p>
          </div>
        </div>
      </div>
    </V1Shell>
  );
}
