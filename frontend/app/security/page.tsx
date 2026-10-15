"use client";

/**
 * Two-factor login settings (2FA build, 2026-10-13). Turn it on (QR + first code, then the
 * recovery codes ONCE), get a new set of recovery codes, and, only for accounts that are not
 * required to have it, turn it off. The secret and the recovery codes live in component state
 * for as long as they are on screen and nowhere else: nothing is persisted or logged. The
 * token comes from the auth context (`getToken`) so this file never reads the token store itself.
 * enable/disable return a NEW token (token_version is bumped), which `adoptToken` stores.
 */
import { errorText } from "@/lib/errors";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { V1Shell } from "@/components/v1/v1-shell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { TwoFactorSetup } from "@/lib/types";
import { dashboardPath } from "@/lib/v1-routes";

type Mode = "idle" | "regen" | "disable";

const linkButton = { background: "none", border: "none", padding: 0, color: "var(--muted)", textDecoration: "underline", cursor: "pointer", fontSize: "var(--fs-label)" } as const;

export default function SecurityPage() {
  const { user, loading, adoptToken, getToken } = useAuth();
  const router = useRouter();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The one-time recovery codes: set after enable or regenerate, cleared by "I have saved these".
  const [codes, setCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState<"key" | "codes" | null>(null);
  // Change-password card: its own state, separate from the two-factor card above it.
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Focus the first field of each step.
  useEffect(() => {
    if (setup || mode === "regen") codeRef.current?.focus();
    else if (mode === "disable") passwordRef.current?.focus();
  }, [setup, mode]);
  useEffect(() => {
    if (codes) savedRef.current?.focus();
  }, [codes]);

  if (loading || !user) return null;

  function reset() {
    setSetup(null);
    setMode("idle");
    setCode("");
    setPassword("");
    setError(null);
  }

  // Runs one call with the shared busy/error handling. A missing token (signed out in another
  // tab) is reported rather than sent.
  async function run(call: (token: string) => Promise<void>) {
    const token = getToken();
    if (!token) {
      setError("Your session ended. Log in again.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await call(token);
    } catch (err) {
      setError(errorText(err, "We could not update your two-factor login settings. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  }

  function startSetup() {
    void run(async (token) => {
      setSetup(await api.twoFactorSetup(token));
      setCode("");
    });
  }

  function turnOn(e: FormEvent) {
    e.preventDefault();
    void run(async (token) => {
      const res = await api.twoFactorEnable(token, code);
      setCodes(res.recovery_codes);
      reset();
      await adoptToken(res.access_token);
    });
  }

  function regenerate(e: FormEvent) {
    e.preventDefault();
    void run(async (token) => {
      const res = await api.twoFactorRecoveryCodes(token, code);
      setCodes(res.recovery_codes);
      reset();
    });
  }

  function turnOff(e: FormEvent) {
    e.preventDefault();
    void run(async (token) => {
      const res = await api.twoFactorDisable(token, password, code);
      reset();
      await adoptToken(res.access_token);
    });
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwDone(false);
    if (newPw !== confirmPw) {
      setPwError("New passwords do not match");
      return;
    }
    const token = getToken();
    if (!token) {
      setPwError("Your session ended. Log in again.");
      return;
    }
    setPwError(null);
    setPwBusy(true);
    try {
      const res = await api.changePassword(token, curPw, newPw);
      await adoptToken(res.access_token);
      setCurPw("");
      setNewPw("");
      setConfirmPw("");
      setPwDone(true);
    } catch (err) {
      setPwError(errorText(err, "We could not change your password. Check your connection and try again."));
    } finally {
      setPwBusy(false);
    }
  }

  async function copy(text: string, what: "key" | "codes") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      setError("Could not copy. Select the text and copy it by hand.");
    }
  }

  const codeField = (id: string) => (
    <div className="fr">
      <label htmlFor={id}>Authentication code</label>
      <input
        id={id}
        ref={codeRef}
        className="fc"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        required
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="123456"
      />
    </div>
  );
  const errorLine = error && <div className="ferr" role="alert" style={{ display: "block" }}>{error}</div>;
  const on = user.two_factor_enabled;

  return (
    <V1Shell>
      <div className="auth-wrap">
        <div className="modal-card">
          <div className="mhdr">
            <div className="mtitle">Two-factor login</div>
            <div className="msub">{on ? "Two-factor login is on" : "Two-factor login is off"}</div>
          </div>
          <div className="mbody">
            {codes ? (
              <div>
                <p style={{ fontSize: "var(--fs-sm)", color: "var(--text)", marginBottom: 14 }}>
                  Each code works once. Keep them somewhere safe - they are the only way in if you lose your phone.
                </p>
                <ul
                  aria-label="Recovery codes"
                  style={{ listStyle: "none", padding: 14, margin: "0 0 14px", background: "var(--light)", border: "1px solid var(--border)", borderRadius: 6, fontFamily: "ui-monospace, monospace", fontSize: "var(--fs-sm)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}
                >
                  {codes.map((c) => <li key={c}>{c}</li>)}
                </ul>
                {errorLine}
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-s btn-sm" type="button" onClick={() => void copy(codes.join("\n"), "codes")}>
                    {copied === "codes" ? "Copied" : "Copy all"}
                  </button>
                  <button ref={savedRef} className="btn-p btn-sm" type="button" onClick={() => { setCodes(null); setCopied(null); setError(null); }}>
                    I have saved these
                  </button>
                </div>
              </div>
            ) : setup ? (
              <form onSubmit={turnOn}>
                <p style={{ fontSize: "var(--fs-sm)", color: "var(--text)", marginBottom: 14 }}>
                  Scan this with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, ...), then enter the 6-digit code it shows.
                </p>
                <div style={{ textAlign: "center", marginBottom: 14 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- a data: URI; next/image has nothing to optimise */}
                  <img src={setup.qr_svg_data_uri} alt="QR code for your authenticator app" width={200} height={200} />
                </div>
                <div className="fr">
                  <label htmlFor="sec-key">Or enter this key by hand</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <code id="sec-key" style={{ flex: 1, padding: "10px 12px", background: "var(--light)", border: "1px solid var(--border)", borderRadius: 6, fontFamily: "ui-monospace, monospace", fontSize: "var(--fs-sm)", wordBreak: "break-all" }}>{setup.secret_b32}</code>
                    <button className="btn-s btn-sm" type="button" onClick={() => void copy(setup.secret_b32, "key")}>
                      {copied === "key" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
                {codeField("sec-code")}
                {errorLine}
                <button className="fsubmit" style={{ width: "100%" }} type="submit" disabled={busy || code.length !== 6}>
                  {busy ? "Turning on…" : "Turn on"}
                </button>
                <p style={{ textAlign: "center", marginTop: 12 }}>
                  <button type="button" style={linkButton} onClick={reset}>Cancel</button>
                </p>
              </form>
            ) : (
              <div>
                {!on && user.two_factor_required && (
                  <div className="consent-zone" role="status" style={{ padding: 16, marginBottom: 18 }}>
                    <p>Your account type requires two-factor login. Set it up to continue.</p>
                  </div>
                )}
                {mode === "regen" ? (
                  <form onSubmit={regenerate}>
                    <p style={{ fontSize: "var(--fs-sm)", color: "var(--text)", marginBottom: 14 }}>
                      Enter a current code from your authenticator app. The old recovery codes stop working.
                    </p>
                    {codeField("sec-regen-code")}
                    {errorLine}
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button className="btn-p btn-sm" type="submit" disabled={busy || code.length !== 6}>
                        {busy ? "Working…" : "Get new codes"}
                      </button>
                      <button type="button" style={linkButton} onClick={reset}>Cancel</button>
                    </div>
                  </form>
                ) : mode === "disable" ? (
                  <form onSubmit={turnOff}>
                    <p style={{ fontSize: "var(--fs-sm)", color: "var(--text)", marginBottom: 14 }}>
                      Enter your password and a current code to turn two-factor login off.
                    </p>
                    <div className="fr">
                      <label htmlFor="sec-password">Password</label>
                      <input id="sec-password" ref={passwordRef} className="fc" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    {codeField("sec-off-code")}
                    {errorLine}
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button className="btn-p btn-sm" type="submit" disabled={busy || !password || code.length !== 6}>
                        {busy ? "Working…" : "Turn off"}
                      </button>
                      <button type="button" style={linkButton} onClick={reset}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                    {errorLine}
                    {on ? (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Link className="btn-p btn-sm" href={dashboardPath(user)}>
                          Back to dashboard
                        </Link>
                        <button className="btn-s btn-sm" type="button" onClick={() => { setError(null); setCode(""); setMode("regen"); }}>
                          Get new recovery codes
                        </button>
                        {!user.two_factor_required && (
                          <button className="btn-s btn-sm btn-danger" type="button" onClick={() => { setError(null); setCode(""); setPassword(""); setMode("disable"); }}>
                            Turn off
                          </button>
                        )}
                      </div>
                    ) : (
                      <button className="btn-p btn-sm" type="button" onClick={startSetup} disabled={busy}>
                        {busy ? "Setting up…" : "Set up"}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        {!(user.two_factor_required && !user.two_factor_enabled) && (
          <div className="modal-card" style={{ marginTop: 18 }}>
            <div className="mhdr">
              <div className="mtitle">Change password</div>
              <div className="msub">Signs you out everywhere else.</div>
            </div>
            <div className="mbody">
              <form onSubmit={changePassword}>
                <div className="fr">
                  <label htmlFor="sec-cur-pw">Current password</label>
                  <input id="sec-cur-pw" className="fc" type="password" autoComplete="current-password" required value={curPw} onChange={(e) => setCurPw(e.target.value)} />
                </div>
                <div className="fr">
                  <label htmlFor="sec-new-pw">New password</label>
                  <input id="sec-new-pw" className="fc" type="password" autoComplete="new-password" minLength={12} required value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                </div>
                <div className="fr">
                  <label htmlFor="sec-confirm-pw">Confirm new password</label>
                  <input id="sec-confirm-pw" className="fc" type="password" autoComplete="new-password" required value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
                </div>
                {pwError && <div className="ferr" role="alert" style={{ display: "block" }}>{pwError}</div>}
                {pwDone && <p role="status" style={{ fontSize: "var(--fs-sm)", color: "var(--text)", marginBottom: 14 }}>Password changed.</p>}
                <button className="fsubmit" style={{ width: "100%" }} type="submit" disabled={pwBusy || !curPw || !newPw || !confirmPw || newPw.length < 12}>
                  {pwBusy ? "Changing…" : "Change password"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </V1Shell>
  );
}
