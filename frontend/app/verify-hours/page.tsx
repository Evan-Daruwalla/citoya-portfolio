"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import { TOKEN_KEY, useAuth } from "@/lib/auth-context";
import { useAuthedQuery } from "@/lib/use-api";
import type { HoursWithOpportunity } from "@/lib/types";

export default function VerifyHoursPage() {
  const { user, loading } = useAuth();
  const {
    data,
    loading: fetching,
    error: loadError,
    retry,
    mutate,
  } = useAuthedQuery("hours/org-queue", (t) => api.listHours(t));
  const entries = (data ?? []) as HoursWithOpportunity[];
  // Separate from `loadError`: this one reports a failed APPROVE/DENY, which the
  // user must see next to the row they acted on, not in place of the list.
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function decide(hoursId: string, action: "approve" | "deny") {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setError(null);
    setBusyId(hoursId);
    try {
      await api.verifyHours(hoursId, action, token);
      void mutate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return null;

  if (!user || user.role !== "org") {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <p className="text-muted-foreground">Only organization accounts verify hours.</p>
      </main>
    );
  }

  const pending = entries.filter((e) => e.status === "pending" || e.status === "appealed");

  const SOURCE_LABEL: Record<string, string> = { auto: "auto-logged", self: "self-reported", checkin: "check-in" };

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <span className="section-tag">Organization</span>
        <h1 className="section-title">Verify Hours</h1>
      </div>

      {fetching && <p className="empty-state">Loading…</p>}

      {/* Not the empty state: telling an org "nothing to verify" because the
          request failed hides real students waiting on their hours. */}
      {!fetching && loadError && (
        <div className="empty-state flex flex-col items-center gap-3">
          <span>Couldn&apos;t load the verification queue. Check your connection and try again.</span>
          <Button variant="outline" onClick={retry}>Retry</Button>
        </div>
      )}

      {!fetching && !loadError && pending.length === 0 && (
        <div className="empty-state">No hours awaiting verification.</div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col gap-4">
        {pending.map((entry) => (
          <div key={entry.id} className="opp-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="opp-title">
                  {entry.opportunity.title}
                  {entry.status === "appealed" && <span className="badge badge-pending ml-2">Appealed</span>}
                </h3>
                <p className="opp-org">
                  {entry.hours}h · {SOURCE_LABEL[entry.source] ?? entry.source}
                </p>
                {entry.note && <p className="text-[0.8rem] italic text-muted-foreground">“{entry.note}”</p>}
                {entry.status === "appealed" && entry.appeal_note && (
                  <p className="text-[0.8rem] text-primary">Appeal: {entry.appeal_note}</p>
                )}
              </div>
              <div className="flex flex-shrink-0 gap-2">
                <Button size="sm" disabled={busyId === entry.id} onClick={() => decide(entry.id, "approve")}>
                  Verify
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === entry.id}
                  onClick={() => decide(entry.id, "deny")}
                >
                  Deny
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
