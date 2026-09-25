"use client";

import {
  BadgeCheck,
  Bell,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  FlaskConical,
  MapPin,
  Search,
  Sprout,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { V1Shell } from "@/components/v1/v1-shell";
import { api } from "@/lib/api";
import { usePublicQuery } from "@/lib/use-api";

export default function Home() {
  // Shares the "opportunities" cache with /discover, so arriving here and
  // clicking through no longer refetches the same list.
  // `error` is read, not just `data`: without it a failed load left this tile
  // showing "…" forever — a permanent loading state on the public landing page,
  // with no error and no retry (audit 2026-09-02, reproduced against a stopped
  // backend). "—" is the project's established failed-stat glyph.
  const { data, error } = usePublicQuery("opportunities", () => api.listOpportunities({}));
  const oppCount = data?.length ?? null;

  return (
    <V1Shell>
      {/* HERO */}
      <div className="hero">
        <div>
          <div className="hero-tag">Free forever for students. No catch.</div>
          <h1>
            Serve your community. <em>Build</em> your future.
          </h1>
          <p>
            Citoya matches students with volunteer work that fits their skills and interests,
            then verifies the hours, tracks award progress, and builds a portfolio for their
            applications.
          </p>
          <div className="hero-btns">
            <Link className="btn-p" href="/discover">
              Browse Opportunities
            </Link>
            <Link className="btn-s" href="/for-organizations">
              For Organizations
            </Link>
          </div>
          <div className="hero-stats">
            <div>
              <div className="hs-num">{error ? "—" : (oppCount ?? "…")}</div>
              <div className="hs-label">Active Listings</div>
            </div>
            <div>
              <div className="hs-num">Free</div>
              <div className="hs-label">For Students</div>
            </div>
            <div>
              <div className="hs-num">Verified</div>
              <div className="hs-label">Hour Tracking</div>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="mini-card">
            <div className="mc-icon" style={{ background: "#e8f5ef", color: "var(--green)" }}>
              <Sprout size={20} strokeWidth={1.75} aria-hidden />
            </div>
            <div>
              <div className="mc-title">Community Garden Helper</div>
              <div className="mc-sub">Green Roots Org · 1.2 mi</div>
            </div>
            <span className="mc-badge">4 hrs</span>
          </div>
          <div className="mini-card">
            <div className="mc-icon" style={{ background: "#eef4ff", color: "var(--blue)" }}>
              <BookOpen size={20} strokeWidth={1.75} aria-hidden />
            </div>
            <div>
              <div className="mc-title">Youth Literacy Tutor</div>
              <div className="mc-sub">City Library · Remote</div>
            </div>
            <span className="mc-badge">Flexible</span>
          </div>
          <div className="mini-card">
            <div className="mc-icon" style={{ background: "#fdf5e0", color: "var(--amber)" }}>
              <FlaskConical size={20} strokeWidth={1.75} aria-hidden />
            </div>
            <div>
              <div className="mc-title">STEM Workshop Helper</div>
              <div className="mc-sub">Future Engineers · 0.8 mi</div>
            </div>
            <span className="mc-badge">4 hrs</span>
          </div>
        </div>
      </div>

      {/* MARQUEE */}
      <div className="marquee-band">
        <div className="marquee-track">
          {[
            "Education", "Environment", "Animals", "Food & Hunger", "Health",
            "Arts & Culture", "STEM", "Community", "Agriculture",
          ]
            .concat([
              "Education", "Environment", "Animals", "Food & Hunger", "Health",
              "Arts & Culture", "STEM", "Community", "Agriculture",
            ])
            .map((c, i) => (
              <span key={i}>{c}</span>
            ))}
        </div>
      </div>

      {/* STATS BAR */}
      <div className="stats-bar">
        <div>
          <div className="sb-num">Free forever</div>
          <div className="sb-label">For students</div>
        </div>
        <div>
          <div className="sb-num">Verified</div>
          <div className="sb-label">Hour tracking</div>
        </div>
        <div>
          <div className="sb-num">Guardian consent</div>
          <div className="sb-label">Required for minors</div>
        </div>
        <div>
          <div className="sb-num">Public</div>
          <div className="sb-label">Org reviews</div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="section">
        <div className="sec-tag">How it works</div>
        <h2 className="sec-title">From sign-up to award in four steps</h2>
        <div className="hiw-grid" style={{ marginTop: 24 }}>
          <div className="hiw-step">
            <div className="hiw-icon"><Search size={26} strokeWidth={1.75} aria-hidden /></div>
            <h4>Discover &amp; Filter</h4>
            <p>Search by skill, ZIP code, cause, date, or time commitment. Read reviews from other volunteers before you sign up.</p>
          </div>
          <div className="hiw-step">
            <div className="hiw-icon"><CalendarDays size={26} strokeWidth={1.75} aria-hidden /></div>
            <h4>Sign Up &amp; Sync</h4>
            <p>One-click signup with conflict warnings, waitlists for full events, and calendar sync to your phone.</p>
          </div>
          <div className="hiw-step">
            <div className="hiw-icon"><BadgeCheck size={26} strokeWidth={1.75} aria-hidden /></div>
            <h4>Verified Hours</h4>
            <p>Hours log automatically after events, and supervisors verify them. No more paper signature sheets.</p>
          </div>
          <div className="hiw-step">
            <div className="hiw-icon"><Trophy size={26} strokeWidth={1.75} aria-hidden /></div>
            <h4>Awards &amp; Portfolio</h4>
            <p>Track verified-hour milestones and export a transcript for your applications.</p>
          </div>
        </div>
      </div>

      {/* BENTO */}
      <div className="section">
        <div className="sec-tag">Why Citoya</div>
        <h2 className="sec-title">Everything you need to volunteer, and prove it</h2>
        <div className="bento">
          <div className="bento-card feature b-2x2">
            <div className="bi"><BadgeCheck size={26} strokeWidth={1.75} aria-hidden /></div>
            <h3>Verified hours, logged automatically</h3>
            <p>Hours log themselves after each event, then supervisors verify them in a tap. No paper signature sheets, no chasing anyone down. Your record stays tamper-proof and ready to export.</p>
            <span className="mc-badge" style={{ alignSelf: "flex-start", marginTop: "auto" }}>
              Tamper-proof records
            </span>
          </div>
          <div className="bento-card">
            <div className="bi"><Target size={26} strokeWidth={1.75} aria-hidden /></div>
            <h4>Matched to you</h4>
            <p>Filter by skill, cause, date, and time commitment.</p>
          </div>
          <div className="bento-card">
            <div className="bi"><MapPin size={26} strokeWidth={1.75} aria-hidden /></div>
            <h4>Near you</h4>
            <p>Real-time distance from your location or ZIP code.</p>
          </div>
          <div className="bento-card gold b-2x1">
            <div className="bi"><Trophy size={26} strokeWidth={1.75} aria-hidden /></div>
            <h4>Awards &amp; a portfolio worth showing</h4>
            <p>Track verified-hour milestones, share a public portfolio if you choose, and export a transcript for college and job applications.</p>
          </div>
          <div className="bento-card">
            <div className="bi"><CalendarPlus size={26} strokeWidth={1.75} aria-hidden /></div>
            <h4>Calendar sync</h4>
            <p>Add shifts to your phone in one tap.</p>
          </div>
          <div className="bento-card">
            <div className="bi"><Bell size={26} strokeWidth={1.75} aria-hidden /></div>
            <h4>Smart waitlists</h4>
            <p>Auto-promoted the moment a spot frees up.</p>
          </div>
          <div className="bento-card b-2x1">
            <div className="bi"><Users size={26} strokeWidth={1.75} aria-hidden /></div>
            <h4>Reviews from volunteers</h4>
            <p>Students rate and review organizations publicly, so you can see what you&apos;re signing up for before you apply.</p>
          </div>
        </div>
      </div>

      {/* PLEDGE */}
      <div className="pledge-band">
        <h2>
          Free for students. <em>Forever.</em>
        </h2>
        <p>
          That&apos;s our pledge. Citoya runs on organization Pro plans and community
          supporters, never on student fees. Every dollar keeps verified volunteering free for
          students.
        </p>
        <div className="pledge-btns">
          <Link className="btn-gold" href="/register">
            Sign Up
          </Link>
          <Link className="btn-ghost" href="/leaderboard">
            Community Impact →
          </Link>
        </div>
      </div>
    </V1Shell>
  );
}
