"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useAuthedQuery } from "@/lib/use-api";

export default function SavedPage() {
  const { user, loading } = useAuth();
  const {
    data: opportunities,
    loading: fetching,
    error,
    retry,
  } = useAuthedQuery("saved", (t) => api.listSaved(t));

  if (loading) return null;

  if (!user || user.role !== "student") {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <p className="text-muted-foreground">Only student accounts have bookmarks.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <span className="section-tag">Your activity</span>
        <h1 className="section-title">Saved</h1>
      </div>

      {fetching && <p className="empty-state">Loading…</p>}

      {/* Missed by the first pass of this migration: the census grepped for
          `api.` and this call breaks the line after `api`, so the page looked
          converted when it was not (landing-check 2026-09-01). It carried the
          same bug as the other five — a failed load told a student with
          bookmarks they had none. */}
      {!fetching && error && (
        <div className="empty-state flex flex-col items-center gap-3">
          <span>Couldn&apos;t load your bookmarks. Check your connection and try again.</span>
          <Button variant="outline" onClick={retry}>Retry</Button>
        </div>
      )}

      {!fetching && !error && opportunities?.length === 0 && (
        <div className="empty-state">No bookmarks yet. Tap the heart on any opportunity.</div>
      )}

      <div className="flex flex-col gap-4">
        {opportunities?.map((opp) => (
          <Link key={opp.id} href={`/opportunities/${opp.id}`} className="opp-card">
            <h3 className="opp-title">{opp.title}</h3>
            <p className="opp-org">
              {opp.org_name} · {opp.category} · {opp.location}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
