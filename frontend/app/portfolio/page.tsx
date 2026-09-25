"use client";

import { Link2, Lock, Printer, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { V1Shell } from "@/components/v1/v1-shell";
import { api } from "@/lib/api";
import { TOKEN_KEY, useAuth } from "@/lib/auth-context";
import { useAuthedQuery } from "@/lib/use-api";
import type { HoursWithOpportunity, MyAwards } from "@/lib/types";

export default function PortfolioPage() {
  const { user, loading } = useAuth();
  // Held (null key) for anyone who is not a signed-in student — the page has
  // nothing to show them, and firing the requests would only 401/403.
  const isStudent = user?.role === "student";
  const {
    data: hoursData,
    error: hoursError,
    retry: retryHours,
  } = useAuthedQuery(isStudent ? "hours/mine" : null, (t) => api.listHours(t));
  const { data: awards, error: awardsError } = useAuthedQuery(
    isStudent ? "awards/my" : null,
    (t) => api.myAwards(t),
  );
  // Without this the page fell through to "No verified hours yet" on a failed
  // load — telling a student their own transcript is empty when it is not.
  // Seventh instance of that bug class, and it was introduced by the very
  // migration meant to end it (audit 2026-09-01).
  const loadFailed = Boolean(hoursError || awardsError);
  const hours = (hoursData ?? []) as HoursWithOpportunity[];
  // `portfolio_public` is a user field, not a fetch: derive it from auth rather
  // than mirroring it into state that can drift from the server's copy.
  const [publicOverride, setPublicOverride] = useState<boolean | null>(null);
  const isPublic = publicOverride ?? user?.portfolio_public ?? false;
  const [copied, setCopied] = useState(false);

  async function togglepublic(next: boolean) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setPublicOverride(next); // optimistic
    try {
      await api.updateMe(token, { portfolio_public: next });
    } catch {
      setPublicOverride(!next); // revert on failure
    }
  }

  function copyLink() {
    if (!user) return;
    navigator.clipboard?.writeText(`${window.location.origin}/portfolio/${user.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return null;
  if (!user || user.role !== "student") {
    return (
      <V1Shell>
        <div className="section" style={{ maxWidth: 620, textAlign: "center" }}>
          <div className="empty">
            <div className="empty-icon"><Lock size={40} strokeWidth={1.75} aria-hidden /></div>
            Your verified-service transcript lives here. <Link href="/login">Log in</Link> as a student to view it.
          </div>
        </div>
      </V1Shell>
    );
  }

  const verified = hours.filter((h) => h.status === "verified");
  const byOrg = new Map<string, number>();
  for (const h of verified) byOrg.set(h.opportunity.org_name, (byOrg.get(h.opportunity.org_name) ?? 0) + h.hours);
  const orgRows = [...byOrg.entries()].sort((a, b) => b[1] - a[1]);
  const totalHours = awards?.verified_hours ?? verified.reduce((s, h) => s + h.hours, 0);
  const earned = awards?.earned ?? [];

  const statCard = (n: number, label: string) => (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20 }}>
      {/* An em dash, not 0, when the load failed. The fix below explains that an
          empty table is a loading problem — while these cards sat above it
          asserting "0 Verified Hours" in large type, which is the same false
          claim in the same viewport (landing-check 2026-09-01). */}
      <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--green)" }}>
        {loadFailed ? "—" : n}
      </div>
      <div style={{ fontSize: ".78rem", color: "var(--muted)" }}>{label}</div>
    </div>
  );

  return (
    <V1Shell>
      <div className="section" style={{ maxWidth: 680 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", color: "var(--dark)", marginBottom: 4 }}>{user.full_name || "Your"}: Verified Service Transcript</h2>
          <p style={{ color: "var(--muted)", fontSize: ".88rem" }}>Every hour below was verified by the hosting organization.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 28, textAlign: "center" }}>
          {statCard(totalHours, "Verified Hours")}
          {statCard(byOrg.size, "Organizations")}
          {statCard(earned.length, "Awards Earned")}
        </div>

        <div style={{ marginBottom: 24 }}>
          <h4 style={{ fontSize: ".92rem", color: "var(--dark)", marginBottom: 10 }}>Hours by Organization</h4>
          <table className="tbl" style={{ fontSize: ".85rem" }}>
            <tbody>
              {orgRows.length ? orgRows.map(([org, hrs]) => (
                <tr key={org}>
                  <td style={{ fontWeight: 500 }}>{org}</td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: "var(--green)" }}>{hrs} hrs</td>
                </tr>
              )) : (
                <tr>
                  <td style={{ color: "var(--muted)" }}>
                    {loadFailed ? (
                      <>
                        Couldn&apos;t load your transcript. This is a loading problem, not an
                        empty record.{" "}
                        <button className="btn-s" style={{ marginLeft: 8 }} onClick={retryHours}>
                          Retry
                        </button>
                      </>
                    ) : (
                      "No verified hours yet"
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h4 style={{ fontSize: ".92rem", color: "var(--dark)", marginBottom: 10 }}><Trophy size={16} strokeWidth={1.75} aria-hidden /> Awards</h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {earned.length ? earned.map((a) => (
              <span key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--green-pale)", border: "1px solid var(--green-mid)", padding: "6px 12px", borderRadius: 100, fontSize: ".78rem", fontWeight: 600, color: "var(--green)" }}><Trophy size={13} strokeWidth={1.75} aria-hidden />{a.name}</span>
            )) : (
              <span style={{ color: "var(--muted)", fontSize: ".83rem" }}>
                {loadFailed
                  ? "Couldn't load your awards — try again in a moment."
                  : "No awards yet. They show up on their own as your verified hours add up."}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
          <button className="btn-s" style={{ padding: "10px 20px" }} onClick={() => window.print()}><Printer size={15} strokeWidth={1.75} aria-hidden /> Print</button>
          {isPublic && <button className="btn-s" style={{ padding: "10px 20px" }} onClick={copyLink}>{copied ? "Copied ✓" : <><Link2 size={15} strokeWidth={1.75} aria-hidden /> Copy Public Link</>}</button>}
        </div>

        <div className="form-box" style={{ maxWidth: 520, margin: "22px auto 0" }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
            <input type="checkbox" checked={isPublic} onChange={(e) => togglepublic(e.target.checked)} style={{ width: 15, height: 15, marginTop: 3, accentColor: "var(--green)" }} />
            <span style={{ fontSize: ".85rem", color: "var(--text)" }}>
              <strong>Make my transcript public.</strong> Anyone with the link can view your verified hours,
              organizations, and awards (good for college and scholarship applications). Off by default.
            </span>
          </label>
        </div>
      </div>
    </V1Shell>
  );
}
