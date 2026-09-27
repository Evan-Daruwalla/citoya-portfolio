"use client";

// The dashboard's Calendar tab (M16.4, 2026-09-27). One month at a time from
// `GET /calendar/mine`, which is also what the calendar feed serves: approved signups,
// every occurrence (excluded dates and single-date subscriptions honored), plus the
// student's own events. Before this the tab drew one chip per application whatever its
// status, and only a recurring event's first date. Rendered inside the dashboard's .v1
// shell.
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { ApiError, api } from "@/lib/api";
import { TOKEN_KEY } from "@/lib/auth-context";
import { fmtDateKey, localDateKey, viewerTimeZone } from "@/lib/event-time";
import type { CalendarItem } from "@/lib/types";
import { useAuthedQuery } from "@/lib/use-api";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function timeLabel(item: CalendarItem): string {
  if (item.all_day || !item.starts_at) return "All day";
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZone: item.timezone };
  const start = new Date(item.starts_at).toLocaleTimeString(undefined, opts);
  return item.ends_at ? `${start} to ${new Date(item.ends_at).toLocaleTimeString(undefined, opts)}` : start;
}

export function CalendarPanel() {
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const next = new Date(first.getFullYear(), first.getMonth() + 1, 1);
  const startKey = localDateKey(first);
  const endKey = localDateKey(next);
  const calQ = useAuthedQuery(`calendar/${startKey}`, (t) => api.myCalendar(startKey, endKey, t));
  const items = calQ.data ?? [];

  const gridStart = new Date(first);
  gridStart.setDate(1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
  const byDay = new Map<string, CalendarItem[]>();
  for (const it of items) byDay.set(it.date, [...(byDay.get(it.date) ?? []), it]);

  // Add-an-event form
  const today = localDateKey(now);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !title.trim()) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await api.createCalendarEvent(
        {
          title: title.trim(),
          date,
          start_time: startTime || undefined,
          end_time: startTime && endTime ? endTime : undefined,
          // The event's own zone, like a listing's: its times never move when the
          // clocks change.
          timezone: viewerTimeZone(),
          location: location.trim() || undefined,
          note: note.trim() || undefined,
        },
        token,
      );
      setTitle("");
      setStartTime("");
      setEndTime("");
      setLocation("");
      setNote("");
      setMessage(`Added to ${fmtDateKey(date)}.`);
      void calQ.mutate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that event.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: CalendarItem) {
    if (!window.confirm(`Delete "${item.title}" on ${fmtDateKey(item.date)}?`)) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setError(null);
    try {
      await api.deleteCalendarEvent(item.id, token);
      void calQ.mutate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete that event.");
    }
  }

  return (
    <>
      <div className="cal-wrap">
        <div className="cal-hdr">
          <button type="button" className="goal-btn" aria-label="Previous month" onClick={() => setOffset(offset - 1)}>
            <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
          </button>
          <span className="cal-title">{first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
          <button type="button" className="goal-btn" aria-label="Next month" onClick={() => setOffset(offset + 1)}>
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <div className="cal-grid">
          {DOW.map((d) => (
            <div key={d} className="cal-day-head">{d}</div>
          ))}
          {days.map((d) => {
            const key = localDateKey(d);
            const otherMonth = d.getMonth() !== first.getMonth();
            return (
              <div key={key} className={`cal-day${otherMonth ? " other-month" : ""}${key === today ? " today" : ""}`}>
                <div className="cal-date">{d.getDate()}</div>
                {(byDay.get(key) ?? []).map((it) =>
                  it.kind === "signup" ? (
                    <Link
                      key={it.id}
                      href={`/opportunities/${it.opportunity_id}`}
                      className="cal-event"
                      title={`${it.title}, ${timeLabel(it)}${it.location ? `, ${it.location}` : ""}`}
                    >
                      {it.title}
                    </Link>
                  ) : (
                    <button
                      key={it.id}
                      type="button"
                      className="cal-event personal"
                      title={`${it.title}, ${timeLabel(it)}. Click to delete.`}
                      aria-label={`${it.title}, ${timeLabel(it)}. Delete this event`}
                      onClick={() => remove(it)}
                    >
                      {it.title}
                    </button>
                  ),
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="cal-legend">
        <span><i className="cal-swatch" /> Your signups</span>
        <span><i className="cal-swatch personal" /> Your own events (only you see these)</span>
      </div>
      {calQ.error && (
        <p className="ferr" style={{ marginTop: 12 }}>
          Couldn&apos;t load this month.{" "}
          <button type="button" className="btn-s" style={{ padding: "4px 12px", fontSize: ".78rem" }} onClick={calQ.retry}>Retry</button>
        </p>
      )}
      {calQ.data !== undefined && items.length === 0 && (
        <p className="progress-label" style={{ marginTop: 12 }}>Nothing this month: <Link href="/discover">find an opportunity</Link>, or add your own event below.</p>
      )}

      <div className="form-box" style={{ marginTop: 16 }}>
        <form onSubmit={add}>
          <div className="fr"><label htmlFor="cal-event-title">Add your own event</label></div>
          <p className="progress-label" style={{ marginTop: 0, marginBottom: 12 }}>For volunteering you arranged yourself. Only you see it, and it does not log hours: after it happens, log the time under Log Hours.</p>
          <div className="fr"><input id="cal-event-title" className="fsel" style={{ width: "100%" }} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What and where" /></div>
          <div className="checkin-bar">
            <input className="fsel" aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <input className="fsel" aria-label="Start time (optional)" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            <input className="fsel" aria-label="End time (optional)" type="time" value={endTime} disabled={!startTime} onChange={(e) => setEndTime(e.target.value)} />
            <input className="fsel" aria-label="Location (optional)" style={{ flex: 1, minWidth: 140 }} maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (optional)" />
          </div>
          <div className="fr"><input className="fsel" aria-label="Note for the event (optional)" style={{ width: "100%" }} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" /></div>
          <button className="btn-p" type="submit" style={{ padding: "9px 18px", fontSize: ".82rem" }} disabled={busy || !title.trim()}>Add event</button>
        </form>
      </div>
      {message && <p className="progress-label">{message}</p>}
      {error && <p className="ferr">{error}</p>}
    </>
  );
}
