"use client";

import { Lock, Printer, Trophy, WifiOff } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { V1Shell } from "@/components/v1/v1-shell";
import { ApiError, api } from "@/lib/api";
import { usePublicQuery } from "@/lib/use-api";

export default function PublicPortfolioPage() {
  const params = useParams<{ id: string }>();
  // Public: a shared transcript link must render for a signed-out visitor.
  const { data: pf, loading, error, retry } = usePublicQuery(
    `portfolio/${params.id}`,
    () => api.publicPortfolio(params.id),
  );
  // Until this conversion, EVERY failure landed on the "private or doesn't
  // exist" copy — a dropped connection told the visitor the student had made
  // their transcript private. Only the server's own answer means that now.
  const unavailable = error instanceof ApiError && error.status >= 400 && error.status < 500;

  if (loading) {
    return (
      <V1Shell>
        <div className="section" style={{ maxWidth: 680 }}>
          <div className="loading"><div className="spinner" /><div>Loading…</div></div>
        </div>
      </V1Shell>
    );
  }

  if (unavailable) {
    return (
      <V1Shell>
        <div className="section" style={{ maxWidth: 620, textAlign: "center" }}>
          <div className="empty">
            <div className="empty-icon"><Lock size={40} strokeWidth={1.75} aria-hidden /></div>
            This portfolio is private or does not exist. <Link href="/discover">Browse opportunities</Link> instead.
          </div>
        </div>
      </V1Shell>
    );
  }

  if (error || !pf) {
    return (
      <V1Shell>
        <div className="section" style={{ maxWidth: 620, textAlign: "center" }}>
          <div className="empty">
            <div className="empty-icon"><WifiOff size={40} strokeWidth={1.75} aria-hidden /></div>
            Could not load this transcript. Check your connection and try again.
            <div style={{ marginTop: 14 }}>
              <button className="btn-s" onClick={retry}>Retry</button>
            </div>
          </div>
        </div>
      </V1Shell>
    );
  }

  const statCard = (n: number, label: string) => (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20 }}>
      <div style={{ fontSize: "var(--fs-h2)", fontWeight: 700, color: "var(--green)" }}>{n}</div>
      <div style={{ fontSize: "var(--fs-micro)", color: "var(--muted)" }}>{label}</div>
    </div>
  );

  return (
    <V1Shell>
      <div className="section" style={{ maxWidth: 680 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-h2)", color: "var(--dark)", marginBottom: 4 }}>{pf.name}: Verified service transcript</h2>
          <p style={{ color: "var(--muted)", fontSize: "var(--fs-sm)" }}>Every hour below was verified by the hosting organization.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 28, textAlign: "center" }}>
          {statCard(pf.verified_hours, "Verified hours")}
          {statCard(pf.organizations, "Organizations")}
          {statCard(pf.awards.length, "Awards earned")}
        </div>

        <div style={{ marginBottom: 24 }}>
          <h4 style={{ fontSize: "var(--fs-sm)", color: "var(--dark)", marginBottom: 10 }}>Hours by organization</h4>
          <table className="tbl" style={{ fontSize: "var(--fs-sm)" }}>
            <tbody>
              {pf.hours_by_org.length ? pf.hours_by_org.map((o, i) => (
                <tr key={`${o.org_name}|${i}`}>
                  <td style={{ fontWeight: 500 }}>{o.org_name}</td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: "var(--green)" }}>{o.hours} hrs</td>
                </tr>
              )) : (
                <tr><td style={{ color: "var(--muted)" }}>No verified hours yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h4 style={{ fontSize: "var(--fs-sm)", color: "var(--dark)", marginBottom: 10 }}><Trophy size={16} strokeWidth={1.75} aria-hidden /> Awards</h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {pf.awards.length ? pf.awards.map((a) => (
              <span key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--green-pale)", border: "1px solid var(--green-mid)", padding: "6px 12px", borderRadius: 100, fontSize: "var(--fs-micro)", fontWeight: 600, color: "var(--green)" }}><Trophy size={13} strokeWidth={1.75} aria-hidden />{a.name}</span>
            )) : (
              <span style={{ color: "var(--muted)", fontSize: "var(--fs-label)" }}>No awards yet.</span>
            )}
          </div>
        </div>

        {pf.endorsements.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ fontSize: "var(--fs-sm)", color: "var(--dark)", marginBottom: 10 }}>Skill endorsements</h4>
            <table className="tbl" style={{ fontSize: "var(--fs-sm)" }}>
              <tbody>
                {pf.endorsements.map((e) => (
                  <tr key={`${e.org_name}|${e.skill}`}>
                    <td style={{ fontWeight: 500 }}>{e.skill} - {e.org_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
          <button className="btn-s" style={{ padding: "10px 20px" }} onClick={() => window.print()}><Printer size={15} strokeWidth={1.75} aria-hidden /> Print</button>
        </div>
      </div>
    </V1Shell>
  );
}
