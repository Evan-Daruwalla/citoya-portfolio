"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { V1Shell } from "@/components/v1/v1-shell";
import { ApiError, useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/");
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
            <div className="mtitle">Welcome back</div>
            <div className="msub">Log in to your Citoya account</div>
          </div>
          <div className="mbody">
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
          </div>
        </div>
      </div>
    </V1Shell>
  );
}
