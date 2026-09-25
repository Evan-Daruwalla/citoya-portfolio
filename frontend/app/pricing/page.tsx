"use client";

import { GraduationCap, Star } from "lucide-react";
import Link from "next/link";

import { V1Shell } from "@/components/v1/v1-shell";
import { BILLING_LIVE } from "@/lib/flags";

const FAQ = [
  {
    q: "Why isn’t Citoya free for organizations too?",
    a: "The Community plan is free and always will be, and most small organizations never need more. Pro subscriptions from larger organizations fund hosting and verification, which is how students stay free.",
  },
  {
    q: "What does “Featured” actually do?",
    a: "Featured listings are pinned to the top of every student’s search results with a gold highlight. Pro orgs can feature up to 3 listings at a time and swap them whenever they like.",
  },
  {
    q: "Can I cancel Pro anytime?",
    a: "Yes. Downgrade with one click. Your existing listings stay live; you just can’t add new ones beyond the Community limit, and featured pins are released.",
  },
  {
    q: "How do I know an organization is legit?",
    a: "Students rate and review organizations publicly, and every hour you log has to be verified by the organization before it counts. Nothing on a transcript comes from an unconfirmed source.",
  },
];

export default function PricingPage() {
  return (
    <V1Shell>
      <div className="section" style={{ textAlign: "center" }}>
        <div className="sec-tag" style={{ justifyContent: "center" }}>For Organizations</div>
        <h2 className="sec-title" style={{ fontSize: "2.4rem" }}>
          Free for students. <em style={{ color: "var(--green-l)", fontStyle: "italic" }}>Fair</em> for organizations.
        </h2>
        <p className="sec-sub" style={{ margin: "0 auto" }}>
          Start free, upgrade when you’re ready to grow. Org plans fund the platform so students never have to pay.
        </p>

        <div className="price-grid">
          <div className="price-card">
            <div className="pc-name">Community</div>
            <div className="pc-price">$0<span> / forever</span></div>
            <div className="pc-blurb">Everything a small organization needs to recruit student volunteers.</div>
            <ul className="pc-list">
              <li>Up to 3 active listings</li>
              <li>Applicant management &amp; approvals</li>
              <li>One-click &amp; bulk hour verification</li>
              <li>Direct messaging with volunteers</li>
              <li>Public organization page with reviews</li>
              <li>Skill endorsements for students</li>
            </ul>
            <div><Link className="btn-s" style={{ width: "100%", display: "block", textAlign: "center" }} href="/register">Start Free</Link></div>
          </div>
          <div className="price-card pro">
            <div className="pc-flag">Most Popular</div>
            <div className="pc-name">Pro <Star size={16} strokeWidth={1.75} aria-hidden style={{ color: "var(--gold)" }} /></div>
            <div className="pc-price">$19<span> / month</span></div>
            <div className="pc-blurb">For organizations that run many programs and want to grow faster.</div>
            <ul className="pc-list">
              <li>Everything in Community</li>
              <li className="pc-star">Unlimited active listings</li>
              <li className="pc-star">3 Featured listings, pinned to the top of search</li>
              <li className="pc-star">Volunteer roster CSV export</li>
              <li className="pc-star">Priority support</li>
            </ul>
            <div>{BILLING_LIVE ? (
              <Link className="btn-p" style={{ width: "100%", display: "block", textAlign: "center" }} href="/register">Get Pro</Link>
            ) : (
              <span className="btn-s" style={{ width: "100%", display: "block", textAlign: "center", cursor: "default" }} aria-disabled="true">Launching soon</span>
            )}</div>
          </div>
        </div>

        <div className="student-free-note">
          <GraduationCap size={16} strokeWidth={1.75} aria-hidden /> <strong>Students never pay. Ever.</strong> Browsing, signing up, hour verification, awards, portfolios, and transcripts are free forever. That’s the whole point of Citoya.
        </div>
        <p style={{ fontSize: ".76rem", color: "var(--muted)", marginTop: 14 }}>
          {BILLING_LIVE
            ? "Checkout is in demo mode right now, so no payment is collected."
            : "Pro subscriptions aren’t open yet — every organization starts on the free Community plan. Pro features arrive after launch."}
        </p>

        <div className="faq-wrap">
          <h3 style={{ color: "var(--dark)", marginBottom: 14, textAlign: "center" }}>Common questions</h3>
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </V1Shell>
  );
}
