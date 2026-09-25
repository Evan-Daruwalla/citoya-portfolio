"use client";

import { useState } from "react";

import { ApiError, api } from "@/lib/api";
import { TOKEN_KEY } from "@/lib/auth-context";
import { eventDateKey, fmtDateKey } from "@/lib/event-time";
import type { Opportunity } from "@/lib/types";
import { usePublicQuery } from "@/lib/use-api";

/** Shown to the owning org: generate a per-date check-in code attendees redeem for hours. */
export function OrgCheckinSection({ opp }: { opp: Opportunity }) {
  // A one-time listing has exactly one date and it is already in the prop — no
  // request, and no effect either: deriving it during render is what removes the
  // `set-state-in-effect` warning this file used to own.
  const oneTimeDate =
    opp.recurrence === "one_time" ? eventDateKey(opp.start_time, opp.timezone) : null;

  // The SAME key `signup-section.tsx` uses for the same endpoint, because the key
  // convention is "one key, one fetcher, one meaning" — not because the two ever
  // share a render. They cannot: `page.tsx:145` mounts SignupSection only for a
  // student and `:178` mounts this only for the owning org. What the shared key
  // actually buys is a warm cache across client-side navigation within a session,
  // and one place to invalidate if date-spots ever gains a push event.
  const {
    data: spots,
    loading,
    error: loadError,
    retry,
  } = usePublicQuery(oneTimeDate ? null : `opportunities/${opp.id}/date-spots`, () =>
    api.dateSpots(opp.id, localStorage.getItem(TOKEN_KEY) ?? undefined),
  );

  const dates = oneTimeDate ? [oneTimeDate] : Object.keys(spots ?? {});
  // "Whatever the org picked, else the first date we have" — the default follows
  // the data without an effect writing state back into the component.
  const [picked, setPicked] = useState("");
  const date = picked || dates[0] || "";

  const [code, setCode] = useState<string | null>(null);
  // The WRITE's error stays separate from the LOAD's. One `error` served both
  // until this conversion, so `generate()`'s reset erased a still-true failure to
  // load the dates. Same split as `signup-section`.
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !date) return;
    setSubmitError(null);
    setBusy(true);
    try {
      const res = await api.createCheckinCode(opp.id, date, token);
      setCode(res.code);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-card">
      <div className="mbody" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 className="mtitle" style={{ marginBottom: 0 }}>Check-in codes</h2>
        <p className="progress-label" style={{ marginTop: 0 }}>
          {/* "only on that day": T9 (2026-09-22) — the server refuses a code on any other
              date, so an org that shares one early or late must hear it here first. */}
          Generate a code and share it at the event. Signed-up volunteers redeem it for instantly-verified
          hours, only on that day.
        </p>

        {/* Four distinct states. Before this conversion, three of them looked the
            same: in flight, no dates left, and a failed load all rendered an empty
            select beside a Generate button disabled by `!date`. */}
        {loading ? (
          <p className="progress-label" style={{ marginTop: 0 }}>Loading dates…</p>
        ) : dates.length > 0 ? (
          <div style={{ display: "flex", gap: 8 }}>
            <select
              className="fsel"
              style={{ flex: 1 }}
              value={date}
              onChange={(e) => setPicked(e.target.value)}
            >
              {dates.map((d) => (
                <option key={d} value={d}>
                  {fmtDateKey(d, { weekday: "short", month: "short", day: "numeric" })}
                </option>
              ))}
            </select>
            <button
              className="btn-p"
              type="button"
              onClick={generate}
              disabled={busy || !date}
              style={{ padding: "9px 18px", fontSize: ".83rem" }}
            >
              {busy ? "…" : "Generate"}
            </button>
          </div>
        ) : loadError ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
            <p className="ferr" style={{ marginBottom: 0 }}>
              {loadError instanceof ApiError && loadError.status >= 400 && loadError.status < 500
                ? loadError.message
                : "Couldn't load this listing's dates."}
            </p>
            {/* Was "Reload to try again." — the component had no way back short of a
                full page load, which also threw away everything else on the page. */}
            <button
              className="btn-s"
              type="button"
              onClick={retry}
              style={{ padding: "8px 16px", fontSize: ".8rem" }}
            >
              Retry
            </button>
          </div>
        ) : (
          <p className="progress-label" style={{ marginTop: 0 }}>
            No upcoming dates in this series, so there is nothing to generate a code for.
          </p>
        )}

        {code && (
          <p style={{ fontSize: ".84rem", color: "var(--text)", margin: 0 }}>
            Code for {date}:{" "}
            <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "1.05rem", fontWeight: 700, letterSpacing: ".18em", color: "var(--green)" }}>
              {code}
            </span>
          </p>
        )}
        {submitError && <p className="ferr" style={{ marginBottom: 0 }}>{submitError}</p>}
      </div>
    </div>
  );
}
