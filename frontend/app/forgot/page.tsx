"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { TurnstileWidget } from "@/components/turnstile-widget";
import { V1Shell } from "@/components/v1/v1-shell";
import { ApiError, api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
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
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
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
            <div className="msub">We&apos;ll email you a reset link</div>
          </div>
          <div className="mbody">
            {message ? (
              <p style={{ fontSize: ".85rem", color: "var(--muted)" }}>{message}</p>
            ) : (
              <form onSubmit={onSubmit}>
                {error && <div className="ferr" style={{ display: "block" }}>{error}</div>}
                <p style={{ fontSize: ".85rem", color: "var(--muted)", marginBottom: 14 }}>
                  Enter your account email and we&apos;ll send you a reset link (valid for 1 hour).
                </p>
                <div className="fr">
                  <label htmlFor="forgot-email">Email</label>
                  <input id="forgot-email" className="fc" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <TurnstileWidget onToken={setTurnstileToken} />
                <button className="fsubmit" style={{ width: "100%" }} type="submit" disabled={submitting}>
                  {submitting ? "Sending…" : "Send Reset Link"}
                </button>
              </form>
            )}
            <p style={{ fontSize: ".8rem", color: "var(--muted)", textAlign: "center", marginTop: 14 }}>
              <Link href="/login" style={{ color: "var(--green)", fontWeight: 600 }}>← Back to log in</Link>
            </p>
          </div>
        </div>
      </div>
    </V1Shell>
  );
}
