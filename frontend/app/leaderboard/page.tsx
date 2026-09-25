"use client";

import { Medal, Rocket, School, Trophy } from "lucide-react";
import Link from "next/link";
import { V1Shell } from "@/components/v1/v1-shell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { usePublicQuery } from "@/lib/use-api";

const MEDAL_COLORS = ["var(--gold)", "#9ca3af", "#b45309"];

export default function LeaderboardPage() {
  const { user } = useAuth();
  // Public: the board renders for signed-out visitors, so this must not wait on
  // auth. Both requests share one key because the stat band is derived from the
  // pair — fetching them separately would let the band render against a
  // half-loaded pair and show wrong totals.
  const { data, loading, error, retry } = usePublicQuery("leaderboard+opps", async () => {
    const [board, opps] = await Promise.all([api.leaderboard(), api.listOpportunities({})]);
    return {
      entries: board,
      community: {
        totalHours: board.reduce((s, e) => s + e.hours, 0),
        students: board.length,
        orgs: new Set(opps.map((o) => o.org_id)).size,
        events: opps.length,
      },
    };
  });
  const entries = data?.entries ?? [];
  const community = data?.community ?? { totalHours: 0, students: 0, orgs: 0, events: 0 };

  return (
    <V1Shell>
      <div className="section">
        <div className="sec-tag">Community Impact</div>
        <h2 className="sec-title">The leaderboard of good</h2>
        <p className="sec-sub" style={{ marginBottom: 30 }}>
          Verified service hours across the whole Citoya community. Only first names and last initials are ever shown.
        </p>

        {loading ? (
          <div className="loading"><div className="spinner" /><div>Loading…</div></div>
        ) : error ? (
          // Previously a failed load fell through to the board's own empty state
          // and told every visitor "No verified hours yet" — the same
          // false-empty-state bug the applications page had.
          <div className="empty">
            <div className="empty-icon"><Rocket size={40} strokeWidth={1.75} aria-hidden /></div>
            Couldn&apos;t load the leaderboard. Check your connection and try again.
            <div style={{ marginTop: 14 }}>
              <button className="btn-s" onClick={retry}>Retry</button>
            </div>
          </div>
        ) : (
          <>
            <div className="lb-band">
              <div className="lb-stat"><div className="lb-stat-num">{community.totalHours.toLocaleString()}</div><div className="lb-stat-label">Verified Hours</div></div>
              <div className="lb-stat"><div className="lb-stat-num">{community.students.toLocaleString()}</div><div className="lb-stat-label">Students</div></div>
              <div className="lb-stat"><div className="lb-stat-num">{community.orgs}</div><div className="lb-stat-label">Organizations</div></div>
              <div className="lb-stat"><div className="lb-stat-num">{community.events.toLocaleString()}</div><div className="lb-stat-label">Service Entries</div></div>
            </div>

            <div className="lb-cols">
              <div>
                <h3 style={{ color: "var(--dark)", marginBottom: 14 }}><Trophy size={18} strokeWidth={1.75} aria-hidden /> Top Volunteers</h3>
                {entries.length ? (
                  entries.map((v, i) => (
                    <div key={v.rank} className={`lb-row${i < 3 ? " podium" : ""}`}>
                      <div className="lb-rank">{i < 3 ? <Medal size={16} strokeWidth={1.75} aria-hidden style={{ color: MEDAL_COLORS[i] }} /> : "#" + (i + 1)}</div>
                      <div><div className="lb-name">{v.name}</div></div>
                      <div className="lb-hours"><b>{v.hours}</b><small>hrs verified</small></div>
                    </div>
                  ))
                ) : (
                  <div className="empty"><div className="empty-icon"><Rocket size={40} strokeWidth={1.75} aria-hidden /></div>No verified hours yet. Be the first on the board.</div>
                )}
              </div>
              <div>
                <h3 style={{ color: "var(--dark)", marginBottom: 14 }}><School size={18} strokeWidth={1.75} aria-hidden /> Top Schools</h3>
                <div className="empty">Add your school to your profile to put it on the board.</div>
                {!user && (
                  <div style={{ marginTop: 18, textAlign: "center" }}>
                    <Link className="btn-p" href="/register">Sign up free to join the board</Link>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </V1Shell>
  );
}
