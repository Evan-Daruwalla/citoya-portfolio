"use client";

// Form state and writes for off-site hours (2026-09-27). The dashboard (.v1) and
// /hours (shadcn) each render this form in their own visual system, and no file
// mixes the two, so the logic lives here once and the markup stays in each page.
import { useState, type FormEvent } from "react";

import { ApiError, api } from "@/lib/api";
import { TOKEN_KEY } from "@/lib/auth-context";
import { localDateKey } from "@/lib/event-time";

export function useOffsiteHours(onChanged: () => void) {
  const [activity, setActivity] = useState("");
  const [date, setDate] = useState(() => localDateKey(new Date()));
  const [hours, setHours] = useState(1);
  const [supervisor, setSupervisor] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !activity.trim()) return;
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      await api.logOffsiteHours(
        {
          activity: activity.trim(),
          occurrence_date: date,
          hours,
          note: note.trim() || undefined,
          supervisor_name: supervisor.trim() || undefined,
        },
        token,
      );
      setActivity("");
      setSupervisor("");
      setNote("");
      setMessage("Logged. Off-site hours are marked self-reported and don't count as verified.");
      // Unverified: no verified total or award moves, so only the hours list changes.
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this off-site entry?")) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await api.deleteHours(id, token);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete that entry.");
    } finally {
      setBusyId(null);
    }
  }

  return {
    fields: { activity, setActivity, date, setDate, hours, setHours, supervisor, setSupervisor, note, setNote },
    today: localDateKey(new Date()),
    submit,
    remove,
    submitting,
    busyId,
    message,
    error,
  };
}
