"use client";

// The dashboard's Goals tab (M16.3, Evan 2026-09-26/27): goals replace awards. Rendered
// inside the dashboard's .v1 shell, so it uses the v1 classes the awards tab used.
// Progress comes from lib/goals.ts (verified + off-site hours, per period); this file
// only shows it and writes the list. Reorder is Move up / Move down: no drag-and-drop
// package (dependencies.md gates new ones), and buttons work by keyboard and on touch.
import { ArrowDown, ArrowUp, Target, Trash2, Trophy } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { KeyedMutator } from "swr";

import { ApiError, api } from "@/lib/api";
import { TOKEN_KEY } from "@/lib/auth-context";
import { fmtDateKey, localDateKey } from "@/lib/event-time";
import type { GoalProgress } from "@/lib/goals";
import type { Goal, MyGoals } from "@/lib/types";

type Row = { goal: Goal; progress: GoalProgress };

const REPEAT: Record<string, string> = {
  all: "No reset (all time)",
  week: "Every week",
  month: "Every month",
  year: "Every year",
  calendar_year: "Every calendar year (resets January 1)",
  custom: "Custom",
};

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function periodLabel({ goal, progress }: Row): string {
  if (goal.period === "all" || !progress.window) return "All time";
  if (goal.period === "calendar_year") return "This year, resets January 1";
  const repeat =
    goal.period === "custom"
      ? `Every ${goal.every} ${goal.unit}${goal.every === 1 ? "" : "s"}`
      : REPEAT[goal.period];
  return `${repeat}, resets ${fmtDateKey(progress.window.end)}`;
}

