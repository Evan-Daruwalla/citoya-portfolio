"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { APPLICATION_STATUS_LABEL, APPLICATION_STATUS_PILL } from "@/lib/status";
import { useAuthedQuery } from "@/lib/use-api";

export default function MyApplicationsPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    data: applications,
    loading,
    error,
    retry,
  } = useAuthedQuery("applications/my", (t) => api.myApplications(t));

  if (authLoading) return null;

  if (!user || user.role !== "student") {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <p className="text-muted-foreground">Only student accounts have applications.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <span className="section-tag">Your activity</span>
        <h1 className="section-title">My Applications</h1>
      </div>

      {loading && <p className="empty-state">Loading…</p>}

      {/* An error must never fall through to the empty state below: "nothing here
          yet" for a student who has applications, because the request failed, is
          the bug this page shipped until 2026-08-31 (no .catch at all). */}
      {!loading && error && (
        <div className="empty-state flex flex-col items-center gap-3">
          <span>Couldn&apos;t load your applications. Check your connection and try again.</span>
          <Button variant="outline" onClick={retry}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && applications?.length === 0 && (
        <div className="empty-state">Nothing here yet. Once you apply to an opportunity, it shows up here.</div>
      )}

      <div className="flex flex-col gap-4">
        {applications?.map((app) => (
          <Link key={app.id} href={`/opportunities/${app.opportunity.id}`} className="opp-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="opp-title">{app.opportunity.title}</h3>
                <p className="opp-org">{app.opportunity.org_name}</p>
              </div>
              <span className={`status-pill ${APPLICATION_STATUS_PILL[app.status] ?? "sp-pending"}`}>
                {APPLICATION_STATUS_LABEL[app.status] ?? app.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
