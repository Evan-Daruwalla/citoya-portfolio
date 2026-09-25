"use client";

import { BadgeCheck, ClipboardList, MessagesSquare, Star } from "lucide-react";
import Link from "next/link";

import { V1Shell } from "@/components/v1/v1-shell";

export default function ForOrganizationsPage() {
  return (
    <V1Shell>
      <div className="section">
        <div style={{ maxWidth: 680 }}>
          <div className="sec-tag">For Organizations</div>
          <h2 className="sec-title">Reach motivated student volunteers</h2>
          <p className="sec-sub" style={{ maxWidth: 600 }}>
            Post volunteer opportunities, manage your roster, verify hours, and message students directly.
          </p>
        </div>

        <div className="bento" style={{ marginTop: 36, marginBottom: 36 }}>
          <div className="bento-card feature b-2x2">
            <div className="bi"><ClipboardList size={26} strokeWidth={1.75} aria-hidden /></div>
            <h3>Post free listings in minutes</h3>
            <p>Set requirements, spots, dates, and formats, then let students find you. Up to 3 active listings free, unlimited with Pro.</p>
            <span className="mc-badge" style={{ alignSelf: "flex-start", marginTop: "auto" }}>No cost to start</span>
          </div>
          <div className="bento-card"><div className="bi"><BadgeCheck size={26} strokeWidth={1.75} aria-hidden /></div><h4>Verify hours</h4><p>Approve volunteer hours from your dashboard, and students get verified records instantly.</p></div>
          <div className="bento-card"><div className="bi"><MessagesSquare size={26} strokeWidth={1.75} aria-hidden /></div><h4>Message volunteers</h4><p>Push updates, reminders, and changes to signed-up students.</p></div>
          <div className="bento-card gold b-2x1"><div className="bi"><Star size={26} strokeWidth={1.75} aria-hidden /></div><h4>Reviews build your reputation</h4><p>Students rate and review organizations publicly. Strong reviews bring more applicants to your next listing.</p></div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="btn-p" href="/register">Register Your Organization</Link>
          <Link className="btn-s" href="/pricing">View Pricing →</Link>
        </div>
        <p style={{ fontSize: ".8rem", color: "var(--muted)", marginTop: 14 }}>
          Start free with up to 3 active listings. Analytics are free for every organization. Upgrade to Pro for unlimited listings and featured placement.
        </p>
      </div>
    </V1Shell>
  );
}
