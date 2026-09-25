"use client";

import { Clock, Globe, MapPin, RefreshCw, Search, Shuffle, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CategoryIcon, getCategoryMeta } from "@/components/v1/category-icon";
import { V1Shell } from "@/components/v1/v1-shell";
import { api } from "@/lib/api";
import { TOKEN_KEY, useAuth } from "@/lib/auth-context";
import { daysUntilEventDate, eventInstant, fmtEventDate } from "@/lib/event-time";
import { useAuthedQuery, usePublicQuery } from "@/lib/use-api";
import type { Opportunity } from "@/lib/types";

const CATEGORIES = ["Education", "Environment", "Health", "Animals", "Food & Hunger", "Arts & Culture", "Community", "STEM", "Agriculture"];
const COMMITMENT: Record<string, string> = { one_time: "One-time", weekly: "Weekly", monthly: "Monthly" };

function relDate(iso: string, timeZone: string): string {
  const d = eventInstant(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = daysUntilEventDate(iso, timeZone);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1 && days < 7) return `In ${days} days`;
  // The event's own calendar date (D1), not the viewer's.
  return fmtEventDate(iso, timeZone);
}

export default function DiscoverPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [category, setCategory] = useState("");
  // Public: the list renders for signed-out visitors. Keyed on category so each
  // filter keeps its own cache entry and switching back is instant.
  const {
    data: oppsData,
    loading,
    error,
    retry: loadOpps,
  } = usePublicQuery(`opportunities:${category}`, () =>
    api.listOpportunities({ category: category || undefined }),
  );
  const opps = oppsData ?? [];
  // Held for anyone who is not a signed-in student: an org has no saved list.
  const { data: savedIdsData, mutate: mutateSaved } = useAuthedQuery(
    user?.role === "student" ? "saved/ids" : null,
    (t) => api.listSavedIds(t),
  );
  const savedIds = useMemo(() => new Set(savedIdsData ?? []), [savedIdsData]);
  // These two shipped as `defaultValue`-only <select>s — no state, no handler —
  // so both filters were decorative while the section copy promised they worked
  // (audit 2026-08-11). Filtered client-side rather than server-side because the
  // list endpoint only accepts `category`/`query`, and the page already holds the
  // full result set.
  const [commitment, setCommitment] = useState("");
  const [format, setFormat] = useState("");
  const [q, setQ] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return opps.filter((o) => {
      if (commitment && o.commitment !== commitment) return false;
      if (format && o.format !== format) return false;
      if (!needle) return true;
      return `${o.title} ${o.org_name} ${o.skills.join(" ")}`.toLowerCase().includes(needle);
    });
  }, [opps, q, commitment, format]);

  function toggleSave(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const token = localStorage.getItem(TOKEN_KEY);
    // The heart renders for signed-out visitors too (the button's own condition
    // includes `!user`), so this path is reachable in ordinary browsing. It used to
    // return silently: a real click target that did nothing, with no redirect, no
    // message and no disabled state (audit 2026-09-02).
    if (!token) {
      router.push("/login");
      return;
    }
    // Optimistic, but REVERTED on failure. Both catches used to swallow the error
    // outright, so a failed save left the heart filled while the server recorded
    // nothing — the bookmark silently vanished on the next reload and the user
    // could not tell which of N saves had actually taken (audit 2026-08-11).
    // Written through SWR's cache rather than local state, but the CONTRACT is
    // unchanged: optimistic, and reverted on failure. `revalidate: false` on
    // both writes is what makes the revert authoritative — letting SWR refetch
    // instead would race the failed request and could restore the wrong heart.
    const prev = savedIdsData ?? [];
    const undo = (msg: string) => {
      void mutateSaved(prev, { revalidate: false });
      setSaveError(msg);
    };
    setSaveError(null);
    if (savedIds.has(id)) {
      void mutateSaved(prev.filter((x) => x !== id), { revalidate: false });
      api.unsave(id, token).catch(() => undo("Couldn't remove that bookmark. Try again."));
    } else {
      void mutateSaved([...prev, id], { revalidate: false });
      api.save(id, token).catch(() => undo("Couldn't save that bookmark. Try again."));
    }
  }

  const chips: { cls: string; label: string; clear: () => void }[] = [];
  if (q) chips.push({ cls: "", label: `"${q}"`, clear: () => setQ("") });
  if (category) chips.push({ cls: "fc-cat", label: category, clear: () => setCategory("") });
  if (commitment) chips.push({ cls: "", label: commitment, clear: () => setCommitment("") });
  if (format) chips.push({ cls: "", label: format, clear: () => setFormat("") });

  return (
    <V1Shell>
      <div className="section">
        <div style={{ marginBottom: 28 }}>
          <div className="sec-tag">Volunteer Opportunities</div>
          <h2 className="sec-title">Find your next opportunity</h2>
          <p className="sec-sub">Browse local organizations and their open opportunities. Filter by category, commitment, and format to find something that fits.</p>
        </div>

        {/* ZIP / DISTANCE FILTER — removed 2026-08-06.
            All three controls were inert: the input had no value/onChange, the
            select had no onChange, and the Apply button had no handler. The copy
            beside them asserted "Searches cover 15 miles by default", which was
            never true — `lat`/`lng` are null on 100% of opportunity rows and no
            endpoint filters on distance. A control that does nothing while
            claiming a behaviour is worse than an absent one, so it comes back
            with geolocation, not before (audit 2026-08-06).
            Opportunity.lat/lng and the `zip-filter-wrap`/`zip-*` CSS are left in
            place for that work. */}

        {/* SEARCH + FILTERS */}
        <div className="search-bar">
          <div className="si-wrap" style={{ flex: 2 }}>
            <svg viewBox="0 0 24 24">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
            <input
              className="si"
              aria-label="Search opportunities"
              placeholder="Search by role, skill, or organization…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            className="fsel"
            aria-label="Filter by category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            className="fsel"
            aria-label="Filter by commitment"
            value={commitment}
            onChange={(e) => setCommitment(e.target.value)}
          >
            <option value="">Any Commitment</option>
            <option>One-time</option>
            <option>Weekly</option>
            <option>Monthly</option>
          </select>
          <select
            className="fsel"
            aria-label="Filter by format"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            <option value="">In-Person or Remote</option>
            <option value="Remote">Remote</option>
            <option value="In-Person">In-Person</option>
            <option value="Hybrid">Hybrid</option>
          </select>
        </div>

        {saveError && (
          <div className="ferr" style={{ display: "block", marginTop: 12 }} role="status">
            {saveError}
          </div>
        )}

        {/* ACTIVE FILTER CHIPS */}
        {chips.length > 0 && (
          <div className="filter-bar">
            {chips.map((c, i) => (
              <span key={i} className={`filter-chip ${c.cls}`}>
                {c.label}
                <button onClick={c.clear} title="Remove filter" aria-label="Remove filter">
                  ✕
                </button>
              </span>
            ))}
            <button className="fc-clear" onClick={() => { setQ(""); setCategory(""); }}>
              Clear all
            </button>
          </div>
        )}

        {/* CARD GRID */}
        {loading ? (
          <div className="cards-grid" aria-busy="true" aria-label="Loading opportunities">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skel-card">
                <div className="skel skel-avatar" style={{ marginBottom: 14 }} />
                <div className="skel skel-line" style={{ width: "70%", height: 16, marginBottom: 10 }} />
                <div className="skel skel-line" style={{ width: "45%", marginBottom: 14 }} />
                <div className="skel skel-line" style={{ width: "100%", marginBottom: 7 }} />
                <div className="skel skel-line" style={{ width: "85%", marginBottom: 16 }} />
                <div className="skel skel-line" style={{ width: "55%" }} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="load-error">
            <div className="empty-icon"><TriangleAlert size={40} strokeWidth={1.75} aria-hidden /></div>
            <div className="ferr">Couldn&apos;t load opportunities. Check your connection and try again.</div>
            <div>
              <button className="btn-s" style={{ padding: "9px 18px", fontSize: ".83rem" }} onClick={loadOpps}>
                Retry
              </button>
            </div>
          </div>
        ) : shown.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><Search size={40} strokeWidth={1.75} aria-hidden /></div>
            Nothing matches those filters yet. Try widening the search.
          </div>
        ) : (
          <div className="cards-grid">
            {shown.map((o) => {
              const fmt = (o.format || "").toLowerCase();
              const loc = (o.location || "").toLowerCase();
              const isRemote = fmt === "remote" || loc.includes("remote");
              const isHybrid = fmt === "hybrid" || loc.includes("hybrid");
              const fmtCls = isRemote ? "format-remote" : isHybrid ? "format-hybrid" : "";
              const meta = getCategoryMeta(o.category);
              return (
                <Link
                  key={o.id}
                  href={`/opportunities/${o.id}`}
                  className={`opp-card ${fmtCls}${o.featured ? " featured" : ""}`}
                >
                  <div className="oc-top">
                    <div className="oc-avatar" style={{ background: meta.bg, color: meta.fg }}>
                      <CategoryIcon category={o.category} size={20} />
                    </div>
                    <div className="badges-row">
                      {o.featured && <span className="badge badge-featured">★ Featured</span>}
                    </div>
                  </div>
                  <div className="oc-title">{o.title}</div>
                  <div className="oc-org">{o.org_name}</div>
                  <div className="oc-desc">{o.description || ""}</div>
                  <div className="badges-row" style={{ marginBottom: 8 }}>
                    {(o.skills || []).slice(0, 3).map((s) => (
                      <span key={s} className="badge badge-skill">
                        {s}
                      </span>
                    ))}
                  </div>
                  <div className="oc-meta">
                    <span><MapPin size={13} strokeWidth={1.75} aria-hidden />{o.location || "TBD"}</span>
                    <span><Clock size={13} strokeWidth={1.75} aria-hidden />{o.duration_hours} hrs</span>
                    <span><RefreshCw size={13} strokeWidth={1.75} aria-hidden />{COMMITMENT[o.recurrence] || "One-time"}</span>
                    <span><Users size={13} strokeWidth={1.75} aria-hidden />{o.spots_remaining ?? 0}/{o.spots_available ?? 0} spots</span>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    {isRemote ? (
                      <span className="format-pip remote"><Globe size={12} strokeWidth={1.75} aria-hidden />Remote</span>
                    ) : isHybrid ? (
                      <span className="format-pip hybrid"><Shuffle size={12} strokeWidth={1.75} aria-hidden />Hybrid</span>
                    ) : (
                      <span className="format-pip inperson"><MapPin size={12} strokeWidth={1.75} aria-hidden />In-Person</span>
                    )}
                  </div>
                  <div className="oc-footer">
                    <span style={{ fontSize: ".73rem", color: "var(--muted)" }}>{relDate(o.start_time, o.timezone)}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      {(!user || user.role === "student") && (
                        <button
                          className={`icon-heart${savedIds.has(o.id) ? " on" : ""}`}
                          onClick={(e) => toggleSave(e, o.id)}
                          title="Save for later"
                          aria-label="Save opportunity for later"
                        >
                          {savedIds.has(o.id) ? "♥" : "♡"}
                        </button>
                      )}
                      <button className="btn-s" style={{ padding: "7px 14px", fontSize: ".78rem" }}>
                        View &amp; Apply
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </V1Shell>
  );
}
