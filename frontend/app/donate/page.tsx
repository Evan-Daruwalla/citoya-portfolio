"use client";

import { Heart } from "lucide-react";
import { useState } from "react";

import { V1Shell } from "@/components/v1/v1-shell";

const PRESETS = [5, 10, 25, 50];

export default function DonatePage() {
  const [amount, setAmount] = useState<number>(10);
  const [custom, setCustom] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [thanks, setThanks] = useState(false);

  const effective = custom ? parseFloat(custom) || 0 : amount;

  function submit() {
    // Demo mode — no payments backend in v2 yet (matches v1's demo behavior).
    setThanks(true);
    setName("");
    setMessage("");
  }

  return (
    <V1Shell>
      <div className="section" style={{ maxWidth: 860 }}>
        <div className="donate-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 40, alignItems: "start" }}>
          <div>
            <div className="sec-tag">Support Citoya</div>
            <h2 className="sec-title" style={{ fontSize: "var(--fs-h1)" }}>
              Keep it free for <em style={{ color: "var(--green-l)", fontStyle: "italic" }}>every</em> student.
            </h2>
            <p className="sec-sub" style={{ marginBottom: 22 }}>
              Citoya will never charge students. Not for tracking, not for transcripts, not for anything. Supporters cover hosting and verification so it stays that way.
            </p>
            <div className="form-box">
              <label htmlFor="donate-custom-amount" style={{ fontSize: "var(--fs-micro)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text)" }}>Choose an amount</label>
              <div className="don-amounts">
                {PRESETS.map((v) => (
                  <button key={v} className={`don-amt${!custom && amount === v ? " on" : ""}`} onClick={() => { setAmount(v); setCustom(""); }}>${v}</button>
                ))}
                <input id="donate-custom-amount" className="fc" type="number" min={1} max={10000} placeholder="Custom $" style={{ width: 110 }} value={custom} onChange={(e) => setCustom(e.target.value)} />
              </div>
              <div className="fr"><label htmlFor="donate-display-name">Display name <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional)</span></label><input id="donate-display-name" className="fc" value={name} onChange={(e) => setName(e.target.value)} placeholder="Anonymous" /></div>
              <div className="fr"><label htmlFor="donate-message">Message <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional)</span></label><input id="donate-message" className="fc" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Why you support student volunteering…" /></div>
              {thanks && <div style={{ background: "var(--green-pale)", border: "1px solid var(--green-mid)", borderRadius: 6, padding: "11px 14px", fontSize: "var(--fs-label)", color: "var(--green)", marginBottom: 14 }}><Heart size={14} strokeWidth={1.75} aria-hidden /> Thank you! (Demo mode, no payment was collected.)</div>}
              <button className="fsubmit" style={{ width: "100%" }} disabled={!effective || effective < 1} onClick={submit}><Heart size={15} strokeWidth={1.75} aria-hidden /> Donate {effective ? `$${effective}` : "…"}</button>
              <p style={{ fontSize: "var(--fs-micro)", color: "var(--muted)", marginTop: 10, textAlign: "center" }}>Demo mode, no payment is collected yet. Stripe goes live with deployment.</p>
            </div>
          </div>
          <div>
            <div className="lb-stat" style={{ marginBottom: 14 }}>
              <div className="lb-stat-num">$0</div>
              <div className="lb-stat-label">Raised by 0 supporters</div>
            </div>
            <h4 style={{ fontSize: "var(--fs-sm)", color: "var(--dark)", marginBottom: 10 }}>Recent supporters</h4>
            <div className="don-recent"><div style={{ fontSize: "var(--fs-label)", color: "var(--muted)" }}>Be the first supporter!</div></div>
          </div>
        </div>
      </div>
    </V1Shell>
  );
}