export function GoalsPanel({
  data,
  active,
  completed,
  mutate,
}: {
  data: MyGoals;
  active: Row[];
  completed: Row[];
  mutate: KeyedMutator<MyGoals>;
}) {
  const [choice, setChoice] = useState("");
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState(10);
  const [period, setPeriod] = useState<Goal["period"]>("all");
  const [every, setEvery] = useState(2);
  const [unit, setUnit] = useState<NonNullable<Goal["unit"]>>("week");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const own = choice === "own";

  async function add(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !choice) return;
    const preset = data.presets.find((p) => p.key === choice);
    const body = preset
      ? { title: preset.title, target_hours: preset.target_hours, period: preset.period, every: preset.every, unit: preset.unit }
      : {
          title: title.trim(),
          target_hours: target,
          period,
          every: period === "custom" ? every : null,
          unit: period === "custom" ? unit : null,
        };
    setBusy(true);
    setError(null);
    try {
      // The periods repeat from the student's own today, not the server's.
      await api.createGoal({ ...body, start_date: localDateKey(new Date()) }, token);
      setChoice("");
      setTitle("");
      await mutate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that goal.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(goal: Goal) {
    if (!window.confirm(`Delete the goal "${goal.title}"?`)) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    const prev = data;
    setError(null);
    // Optimistic and reverted on failure, with `revalidate: false` so a refetch cannot
    // race the revert (the discover page's bookmark pattern).
    void mutate({ ...data, goals: data.goals.filter((g) => g.id !== goal.id) }, { revalidate: false });
    try {
      await api.deleteGoal(goal.id, token);
    } catch (err) {
      void mutate(prev, { revalidate: false });
      setError(err instanceof ApiError ? err.message : "Couldn't delete that goal.");
    }
  }

  /** Swap a goal with its neighbour in the same section; the full order is what is saved. */
  async function move(section: Row[], i: number, dir: -1 | 1) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    const ids = data.goals.map((g) => g.id);
    const a = ids.indexOf(section[i].goal.id);
    const b = ids.indexOf(section[i + dir].goal.id);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    const byId = new Map(data.goals.map((g) => [g.id, g]));
    const prev = data;
    setError(null);
    void mutate({ ...data, goals: ids.map((id, position) => ({ ...byId.get(id)!, position })) }, { revalidate: false });
    try {
      const goals = await api.reorderGoals(ids, token);
      void mutate({ ...data, goals }, { revalidate: false });
    } catch (err) {
      void mutate(prev, { revalidate: false });
      setError(err instanceof ApiError ? err.message : "Couldn't move that goal.");
    }
  }

  function card(row: Row, i: number, section: Row[], done: boolean) {
    const { goal, progress } = row;
    const pct = Math.min(100, (progress.done / goal.target_hours) * 100);
    return (
      <div key={goal.id} className="award-card">
        <div className={`award-icon ${done ? "award-achieved" : "award-locked"}`}>
          {done ? <Trophy size={24} strokeWidth={1.75} aria-hidden /> : <Target size={24} strokeWidth={1.75} aria-hidden />}
        </div>
        <div className="award-info">
          <div className="award-name">{goal.title}</div>
          <div className="award-desc">
            {fmt(progress.done)} of {fmt(goal.target_hours)} hours &middot; {periodLabel(row)}
          </div>
          <div className="progress-bar"><div className={`progress-fill${done ? " done" : ""}`} style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="goal-actions">
          <button type="button" className="goal-btn" aria-label={`Move ${goal.title} up`} disabled={i === 0} onClick={() => move(section, i, -1)}>
            <ArrowUp size={15} strokeWidth={1.75} aria-hidden />
          </button>
          <button type="button" className="goal-btn" aria-label={`Move ${goal.title} down`} disabled={i === section.length - 1} onClick={() => move(section, i, 1)}>
            <ArrowDown size={15} strokeWidth={1.75} aria-hidden />
          </button>
          <button type="button" className="goal-btn" aria-label={`Delete ${goal.title}`} onClick={() => remove(goal)}>
            <Trash2 size={15} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="progress-label" style={{ marginTop: 0, marginBottom: 14 }}>
        Goals count your verified hours and the hours you log for volunteering outside Citoya.
      </p>
      {active.length === 0 && (
        <div className="empty"><div className="empty-icon"><Target size={40} strokeWidth={1.75} aria-hidden /></div>No goals in progress. Add one below.</div>
      )}
      {active.map((row, i) => card(row, i, active, false))}

      <div className="form-box">
        <form onSubmit={add}>
          <div className="fr">
            <label htmlFor="goal-choice">Add a goal</label>
            <select id="goal-choice" className="fsel" style={{ width: "100%" }} value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value="">Choose a preset, or make your own&hellip;</option>
              {data.presets.map((p) => <option key={p.key} value={p.key}>{p.title}</option>)}
              <option value="own">Your own goal</option>
            </select>
          </div>
          {own && (
            <>
              <div className="fr"><input className="fsel" style={{ width: "100%" }} aria-label="Goal name" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Goal name" /></div>
              <div className="checkin-bar">
                <input className="fsel" aria-label="Target hours" style={{ width: 90 }} type="number" min={0.5} max={10000} step={0.5} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
                <span className="progress-label" style={{ marginTop: 0 }}>hours</span>
                <select className="fsel" aria-label="Repeats" value={period} onChange={(e) => setPeriod(e.target.value as Goal["period"])}>
                  {Object.entries(REPEAT).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
                {period === "custom" && (
                  <>
                    <span className="progress-label" style={{ marginTop: 0 }}>every</span>
                    <input className="fsel" aria-label="Repeat every" style={{ width: 70 }} type="number" min={1} max={365} step={1} value={every} onChange={(e) => setEvery(Number(e.target.value))} />
                    <select className="fsel" aria-label="Repeat unit" value={unit} onChange={(e) => setUnit(e.target.value as NonNullable<Goal["unit"]>)}>
                      <option value="day">days</option>
                      <option value="week">weeks</option>
                      <option value="month">months</option>
                    </select>
                  </>
                )}
              </div>
            </>
          )}
          <button className="btn-p" type="submit" style={{ padding: "9px 18px", fontSize: ".82rem" }} disabled={busy || !choice || (own && !title.trim())}>Add goal</button>
        </form>
      </div>
      {error && <p className="ferr">{error}</p>}

      {completed.length > 0 && (
        <>
          <h2 className="goal-section">Completed</h2>
          {completed.map((row, i) => card(row, i, completed, true))}
        </>
      )}
    </>
  );
}
