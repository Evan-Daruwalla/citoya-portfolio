"use client";

import { useState } from "react";

import { ApiError, api } from "@/lib/api";
import { TOKEN_KEY } from "@/lib/auth-context";
import { fmtDateKey } from "@/lib/event-time";
import { APPLICATION_STATUS_MESSAGE } from "@/lib/status";
import type { Opportunity } from "@/lib/types";
import { useAuthedQuery, usePublicQuery } from "@/lib/use-api";

// Date keys are the event's own calendar dates (D1); show them with their weekday.
const DAY: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };

export function SignupSection({ opp, onChange }: { opp: Opportunity; onChange: () => void }) {
  const recurring = opp.recurrence !== "one_time";
  // Public: `/date-spots` takes no token, same as the listing around it. The key is
  // held null on a one-time opportunity, whose endpoint returns `{}` by definition.
  //
  // Was `.catch(() => setError(...))` on a hand-rolled effect: an empty date list is
  // a REAL state (the series has no occurrences left), so a swallowed failure made
  // "couldn't load" indistinguishable from it. "Subscribe to all dates" works either
  // way (audit 2026-09-02) — that reassurance is kept in the error copy below.
  const {
    data: dateSpots,
    loading,
    error: loadError,
    retry,
  } = usePublicQuery(recurring ? `opportunities/${opp.id}/date-spots` : null, () =>
    api.dateSpots(opp.id, localStorage.getItem(TOKEN_KEY) ?? undefined),
  );
  const [mode, setMode] = useState<"all_dates" | "single_date">("all_dates");
  const [singleDate, setSingleDate] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  // The WRITE's error stays separate from the LOAD's. One `error` string served both
  // until this conversion, so the `setError(null)` at the top of `apply()` erased a
  // still-true date-load failure, and the failed apply's message replaced it. Same
  // split `reviews-section` and the parent page already make.
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // L9 (2026-09-22): this section never knew the student had ALREADY applied, so it
  // offered Apply again and the click came back 409 "Already applied". Same key the
  // hours page reads, so both see one list.
  const { data: myApps, loading: appsLoading, mutate: mutateMyApps } = useAuthedQuery(
    "applications/my",
    (t) => api.myApplications(t),
  );
  const shown = status ?? myApps?.find((a) => a.opportunity_id === opp.id)?.status ?? null;

  async function apply() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const body = recurring
        ? { subscription_type: mode, ...(mode === "single_date" ? { single_date: singleDate } : {}) }
        : undefined;
      const app = await api.apply(opp.id, token, body);
      setStatus(app.status);
      void mutateMyApps();
      onChange();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (shown) {
    return <p className="progress-label" style={{ color: "var(--green)", fontWeight: 600 }}>{APPLICATION_STATUS_MESSAGE[shown] ?? shown}</p>;
  }
  // Not an Apply button until we know — offering it and then swapping it for a
  // status is the same wrong offer, just briefer.
  if (appsLoading) {
    return <p className="progress-label" style={{ marginTop: 0 }}>Checking your signup…</p>;
  }

  if (!recurring) {
    const full = opp.spots_remaining <= 0;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
        <button className="btn-p" type="button" onClick={apply} disabled={submitting}>
          {submitting ? "Applying…" : full ? "Join waitlist" : "Apply"}
        </button>
        {submitError && <p className="ferr" style={{ marginBottom: 0 }}>{submitError}</p>}
      </div>
    );
  }

  // One non-optional map: `dates` and the counts read from the SAME object, so a
  // count can never fall back to a 0 the server never sent.
  const spots = dateSpots ?? {};
  const dates = Object.keys(spots);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* `.fr label` is uppercase-tracked and block — wrong for a radio row, so
            these keep inline layout and take the body font size directly. */}
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".84rem" }}>
          <input type="radio" name="signup" checked={mode === "all_dates"} onChange={() => setMode("all_dates")} />
          Subscribe to all dates
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".84rem" }}>
          <input
            type="radio"
            name="signup"
            checked={mode === "single_date"}
            onChange={() => setMode("single_date")}
          />
          Sign up for a single date
        </label>
      </div>

      {/* Shown in BOTH modes: it is also why the "Upcoming dates" line below is
          missing, which is otherwise indistinguishable from a series with none. */}
      {loadError && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
          <p className="ferr" style={{ marginBottom: 0 }}>
            {loadError instanceof ApiError && loadError.status >= 400 && loadError.status < 500
              ? loadError.message
              : "Couldn't load available dates. You can still subscribe to all dates."}
          </p>
          <button
            className="btn-s"
            type="button"
            onClick={retry}
            style={{ padding: "8px 16px", fontSize: ".8rem" }}
          >
            Retry
          </button>
        </div>
      )}

      {/* DATA WINS OVER ERROR, in that order: SWR keeps the last good dates when a
          background revalidation fails, and dropping a working control because a
          refresh blipped is worse than showing it under the notice above. `loading`
          is only true when there is no data at all, so the order stays coherent. */}
      {mode === "single_date" &&
        (loading ? (
          <p className="progress-label" style={{ marginTop: 0 }}>Loading dates…</p>
        ) : dates.length > 0 ? (
          <select
            className="fsel"
            value={singleDate}
            onChange={(e) => setSingleDate(e.target.value)}
          >
            <option value="">Choose a date…</option>
            {dates.map((d) => (
              <option key={d} value={d} disabled={spots[d] <= 0}>
                {fmtDateKey(d, DAY)} ({spots[d]} left)
              </option>
            ))}
          </select>
        ) : loadError ? null : (
          <p className="progress-label" style={{ marginTop: 0 }}>No upcoming dates in this series.</p>
        ))}

      <button
        className="btn-p"
        type="button"
        onClick={apply}
        disabled={submitting || (mode === "single_date" && !singleDate)}
      >
        {submitting ? "Applying…" : "Apply"}
      </button>
      {submitError && <p className="ferr" style={{ marginBottom: 0 }}>{submitError}</p>}
      {dates.length > 0 && (
        <p className="progress-label">
          Upcoming dates: {dates.slice(0, 5).map((d) => `${fmtDateKey(d, DAY)} (${spots[d]} left)`).join(" · ")}
        </p>
      )}
    </div>
  );
}
