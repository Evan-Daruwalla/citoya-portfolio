/**
 * Event times, shown in the EVENT's timezone (D1, Evan 2026-09-22).
 *
 * Every listing carries an IANA zone. Times render in that zone, and the zone's name
 * is appended ONLY when the viewer's own clock would read differently at that
 * instant — "6:30 PM" for a viewer in Central, "6:30 PM CST" for one in Pacific.
 * "Differently" is decided by UTC offset at the event's instant, not by zone name,
 * so America/Chicago and America/Winnipeg (same clock) show no suffix to each other.
 *
 * Date-only KEYS ("2026-11-10": occurrence dates, check-in dates, hours rows) are
 * already dates in the event's zone. They are formatted as-is, never through a Date
 * in the viewer's zone — that shift is exactly the `fmtDate` bug that showed every US
 * viewer the day before (Appendix AD).
 */

/** The API sends UTC instants; SQLite in dev drops the zone, and naive means UTC. */
export function eventInstant(iso: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
}

export function viewerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function offsetAt(d: Date, timeZone: string): string {
  // "GMT-05:00" — the offset that zone's clocks show at this instant.
  return (
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value ?? ""
  );
}

/** Whether the viewer's clock reads the same as the event's at this instant. */
export function sameClockAsViewer(iso: string, timeZone: string): boolean {
  const d = eventInstant(iso);
  return offsetAt(d, timeZone) === offsetAt(d, viewerTimeZone());
}

/** "Nov 10, 2026, 6:30 PM", plus " CST" only for a viewer whose clock differs. */
export function fmtEventDateTime(iso: string, timeZone: string): string {
  const d = eventInstant(iso);
  if (Number.isNaN(d.getTime())) return "—";
  // Explicit fields, not dateStyle/timeStyle: Intl throws a TypeError when those are
  // combined with timeZoneName, i.e. exactly on the branch that needs the suffix.
  return d.toLocaleString(undefined, {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(sameClockAsViewer(iso, timeZone) ? {} : { timeZoneName: "short" }),
  });
}

/** "Nov 10, 2026" — the event's own calendar date. */
export function fmtEventDate(iso: string, timeZone: string): string {
  const d = eventInstant(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { timeZone, month: "short", day: "numeric", year: "numeric" });
}

/** The event's calendar date as a key: "2026-11-10". */
export function eventDateKey(iso: string, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    eventInstant(iso),
  );
}

/** Calendar days from today to the event's date, both dates in the EVENT's zone (F22:
 *  a raw millisecond difference called a 9 AM event "Today" at 10 PM the night before). */
export function daysUntilEventDate(iso: string, timeZone: string, now: Date = new Date()): number {
  const day = (key: string) => Date.parse(`${key}T00:00:00Z`);
  return Math.round((day(eventDateKey(iso, timeZone)) - day(eventDateKey(now.toISOString(), timeZone))) / 86400000);
}

/** A local calendar-cell date as the same kind of key. */
export function localDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Format a date-only key without letting the viewer's zone move it a day. */
export function fmtDateKey(key: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }): string {
  const d = new Date(`${key}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { ...opts, timeZone: "UTC" });
}
