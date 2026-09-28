"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { V1Shell } from "@/components/v1/v1-shell";
import { useAuth } from "@/lib/auth-context";
import { INVITE_COPY, inviteState } from "@/lib/consent";

type Step = { title: string; body: string; href: string | null; link: string | null };

export default function WelcomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/register");
  }, [loading, user, router]);

  if (loading || !user) return null;

  const isStudent = user.role !== "org";
  const target = isStudent ? "/discover" : "/applicants";

  const consentPending = user.guardian_consent_status === "pending";
  const studentSteps: Step[] = [
    consentPending
      ? {
          // Only a SENT invite may claim an email (record AU's open item, 2026-09-27); a
          // failed one points at the dashboard, where the banner's Resend button lives.
          title: inviteState(user) === "failed" ? "Approval email not sent yet" : "Approval on the way",
          body: INVITE_COPY[inviteState(user)].welcome,
          href: inviteState(user) === "failed" ? "/dashboard" : null,
          link: inviteState(user) === "failed" ? "Open your dashboard" : null,
        }
      : {
          title: "Browse Discover",
          body: "See volunteer opportunities near you, filtered by cause and schedule.",
          href: "/discover",
          link: "Open Discover",
        },
    {
      title: "Apply to an opportunity",
      body: "Find one that fits and apply. The organization reviews your application and lets you know.",
      href: "/discover",
      link: "Find opportunities",
    },
    {
      title: "Log your hours",
      body: "After you attend, log your hours or check in with the org's code. Once they verify, the hours count toward your awards and build your portfolio.",
      href: "/dashboard",
      link: "Go to your dashboard",
    },
  ];

  const orgSteps: Step[] = [
    {
      title: "Post your first listing",
      body: "Describe the opportunity, set the date, time, and number of spots.",
      href: "/opportunities/new",
      link: "Create a listing",
    },
    {
      title: "Review applicants",
      body: "Approve or decline students who apply, all from your dashboard.",
      href: "/applicants",
      link: "Open your dashboard",
    },
    {
      title: "Verify hours",
      body: "After each event, confirm the hours students served so they count toward their awards.",
      href: "/applicants",
      link: "Verify hours",
    },
  ];

  const steps = isStudent ? studentSteps : orgSteps;
  const sub = isStudent
    ? "Here is how to find service and track your hours."
    : "Here is how to post opportunities and verify hours.";

  return (
    <V1Shell>
      <div className="detail-wrap">
        <div className="modal-card">
          <div className="mhdr">
            <div className="mtitle">Welcome to Citoya</div>
            <div className="msub">{sub}</div>
          </div>
          <div className="mbody">
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 18 }}>
              {steps.map((step, i) => (
                <li key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 6, background: "var(--green-pale)", border: "1px solid var(--green-mid)", color: "var(--green)", fontWeight: 700, fontSize: ".85rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {i + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--dark)", fontSize: ".95rem", marginBottom: 3 }}>{step.title}</div>
                    <div style={{ fontSize: ".85rem", color: "var(--muted)", lineHeight: 1.6 }}>{step.body}</div>
                    {step.href && step.link && (
                      <Link href={step.href} style={{ display: "inline-block", marginTop: 6, fontSize: ".82rem", color: "var(--green)", fontWeight: 600 }}>
                        {step.link} →
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <div style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap" }}>
              <button className="btn-p" onClick={() => router.push(target)}>Get started</button>
              <button className="btn-s" onClick={() => router.push(target)}>Skip for now</button>
            </div>
          </div>
        </div>
      </div>
    </V1Shell>
  );
}
