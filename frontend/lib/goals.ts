// Goal periods and progress (M16.3, 2026-09-27), held by backend/tests/test_frontend_goals.py.
//
// Periods are counted on calendar-date keys (YYYY-MM-DD) with UTC arithmetic, never on
// clock time, so a daylight-saving change cannot move a boundary. Week, month and year
// periods repeat from the goal's start date; month steps are always counted FROM THE
// START DATE, so a goal started on the 31st clamps to the last day of shorter months
// without drifting to the 28th for good. calendar_year resets on January 1. Verified
// and off-site ("unverified") hours count; pending, appealed and denied do not.
// Import-free on purpose, so Node can load it in the test.

export type GoalPeriod = "all" | "week" | "month" | "year" | "calendar_year" | "custom";

export interface GoalDef {
  id: string;
  title: string;
  target_hours: number;
  period: GoalPeriod | string;
  every: number | null;
  unit: string | null;
  start_date: string;
  position: number;
}

export interface GoalEntry {
  date: string; // YYYY-MM-DD, the day the hours were for
  hours: number;
  status: string;
}

export interface GoalWindow {
  start: string; // inclusive
  end: string; // exclusive
}

export interface GoalProgress {
  done: number;
  met: boolean;
  window: GoalWindow | null;
}

const COUNTS = new Set(["verified", "unverified"]);

function parts(key: string): [number, number, number] {
  const [y, m, d] = key.split("-").map(Number);
  return [y, m - 1, d];
}

function keyOf(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

function utc(key: string): number {
  const [y, m, d] = parts(key);
  return Date.UTC(y, m, d);
}

function addDays(key: string, n: number): string {
  return keyOf(utc(key) + n * 86_400_000);
}

function addMonths(key: string, n: number): string {
  const [y, m, d] = parts(key);
  const total = m + n;
  const year = y + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return keyOf(Date.UTC(year, month, Math.min(d, last)));
}

export function periodWindow(goal: GoalDef, today: string): GoalWindow | null {
  if (goal.period === "all") return null;
  if (goal.period === "calendar_year") {
    const y = Number(today.slice(0, 4));
    return { start: `${y}-01-01`, end: `${y + 1}-01-01` };
  }
  const start = goal.start_date;
  const every = goal.every ?? 1;
  const dayStep =
    goal.period === "week" ? 7 : goal.period === "custom" && goal.unit === "day" ? every
      : goal.period === "custom" && goal.unit === "week" ? every * 7 : 0;
  if (dayStep > 0) {
    const k = today < start ? 0 : Math.floor((utc(today) - utc(start)) / (dayStep * 86_400_000));
    const s = addDays(start, k * dayStep);
    return { start: s, end: addDays(s, dayStep) };
  }
  const monthStep = goal.period === "month" ? 1 : goal.period === "year" ? 12 : every;
  let k = 0;
  if (today >= start) {
    const [ty, tm] = parts(today);
    const [sy, sm] = parts(start);
    k = Math.max(0, Math.floor(((ty - sy) * 12 + (tm - sm)) / monthStep));
    while (addMonths(start, (k + 1) * monthStep) <= today) k += 1;
    while (k > 0 && addMonths(start, k * monthStep) > today) k -= 1;
  }
  return { start: addMonths(start, k * monthStep), end: addMonths(start, (k + 1) * monthStep) };
}

export function goalProgress(goal: GoalDef, entries: GoalEntry[], today: string): GoalProgress {
  const window = periodWindow(goal, today);
  let done = 0;
  for (const e of entries) {
    if (!COUNTS.has(e.status)) continue;
    if (window && (e.date < window.start || e.date >= window.end)) continue;
    done += e.hours;
  }
  return { done, met: done >= goal.target_hours, window };
}

export function splitGoals<G extends GoalDef>(goals: G[], entries: GoalEntry[], today: string) {
  const active: { goal: G; progress: GoalProgress }[] = [];
  const completed: { goal: G; progress: GoalProgress }[] = [];
  for (const goal of goals) {
    const progress = goalProgress(goal, entries, today);
    (progress.met ? completed : active).push({ goal, progress });
  }
  return { active, completed };
}
