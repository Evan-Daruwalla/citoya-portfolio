"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";

import { V1Shell } from "@/components/v1/v1-shell";
import { ApiError, useAuth } from "@/lib/auth-context";
import { pendingDeletionDeadline } from "@/lib/pending-deletion";

function LoginInner() {
  const { login } = useAuth();
  const router = useRouter();
  // Set by the dashboards after an account holder deletes their own account
  // (2026-09-26): it is recoverable for 48 hours, and this page is where they would.
  const justDeleted = useSearchParams().get("deleted") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // An account inside its deletion window: the login answered 409 with the deadline,
  // and the card asks "Restore it?" instead of showing the form.
  const [pendingUntil, setPendingUntil] = useState<Date | null>(null);
  const [keptDeleted, setKeptDeleted] = useState(false);
  const promptRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (pendingUntil) promptRef.current?.focus();
  }, [pendingUntil]);

  async function signIn(restore: boolean) {
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password, { restore });
      router.push("/");
    } catch (err) {
      const deadline = err instanceof ApiError ? pendingDeletionDeadline(err.detail) : null;
      if (deadline) {
        setKeptDeleted(false);
        setPendingUntil(deadline);
      } else {
        setPendingUntil(null);
        setError(err instanceof ApiError ? err.message : "Something went wrong.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void signIn(false);
  }

  function keepDeleted() {
    setPendingUntil(null);
    setPassword("");
    setKeptDeleted(true);
  }

  return (
    <V1Shell>
      <div className="auth-wrap">
        <div className="modal-card">
          <div className="mhdr">
            <div className="mtitle">Welcome back</div>
            <div className="msub">Log in to your Citoya account</div>
          </div>
          <div className="mbody">
            {pendingUntil ? (
              <div>
                <p ref={promptRef} tabIndex={-1} style={{ fontSize: ".9rem", color: "var(--text)", marginBottom: 14 }}>
                  This account is scheduled for deletion on{" "}
                  {new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short" }).format(pendingUntil)}.
                  {" "}Restore it?
                </p>
                {error && <div className="ferr" style={{ display: "block" }}>{error}</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-p" type="button" onClick={() => void signIn(true)} disabled={submitting}>
                    {submitting ? "Restoring…" : "Restore"}
                  </button>
                  <button className="btn-s" type="button" onClick={keepDeleted} disabled={submitting}>
                    Keep deleted
                  </button>
                </div>
              </div>
            ) : (
              <>
                {justDeleted && !keptDeleted && (
                  <div className="consent-zone" role="status" style={{ padding: 16, marginBottom: 18 }}>
                    <p>Your account has been deleted. You can recover it by logging in within the next 48 hours.</p>
                  </div>
                )}
                {keptDeleted && (
                  <div className="consent-zone" role="status" style={{ padding: 16, marginBottom: 18 }}>
                    <p>Your account stays scheduled for deletion.</p>
                  </div>
                )}
                <form onSubmit={onSubmit}>
                  {error && <div className="ferr" style={{ display: "block" }}>{error}</div>}
                  <div className="fr">
                    <label htmlFor="login-email">Email</label>
                    <input id="login-email" className="fc" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div className="fr">
                    <label htmlFor="login-password">Password</label>
                    <input id="login-password" className="fc" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                  <button className="fsubmit" style={{ width: "100%" }} type="submit" disabled={submitting}>
                    {submitting ? "Logging in…" : "Log In"}
                  </button>
                </form>
                <p style={{ fontSize: ".8rem", color: "var(--muted)", textAlign: "center", marginTop: 14 }}>
                  Don&apos;t have an account?{" "}
                  <Link href="/register" style={{ color: "var(--green)", fontWeight: 600 }}>Sign up free</Link>
                </p>
                <p style={{ fontSize: ".8rem", textAlign: "center", marginTop: 6 }}>
                  <Link href="/forgot" style={{ color: "var(--muted)", textDecoration: "underline" }}>Forgot password?</Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </V1Shell>
  );
}

// `useSearchParams` needs a Suspense boundary to build (the billing page does the same).
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
