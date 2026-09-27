// Pure helpers for a student's hours (2026-09-27). Off-site entries (status
// "unverified", no listing) must never add into a verified or pending number, so the
// totals live here, once, held by backend/tests/test_frontend_hours.py.
import type { HoursWithOpportunity } from "./types";

type HoursRow = Pick<HoursWithOpportunity, "status" | "hours" | "opportunity" | "activity">;
type DatedHoursRow = HoursRow & Pick<HoursWithOpportunity, "occurrence_date" | "created_at">;

/**
 * The day the hours were for: the occurrence date, or the viewer's local date of
 * `created_at` for a row that has none (a self-report). Same arithmetic as
 * `localDateKey` in lib/event-time.ts, repeated so this module stays import-free
 * for the Node test.
 */
export function hoursDateKey(h: Pick<HoursWithOpportunity, "occurrence_date" | "created_at">): string {
  if (h.occurrence_date) return h.occurrence_date;
  const d = new Date(h.created_at);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export interface ReportRow {
  date: string;
  title: string;
  org: string | null; // null for off-site hours: no organization on Citoya
  hours: number;
  status: HoursWithOpportunity["status"];
}

/** Every row for the hours PDF (M16.2), oldest first. */
export function reportRows(rows: DatedHoursRow[]): ReportRow[] {
  return rows
    .map((h) => ({
      date: hoursDateKey(h),
      title: hoursTitle(h),
      org: h.opportunity?.org_name ?? null,
      hours: h.hours,
      status: h.status,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** The row's name: the listing's title, or the student's own words for off-site hours. */
export function hoursTitle(h: HoursRow): string {
  return h.opportunity?.title ?? h.activity ?? "Volunteering";
}

export interface HoursTotals {
  verified: number;
  pending: number; // pending + appealed: waiting on an organization
  offsite: number; // self-reported outside Citoya, never verified
  total: number; // every listing-backed row, denied included (the sidebar's "Total Logged")
}

export function hoursTotals(rows: HoursRow[]): HoursTotals {
  const t: HoursTotals = { verified: 0, pending: 0, offsite: 0, total: 0 };
  for (const h of rows) {
    if (h.status === "unverified") {
      t.offsite += h.hours;
      continue;
    }
    t.total += h.hours;
    if (h.status === "verified") t.verified += h.hours;
    else if (h.status === "pending" || h.status === "appealed") t.pending += h.hours;
  }
  return t;
}
