"use client";

import { errorText } from "@/lib/errors";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";

import { HoneypotField } from "@/components/honeypot-field";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { V1Shell } from "@/components/v1/v1-shell";
import { ApiError, useAuth } from "@/lib/auth-context";
import { pendingDeletionDeadline } from "@/lib/pending-deletion";
import { dashboardPath } from "@/lib/v1-routes";

function LoginInner() {
  const { login, loginMfa } = useAuth();
  const router = useRouter();
  // Set by the dashboards after an account holder deletes their own account
  // (2026-09-26): it is recoverable for 48 hours, and this page is where they would.
  const justDeleted = useSearchParams().get("deleted") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Bot defenses (2026-10-21): hidden honeypot, plus a Turnstile check shown only after the
  // server answers CAPTCHA_REQUIRED (3 failed logins in 15 minutes). It can also appear in the
  // "Restore it?" card (2026-10-24, audit GE #9).
  const [website, setWebsite] = useState("");
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  // An account inside its deletion window: the login answered 409 with the deadline,
  // and the card asks "Restore it?" instead of showing the form.
  const [pendingUntil, setPendingUntil] = useState<Date | null>(null);
  const [keptDeleted, setKeptDeleted] = useState(false);
  const promptRef = useRef<HTMLParagraphElement>(null);
  // Two-factor second step (2FA build, 2026-10-13). `mfaToken` is set once the password was
  // right and the account has a code to give; it stays through a "Restore it?" prompt, with the
  // typed `code`, so Restore can resend both (the backend does not spend the code on a 409).
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pendingUntil) promptRef.current?.focus();
  }, [pendingUntil]);

  // Focus the code field when the step appears and when the toggle swaps its meaning.
  useEffect(() => {
    if (mfaToken && !pendingUntil) codeRef.current?.focus();
  }, [mfaToken, useRecovery, pendingUntil]);

  function showPendingOrError(err: unknown) {
    const deadline = err instanceof ApiError ? pendingDeletionDeadline(err.detail) : null;
    if (deadline) {
      setKeptDeleted(false);
      setPendingUntil(deadline);
    } else {
      setPendingUntil(null);
      setError(errorText(err, "We could not log you in. Check your connection and try again."));
    }
  }

  async function signIn(restore: boolean) {
    setError(null);
    setSubmitting(true);
    try {
      const step = await login(email, password, {
        restore,
        website,
        ...(turnstileToken ? { turnstile_token: turnstileToken } : {}),
      });
      if ("mfaToken" in step) {
        setMfaToken(step.mfaToken);
        setTurnstileToken(null);
        setCode("");
        setUseRecovery(false);
      } else {
        router.push(dashboardPath(step.user));
      }
    } catch (err) {
      const d = err instanceof ApiError && err.status === 401 ? err.detail : null;
      if (d && typeof d === "object" && (d as { code?: unknown }).code === "CAPTCHA_REQUIRED") {
        setCaptchaRequired(true);
        // A restore attempt keeps its card open: clearing it sent the user back through the
        // login form and the same 409, a loop (2026-10-24, audit GE #9).
        if (!restore) setPendingUntil(null);
        const m = (d as { message?: unknown }).message;
        setError(typeof m === "string" && m ? m : "Please complete the security check, then log in again.");
      } else {
        showPendingOrError(err);
      }
      // A Turnstile token is single use: reset after any failed submit once the check is showing.
      if (captchaRequired) setTurnstileReset((n) => n + 1);
      setTurnstileToken(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode(restore: boolean) {
    if (!mfaToken) return;
    setError(null);
    setSubmitting(true);
    try {
      const user = await loginMfa(mfaToken, code, restore ? { restore: true } : undefined);
      router.push(dashboardPath(user));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && err.message.startsWith("Login expired")) {
        // The 5-minute step-one token ran out: back to the password step, message kept.
        startOver();
        setError(err.message);
      } else {
        showPendingOrError(err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    setMfaToken(null);
    setCode("");
    setUseRecovery(false);
    setPendingUntil(null);
    setPassword("");
    setError(null);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void signIn(false);
  }

  function onCodeSubmit(e: FormEvent) {
    e.preventDefault();
    void verifyCode(false);
  }

  function toggleRecovery() {
    setUseRecovery((v) => !v);
    setCode("");
    setError(null);
  }

  function keepDeleted() {
    startOver();
    setKeptDeleted(true);
  }

  return (
    <V1Shell>
      <div className="auth-wrap">
        <div className="modal-card">
          <div className="mhdr">
            <div className="mtitle">Welcome back</div>
            <div className="msub">{mfaToken ? "Enter the code from your authenticator app" : "Log in to your Citoya account"}</div>
          </div>
          <div className="mbody">
            {pendingUntil ? (
              <div>
                <p ref={promptRef} tabIndex={-1} style={{ fontSize: "var(--fs-sm)", color: "var(--text)", marginBottom: 14 }}>
                  This account is scheduled for deletion on{" "}
                  {new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short" }).format(pendingUntil)}.
                  {" "}Restore it?
                </p>
                {error && <div className="ferr" role="alert" style={{ display: "block" }}>{error}</div>}
                {captchaRequired && !mfaToken && <TurnstileWidget onToken={setTurnstileToken} resetSignal={turnstileReset} />}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn-p"
                    type="button"
                    onClick={() => void (mfaToken ? verifyCode(true) : signIn(true))}
                    disabled={submitting || (captchaRequired && !mfaToken && !turnstileToken)}
                  >
                    {submitting ? "Restoring…" : "Restore"}
                  </button>
                  <button className="btn-s" type="button" onClick={keepDeleted} disabled={submitting}>
                    Keep deleted
                  </button>
                </div>
              </div>
            ) : mfaToken ? (
              <form onSubmit={onCodeSubmit}>
                {error && <div className="ferr" role="alert" style={{ display: "block" }}>{error}</div>}
                <div className="fr">
                  <label htmlFor="login-code">{useRecovery ? "Recovery code" : "Authentication code"}</label>
                  <input
                    id="login-code"
                    ref={codeRef}
                    className="fc"
                    type="text"
                    inputMode={useRecovery ? "text" : "numeric"}
                    autoComplete="one-time-code"
                    autoCapitalize="off"
                    spellCheck={false}
                    maxLength={11}
                    required
                    value={code}
                    onChange={(e) =>
                      setCode(useRecovery ? e.target.value.replace(/[^a-zA-Z0-9-]/g, "") : e.target.value.replace(/\D/g, ""))
                    }
                    placeholder={useRecovery ? "xxxxx-xxxxx" : "123456"}
                  />
                </div>
                <button className="fsubmit" style={{ width: "100%" }} type="submit" disabled={submitting || !code}>
                  {submitting ? "Verifying…" : "Verify"}
                </button>
                <p style={{ fontSize: "var(--fs-label)", textAlign: "center", marginTop: 14 }}>
                  <button type="button" onClick={toggleRecovery} style={{ background: "none", border: "none", padding: 0, color: "var(--green)", fontWeight: 600, cursor: "pointer" }}>
                    {useRecovery ? "Use an authentication code" : "Use a recovery code"}
                  </button>
                </p>
                <p style={{ fontSize: "var(--fs-label)", textAlign: "center", marginTop: 6 }}>
                  <button type="button" onClick={startOver} style={{ background: "none", border: "none", padding: 0, color: "var(--muted)", textDecoration: "underline", cursor: "pointer" }}>
                    Start over
                  </button>
                </p>
              </form>
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
                  <HoneypotField value={website} onChange={setWebsite} />
                  {error && <div className="ferr" role="alert" style={{ display: "block" }}>{error}</div>}
                  <div className="fr">
                    <label htmlFor="login-email">Email</label>
                    <input id="login-email" className="fc" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div className="fr">
                    <label htmlFor="login-password">Password</label>
                    <input id="login-password" className="fc" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                  {captchaRequired && <TurnstileWidget onToken={setTurnstileToken} resetSignal={turnstileReset} />}
                  <button className="fsubmit" style={{ width: "100%" }} type="submit" disabled={submitting}>
                    {submitting ? "Logging in…" : "Log in"}
                  </button>
                </form>
                <p style={{ fontSize: "var(--fs-label)", color: "var(--muted)", textAlign: "center", marginTop: 14 }}>
                  Do not have an account?{" "}
                  <Link href="/register" style={{ color: "var(--green)", fontWeight: 600 }}>Sign up free</Link>
                </p>
                <p style={{ fontSize: "var(--fs-label)", textAlign: "center", marginTop: 6 }}>
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
