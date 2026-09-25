"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api } from "@/lib/api";
import { TOKEN_KEY, useAuth } from "@/lib/auth-context";
import { viewerTimeZone } from "@/lib/event-time";
import { useAuthedQuery } from "@/lib/use-api";
import type { OpportunityTemplate } from "@/lib/types";

export default function NewOpportunityPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Environment");
  const [location, setLocation] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [spots, setSpots] = useState(10);
  const [description, setDescription] = useState("");
  const [recurrence, setRecurrence] = useState<"one_time" | "weekly" | "monthly">("one_time");
  const [seriesEnd, setSeriesEnd] = useState("");
  // D1 (Evan, 2026-09-22): the org is always asked, and the default is where it is.
  // Derived during render, not seeded by an effect: what the org picked, else the
  // zone of its latest listing, else this browser's zone.
  const [pickedZone, setPickedZone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fields a template carries over but this form doesn't edit directly — passed
  // through on submit so a template's values aren't lost.
  const [skills, setSkills] = useState<string[]>([]);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [format, setFormat] = useState("In-Person");
  const [minAge, setMinAge] = useState<number | null>(null);

  // `templatesError` is read: without it a failed load showed an empty template
  // picker, identical to "you've never posted before". The blank form below still
  // works, so this is a note, not a blocker (audit 2026-09-02).
  const { data: templatesData, error: templatesError } = useAuthedQuery(
    user?.role === "org" ? "opportunity-templates" : null,
    (t) => api.templates(t),
  );
  const templates = templatesData ?? [];
  const { data: mine } = useAuthedQuery(user?.role === "org" ? "opportunities/mine" : null, (t) =>
    api.myOpportunities(t),
  );
  const zone = pickedZone ?? mine?.[0]?.timezone ?? viewerTimeZone();
  const zones = Intl.supportedValuesOf("timeZone");
  const zoneOptions = zones.includes(zone) ? zones : [zone, ...zones];
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const COMMITMENT_LABEL = { one_time: "One-time", weekly: "Weekly", monthly: "Monthly" } as const;

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    const d = t.data;
    setTitle(d.title);
    setCategory(d.category);
    setLocation(d.location);
    setSpots(d.spots_available);
    setDescription(d.description);
    setRecurrence(d.recurrence);
    setSkills(d.skills ?? []);
    setRequiresApproval(d.requires_approval);
    setFormat(d.format);
    setMinAge(d.min_age);
    if (d.timezone) setPickedZone(d.timezone);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setError("You must be logged in.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.createOpportunity(
        {
          title,
          category,
          location,
          // Wall-clock times as typed, plus the zone; the API converts. The browser
          // could only convert from ITS zone, wrong for an event somewhere else.
          start_time: startTime,
          end_time: endTime,
          skills,
          commitment: COMMITMENT_LABEL[recurrence],
          spots_available: spots,
          description,
          requires_approval: requiresApproval,
          min_age: minAge,
          format,
          recurrence,
          // Midnight UTC of a date-only value is the previous evening in every US
          // zone, which ended the series a day early. Now a local date in `zone`.
          series_end: recurrence !== "one_time" && seriesEnd ? `${seriesEnd}T00:00:00` : null,
          timezone: zone,
        },
        token
      );
      if (saveAsTemplate) {
        await api.saveTemplate(created.id, templateName.trim() || title, token).catch(() => undefined);
      }
      router.push(`/opportunities/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  if (!user || user.role !== "org") {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <p className="text-muted-foreground">Only organization accounts can post opportunities.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Post an opportunity</CardTitle>
          <CardDescription>Reach students looking for community service.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {templatesError && (
              <p className="text-sm text-muted-foreground">
                Couldn&apos;t load your saved templates. You can still fill the form below.
              </p>
            )}
            {templates.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="template">Start from a template</Label>
                <select
                  id="template"
                  defaultValue=""
                  onChange={(e) => e.target.value && applyTemplate(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="">None</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {["Environment", "Education", "Health", "Animals", "Community", "Arts"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="location">Location</Label>
              <Input id="location" required value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="start">Start</Label>
                <Input
                  id="start"
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="end">End</Label>
                <Input
                  id="end"
                  type="datetime-local"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="timezone">Time zone</Label>
              <select
                id="timezone"
                value={zone}
                onChange={(e) => setPickedZone(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {zoneOptions.map((z) => (
                  <option key={z} value={z}>
                    {z.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">The start and end times above are in this zone.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="recurrence">Repeats</Label>
              <select
                id="recurrence"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as "one_time" | "weekly" | "monthly")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="one_time">One-time</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              {recurrence !== "one_time" && (
                <p className="text-xs text-muted-foreground">
                  Repeats {recurrence === "weekly" ? "every week" : "every month"} on the same day as the start
                  date.
                </p>
              )}
            </div>
            {recurrence !== "one_time" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="series_end">Series ends (optional)</Label>
                <Input
                  id="series_end"
                  type="date"
                  value={seriesEnd}
                  onChange={(e) => setSeriesEnd(e.target.value)}
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="spots">Spots available{recurrence !== "one_time" ? " per date" : ""}</Label>
              <Input
                id="spots"
                type="number"
                min={1}
                required
                value={spots}
                onChange={(e) => setSpots(Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={saveAsTemplate}
                  onChange={(e) => setSaveAsTemplate(e.target.checked)}
                />
                Save as a reusable template
              </label>
              {saveAsTemplate && (
                <Input
                  aria-label="Template name"
                  placeholder="Template name (defaults to the title)"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Posting…" : "Post opportunity"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
