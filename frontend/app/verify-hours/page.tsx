"use client";

import { errorText } from "@/lib/errors";
import { useState } from "react";

import { StudentCell } from "@/components/student-cell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { TOKEN_KEY, useAuth } from "@/lib/auth-context";
import { hoursTitle } from "@/lib/hours";
import { useAuthedQuery } from "@/lib/use-api";
import type { HoursWithOpportunity } from "@/lib/types";

const BULK_MAX = 200; // backend HoursBulkVerify caps ids at 200

export default function VerifyHoursPage() {
  const { user, loading } = useAuth();
  // The org side of GET /hours answers 403 until an admin approves the org (decision 3A,
  // 2026-10-09), so the fetch is held for an unapproved or rejected org (key null).
  const approvedOrg = user?.role === "org" && user.is_approved === true;
  const {
    data,
    loading: fetching,
    error: loadError,
    retry,
    mutate,
  } = useAuthedQuery(approvedOrg ? "hours/org-queue" : null, (t) => api.listHours(t));
  const entries = (data ?? []) as HoursWithOpportunity[];
  // Separate from `loadError`: this one reports a failed APPROVE/DENY, which the
  // user must see next to the row they acted on, not in place of the list.
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Deny is two steps (audit DY Low 33, 2026-10-07): one click opens an optional note
  // field, a second confirms. A misclick used to deny and notify the student at once.
  const [denyingId, setDenyingId] = useState<string | null>(null);
  const [denyNote, setDenyNote] = useState("");
  // Bulk approve (PRD M17.2, 2026-10-09); deny stays per row because it carries a note.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<string | null>(null);

  async function verifySelected(ids: string[]) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setError(null);
    setBulkBusy(true);
    try {
      const res = await api.verifyHoursBulk(ids, token);
      const counts = new Map<string, number>();
      for (const r of res.results) {
        if (r.outcome === "skipped" && r.reason) counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1);
      }
      const reasons = Array.from(counts, ([reason, n]) => `${n} ${reason.replace(/_/g, " ")}`).join(", ");
      setBulkSummary(
        `Verified ${res.verified}.` + (res.skipped > 0 ? ` Skipped ${res.skipped} (${reasons}).` : ""),
      );
      setSelected(new Set());
      void mutate();
    } catch (err) {
      setError(errorText(err, "We could not verify those hours. Check your connection and try again."));
    } finally {
      setBulkBusy(false);
    }
  }

  async function decide(hoursId: string, action: "approve" | "deny", note?: string) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setError(null);
    setBusyId(hoursId);
    try {
      await api.verifyHours(hoursId, action, token, note);
      setDenyingId(null);
      setDenyNote("");
      void mutate();
    } catch (err) {
      setError(errorText(err, "We could not verify that entry. Check your connection and try again."));
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

  const selectedIds = pending.filter((e) => selected.has(e.id)).map((e) => e.id);
  const allSelected = pending.length > 0 && selectedIds.length === pending.length;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <span className="section-tag">Organization</span>
        <h1 className="section-title">Verify hours</h1>
      </div>

      {/* Not OrgReviewBanner: that component is styled for the .v1 shell and this page is not in it.
          The queue is not fetched for an unapproved org, so say why instead of showing an empty list. */}
      {!approvedOrg && (
        <div className="empty-state">
          {user.org_reviewed_at
            ? "Your organization was not approved, so there are no hours to verify."
            : "Your organization is being reviewed. Hours to verify will appear here once it is approved."}
        </div>
      )}

      {approvedOrg && fetching && <p className="empty-state">Loading…</p>}

      {/* Not the empty state: telling an org "nothing to verify" because the
          request failed hides real students waiting on their hours. */}
      {!fetching && loadError && (
        <div className="empty-state flex flex-col items-center gap-3">
          <span>Could not load the verification queue. Check your connection and try again.</span>
          <Button variant="outline" onClick={retry}>Retry</Button>
        </div>
      )}

      {!fetching && !loadError && approvedOrg && pending.length === 0 && (
        <div className="empty-state">No hours awaiting verification.</div>
      )}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      {pending.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              aria-label="Select all hours awaiting verification"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(pending.map((e) => e.id)))}
            />
            Select all
          </label>
          <Button
            size="sm"
            disabled={selectedIds.length === 0 || bulkBusy}
            onClick={() => void verifySelected(selectedIds.slice(0, BULK_MAX))}
          >
            {/* The API takes at most 200 ids per call; a larger select-all sends the first 200. */}
            {selectedIds.length > BULK_MAX
              ? `Verify first ${BULK_MAX} of ${selectedIds.length} selected`
              : `Verify selected (${selectedIds.length})`}
          </Button>
        </div>
      )}
      {bulkSummary && (
        <p className="text-sm" role="status">
          {bulkSummary}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {pending.map((entry) => (
          <div key={entry.id} className="opp-card">
            <div className="flex items-start justify-between gap-3">
              <input
                type="checkbox"
                className="mt-1"
                aria-label={`Select ${entry.student_name ?? "this entry"}'s hours`}
                checked={selected.has(entry.id)}
                onChange={() => toggleOne(entry.id)}
              />
              <div className="min-w-0 flex-1">
                <h3 className="opp-title">
                  {hoursTitle(entry)}
                  {entry.status === "appealed" && <span className="badge badge-pending ml-2">Appealed</span>}
                </h3>
                {/* The card named only the listing, so an org could not tell whose hours it was
                    deciding (audit DY Low 33, 2026-10-07). */}
                <p className="text-sm">
                  <StudentCell name={entry.student_name} inactive={entry.student_inactive} />
                </p>
                <p className="opp-org">
                  {entry.hours}h · {SOURCE_LABEL[entry.source] ?? entry.source}
                </p>
                {entry.note && <p className="text-[length:var(--fs-label)] italic text-muted-foreground">“{entry.note}”</p>}
                {entry.status === "appealed" && entry.appeal_note && (
                  <p className="text-[length:var(--fs-label)] text-primary">Appeal: {entry.appeal_note}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" disabled={busyId === entry.id} onClick={() => decide(entry.id, "approve")}>
                  Verify
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === entry.id || denyingId === entry.id}
                  onClick={() => {
                    setDenyingId(entry.id);
                    setDenyNote("");
                  }}
                >
                  Deny
                </Button>
              </div>
            </div>
            {denyingId === entry.id && (
              <div className="mt-3 flex flex-col gap-2">
                <Input
                  aria-label="Reason for denying (optional)"
                  value={denyNote}
                  onChange={(e) => setDenyNote(e.target.value)}
                  placeholder="Reason (optional, the student sees it)"
                  maxLength={500}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === entry.id}
                    onClick={() => decide(entry.id, "deny", denyNote.trim() || undefined)}
                  >
                    Confirm deny
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busyId === entry.id} onClick={() => setDenyingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
