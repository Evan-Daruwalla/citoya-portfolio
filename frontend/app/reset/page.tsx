"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";

import { V1Shell } from "@/components/v1/v1-shell";
import { ApiError, api } from "@/lib/api";

// The token arrives in the URL FRAGMENT (`/reset#<token>`), not `?token=`: a query
// string reached the server's request log on every page load, and whoever read it
// inside the hour could set this password. Everything after "#" stays in the browser
// (2026-09-23, launch-plan L8). Read through `useSyncExternalStore` so the server
// render (no `location`) shows the loading line and no effect has to set state.
function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function ResetForm() {
  const router = useRouter();
  const token = useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash.replace(/^#/, ""),
    () => null
  );
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return; // narrows the type: the form renders only once a token is read
    if (password !== password2) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (token === null) {
    return <p style={{ fontSize: ".85rem", color: "var(--muted)" }}>Loading…</p>;
  }
  if (!token) {
    return <div className="ferr" style={{ display: "block" }}>This reset link is missing its token. Request a new one.</div>;
  }
  if (done) {
    return (
      <div>
        <p style={{ fontSize: ".85rem", color: "var(--muted)", marginBottom: 14 }}>Your password has been reset.</p>
        <button className="fsubmit" style={{ width: "100%" }} onClick={() => router.push("/login")}>Go to log in</button>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit}>
      {error && <div className="ferr" style={{ display: "block" }}>{error}</div>}
      <div className="fr">
        <label htmlFor="reset-password">New password</label>
        <input id="reset-password" className="fc" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
      </div>
      <div className="fr">
        <label htmlFor="reset-password-confirm">Confirm new password</label>
        <input id="reset-password-confirm" className="fc" type="password" required value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="Repeat it" />
      </div>
      <button className="fsubmit" style={{ width: "100%" }} type="submit" disabled={submitting}>
        {submitting ? "Resetting…" : "Set New Password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <V1Shell>
      <div className="auth-wrap">
        <div className="modal-card">
          <div className="mhdr">
            <div className="mtitle">Set a new password</div>
            <div className="msub">Choose a new password for your account</div>
          </div>
          <div className="mbody">
            <ResetForm />
            <p style={{ fontSize: ".8rem", color: "var(--muted)", textAlign: "center", marginTop: 14 }}>
              <Link href="/login" style={{ color: "var(--green)", fontWeight: 600 }}>← Back to log in</Link>
            </p>
          </div>
        </div>
      </div>
    </V1Shell>
  );
}
