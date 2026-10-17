"use client";

import { errorText } from "@/lib/errors";
import { GraduationCap, Landmark } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { TurnstileWidget } from "@/components/turnstile-widget";
import { V1Shell } from "@/components/v1/v1-shell";
import { AccountCreatedLoginFailed, useAuth } from "@/lib/auth-context";
import { ageFromDobUtc } from "@/lib/consent";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<"student" | "org">("student");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // audit DY Med 18, 2026-10-05: bumped on a failed submit to reset the spent token.
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLoginLink, setShowLoginLink] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Audit DY Low 39, 2026-10-07: the server's UTC age rule (lib/consent.ts), not a local-date
  // copy, so a form filled in near midnight agrees with what the server will decide.
  const age = dob && !Number.isNaN(Date.parse(dob)) ? ageFromDobUtc(dob) : null;
  const isMinor = role === "student" && age !== null && age < 18;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setShowLoginLink(false);
    setSubmitting(true);
    try {
      await register({
        email,
        password,
        full_name: fullName || undefined,
        role,
        ...(role === "student" ? { dob } : {}),
        ...(isMinor ? { guardian_name: guardianName, guardian_email: guardianEmail } : {}),
        ...(turnstileToken ? { turnstile_token: turnstileToken } : {}),
        accepted_terms: true,
      });
      router.push("/welcome");
    } catch (err) {
      if (err instanceof AccountCreatedLoginFailed) {
        setError("Your account was created, but we could not log you in. Log in with your email and password.");
        setShowLoginLink(true);
      } else {
        setError(errorText(err, "We could not create your account. Check your connection and try again."));
        setTurnstileReset((n) => n + 1);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <V1Shell>
      <div className="auth-wrap">
        <div className="modal-card">
          <div className="mhdr">
            <div className="mtitle">Welcome to Citoya</div>
            <div className="msub">Find community service and track your hours</div>
          </div>
          <div className="mbody">
            <p style={{ fontSize: "var(--fs-sm)", color: "var(--muted)", marginBottom: 16 }}>I am signing up as a…</p>
            {/* Real <button>s, not clickable <div>s. As divs these had no tabIndex,
                no onKeyDown and no role, so keyboard and screen-reader users could
                never reach them — and `role` defaults to "student", which locked
                those users out of creating an ORG account entirely
                (audit 2026-08-06). `aria-pressed` conveys which is selected. */}
            <div className="auth-role-btns" role="group" aria-label="Account type">
              <button
                type="button"
                aria-pressed={role === "student"}
                className={`role-btn${role === "student" ? " on" : ""}`}
                onClick={() => setRole("student")}
              >
                <div className="rb-icon"><GraduationCap size={28} strokeWidth={1.75} aria-hidden /></div>
                <div className="rb-label">Student</div>
                <div className="rb-sub">Find volunteer opportunities</div>
              </button>
              <button
                type="button"
                aria-pressed={role === "org"}
                className={`role-btn${role === "org" ? " on" : ""}`}
                onClick={() => setRole("org")}
              >
                <div className="rb-icon"><Landmark size={28} strokeWidth={1.75} aria-hidden /></div>
                <div className="rb-label">Organization</div>
                <div className="rb-sub">Post opportunities and verify hours</div>
              </button>
            </div>

            <form onSubmit={onSubmit}>
              {error && <div className="ferr" role="alert" style={{ display: "block" }}>{error}{showLoginLink && <>{" "}<Link href="/login" style={{ color: "var(--green)", fontWeight: 600 }}>Log in</Link></>}</div>}
              <div className="fr">
                <label htmlFor="register-name">{role === "org" ? "Organization name" : "Full name (legal)"} <span style={{ color: "var(--red)" }}>*</span></label>
                <input id="register-name" className="fc" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={role === "org" ? "Green Roots Community Garden" : "Alex Johnson"} />
              </div>
              <div className="fr">
                <label htmlFor="register-email">Email <span style={{ color: "var(--red)" }}>*</span></label>
                <input id="register-email" className="fc" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="fr">
                <label htmlFor="register-password">Password <span style={{ color: "var(--red)" }}>*</span></label>
                <input id="register-password" className="fc" type="password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 12 characters" />
              </div>
              {role === "student" && (
                <div className="fr">
                  <label htmlFor="register-dob">Date of birth <span style={{ color: "var(--red)" }}>*</span></label>
                  <input id="register-dob" className="fc" type="date" required value={dob} onChange={(e) => setDob(e.target.value)} />
                  <div className="fhint">You must be 13 or older. We use your birth date to check your age. Under 18, a parent or guardian approves your account.</div>
                </div>
              )}
              {isMinor && (
                <div style={{ background: "var(--green-pale)", border: "1px solid var(--green-mid)", borderRadius: 6, padding: 14, marginBottom: 4 }}>
                  <div className="fr">
                    <label htmlFor="register-guardian-name">Parent or guardian name <span style={{ color: "var(--red)" }}>*</span></label>
                    <input id="register-guardian-name" className="fc" required value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="Jamie Johnson" />
                  </div>
                  <div className="fr" style={{ marginBottom: 0 }}>
                    <label htmlFor="register-guardian-email">Parent or guardian email <span style={{ color: "var(--red)" }}>*</span></label>
                    <input id="register-guardian-email" className="fc" type="email" required value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} placeholder="parent@example.com" />
                    <div className="fhint">Since you are under 18, we will email your parent or guardian to approve your account before you can sign up for opportunities.</div>
                  </div>
                </div>
              )}
              <TurnstileWidget onToken={setTurnstileToken} resetSignal={turnstileReset} />
              <div className="fr" style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 4 }}>
                <input
                  id="accept-terms"
                  type="checkbox"
                  required
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0, cursor: "pointer" }}
                />
                <label htmlFor="accept-terms" style={{ display: "block", textTransform: "none", fontWeight: 400, letterSpacing: "normal", fontSize: "var(--fs-label)", lineHeight: 1.5, color: "var(--muted)", marginBottom: 0, cursor: "pointer" }}>
                  I have read and agree to the{" "}
                  <Link href="/terms" target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "var(--green)", fontWeight: 600 }}>Terms of service</Link>{" "}
                  and{" "}
                  <Link href="/privacy" target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "var(--green)", fontWeight: 600 }}>Privacy policy</Link>.
                </label>
              </div>
              <button className="fsubmit" style={{ width: "100%" }} type="submit" disabled={submitting || !acceptedTerms}>
                {submitting ? "Creating account…" : role === "org" ? "Register organization" : "Create student account"}
              </button>
            </form>
            <p style={{ fontSize: "var(--fs-label)", color: "var(--muted)", textAlign: "center", marginTop: 14 }}>
              Already have an account?{" "}
              <Link href="/login" style={{ color: "var(--green)", fontWeight: 600 }}>Log in</Link>
            </p>
          </div>
        </div>
      </div>
    </V1Shell>
  );
}
