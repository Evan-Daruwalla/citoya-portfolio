"use client";

import { errorText } from "@/lib/errors";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { useSWRConfig } from "swr";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { TOKEN_KEY, useAuth } from "@/lib/auth-context";
import { eventDateKey, eventInstant, viewerTimeZone } from "@/lib/event-time";
import { useAuthedQuery } from "@/lib/use-api";
import type { Opportunity, OpportunityUpdateInput } from "@/lib/types";

const COMMITMENT_LABEL = { one_time: "One-time", weekly: "Weekly", monthly: "Monthly" } as const;

/** Everything this form holds, in the shape its inputs hold it. Edit mode (`?edit=<id>`,
 *  decision 13A, 2026-10-09) prefills from a listing and later diffs the form against this
 *  same object, so a field is sent only when the org changed it IN THE FORM. */
interface ListingValues {
  title: string;
  category: string;
  location: string;
  startTime: string;
  endTime: string;
  spots: number;
  description: string;
  recurrence: "one_time" | "weekly" | "monthly";
  seriesEnd: string;
  zone: string;
  skills: string[];
  requiresApproval: boolean;
  format: string;
  minAge: number | null;
}

/** An instant as the wall-clock time in `timeZone` ("2026-11-10T18:30"): what the form's
 *  datetime-local inputs hold, and the shape the API accepts back alongside the zone. */
function wallClock(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(eventInstant(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function valuesOf(o: Opportunity): ListingValues {
  return {
    title: o.title,
    category: o.category,
    location: o.location,
    startTime: wallClock(o.start_time, o.timezone),
    endTime: wallClock(o.end_time, o.timezone),
    spots: o.spots_available,
    description: o.description,
    recurrence: o.recurrence,
    seriesEnd: o.series_end ? eventDateKey(o.series_end, o.timezone) : "",
    zone: o.timezone,
    skills: o.skills,
    requiresApproval: o.requires_approval,
    format: o.format,
    minAge: o.min_age,
  };
}

// Midnight UTC of a date-only value is the previous evening in every US zone, which ended
// the series a day early. Now a local date in the listing's zone.
const seriesEndWire = (recurrence: string, seriesEnd: string) =>
  recurrence !== "one_time" && seriesEnd ? `${seriesEnd}T00:00:00` : null;

function OpportunityForm({ editId, initial }: { editId: string | null; initial: ListingValues | null }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { mutate: mutateKey } = useSWRConfig();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "Environment");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [startTime, setStartTime] = useState(initial?.startTime ?? "");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "");
  const [spots, setSpots] = useState(initial?.spots ?? 10);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [recurrence, setRecurrence] = useState<"one_time" | "weekly" | "monthly">(initial?.recurrence ?? "one_time");
  const [seriesEnd, setSeriesEnd] = useState(initial?.seriesEnd ?? "");
  // D1 (Evan, 2026-09-22): the org is always asked, and the default is where it is.
  // Derived during render, not seeded by an effect: what the org picked, else the
  // zone of its latest listing, else this browser's zone. In edit mode: the listing's own.
  const [pickedZone, setPickedZone] = useState<string | null>(initial?.zone ?? null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set only when the listing exists but its template did not save (audit DY Low 42).
  const [createdId, setCreatedId] = useState<string | null>(null);

  // Fields a template carries over but this form doesn't edit directly — passed
  // through on submit so a template's values aren't lost.
  const [skills, setSkills] = useState<string[]>(initial?.skills ?? []);
  const [requiresApproval, setRequiresApproval] = useState(initial?.requiresApproval ?? false);
  const [format, setFormat] = useState(initial?.format ?? "In-Person");
  const [minAge, setMinAge] = useState<number | null>(initial?.minAge ?? null);

  // `templatesError` is read: without it a failed load showed an empty template
  // picker, identical to "you've never posted before". The blank form below still
  // works, so this is a note, not a blocker (audit 2026-09-02).
  // Held in edit mode: the template picker is hidden there.
  const {
    data: templatesData,
    error: templatesError,
    mutate: mutateTemplates,
  } = useAuthedQuery(user?.role === "org" && !editId ? "opportunity-templates" : null, (t) => api.templates(t));
  const templates = templatesData ?? [];
  // Deleting a template is two steps, like Withdraw on the listing page: one click asks, a second deletes.
  const [pickedTemplate, setPickedTemplate] = useState("");
  const [confirmingTemplateDelete, setConfirmingTemplateDelete] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [templateDeleteError, setTemplateDeleteError] = useState<string | null>(null);
  const { data: mine } = useAuthedQuery(user?.role === "org" ? "opportunities/mine" : null, (t) =>
    api.myOpportunities(t),
  );
  const zone = pickedZone ?? mine?.[0]?.timezone ?? viewerTimeZone();
  const zones = Intl.supportedValuesOf("timeZone");
  const zoneOptions = zones.includes(zone) ? zones : [zone, ...zones];
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

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

  async function deleteSelectedTemplate() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !pickedTemplate) return;
    setDeletingTemplate(true);
    setTemplateDeleteError(null);
    try {
      await api.deleteTemplate(pickedTemplate, token);
      setPickedTemplate("");
      setConfirmingTemplateDelete(false);
      await mutateTemplates();
    } catch (err) {
      setTemplateDeleteError(errorText(err, "Could not delete the template."));
    } finally {
      setDeletingTemplate(false);
    }
  }

  /** Only what the org changed in the form (decision 13A): the API refuses every logistics
   *  field it is SENT while anyone is signed up, even one equal to the stored value. */
  function changedFields(from: ListingValues): OpportunityUpdateInput {
    const patch: OpportunityUpdateInput = {};
    if (title !== from.title) patch.title = title;
    if (category !== from.category) patch.category = category;
    if (location !== from.location) patch.location = location;
    if (spots !== from.spots) patch.spots_available = spots;
    if (description !== from.description) patch.description = description;
    if (recurrence !== from.recurrence) {
      patch.recurrence = recurrence;
      patch.commitment = COMMITMENT_LABEL[recurrence];
    }
    if (JSON.stringify(skills) !== JSON.stringify(from.skills)) patch.skills = skills;
    if (requiresApproval !== from.requiresApproval) patch.requires_approval = requiresApproval;
    if (format !== from.format) patch.format = format;
    if (minAge !== from.minAge) patch.min_age = minAge;
    // Times are the wall-clock strings the create form sends. The zone is sent only when the
    // zone field itself changed, and then the times go with it: the form's inputs read "in
    // this zone", and without them the API would keep the stored INSTANTS and shift the
    // clock time the org sees in the form.
    const zoneChanged = zone !== from.zone;
    if (zoneChanged) patch.timezone = zone;
    if (zoneChanged || startTime !== from.startTime) patch.start_time = startTime;
    if (zoneChanged || endTime !== from.endTime) patch.end_time = endTime;
    const seriesNow = seriesEndWire(recurrence, seriesEnd);
    if (seriesNow !== seriesEndWire(from.recurrence, from.seriesEnd) || (zoneChanged && seriesNow !== null)) {
      patch.series_end = seriesNow;
    }
    return patch;
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
      if (editId && initial) {
        const patch = changedFields(initial);
        if (Object.keys(patch).length > 0) {
          await api.updateOpportunity(editId, patch, token);
          // Drop every cached listing answer so the listing page and the dashboard show the edit.
          await mutateKey((key) => typeof key === "string" && key.startsWith("opportunities/"), undefined, {
            revalidate: false,
          });
        }
        router.push(`/opportunities/${editId}`);
        return;
      }
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
          series_end: seriesEndWire(recurrence, seriesEnd),
          timezone: zone,
        },
        token
      );
      if (saveAsTemplate) {
        const templateSaved = await api.saveTemplate(created.id, templateName.trim() || title, token).then(
          () => true,
          () => false,
        );
        if (!templateSaved) {
          // audit DY Low 42, 2026-10-07: the failure was swallowed. The listing is kept; stay
          // here (the submit is locked so it cannot post twice) and say the template is missing.
          setCreatedId(created.id);
          setError("Your listing was posted, but the template did not save.");
          return;
        }
      }
      router.push(`/opportunities/${created.id}`);
    } catch (err) {
      setError(errorText(err, "We could not save your listing. Check your connection and try again."));
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
          <CardTitle>{editId ? "Edit listing" : "Post an opportunity"}</CardTitle>
          <CardDescription>
            {editId
              ? "Only the fields you change are saved. Times, location, spots and the other logistics cannot change once a student has signed up."
              : "Reach students looking for community service."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {!editId && templatesError && (
              <p className="text-sm text-muted-foreground">
                Could not load your saved templates. You can still fill the form below.
              </p>
            )}
            {!editId && templates.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="template">Start from a template</Label>
                <select
                  id="template"
                  value={pickedTemplate}
                  onChange={(e) => {
                    setPickedTemplate(e.target.value);
                    setConfirmingTemplateDelete(false);
                    setTemplateDeleteError(null);
                    if (e.target.value) applyTemplate(e.target.value);
                  }}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                >
                  <option value="">None</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {/* A native select cannot hold a button per option, so Delete acts on the picked template. */}
                {pickedTemplate &&
                  (confirmingTemplateDelete ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span>Delete this template? Listings already posted from it stay as they are.</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={deletingTemplate}
                        onClick={deleteSelectedTemplate}
                      >
                        Confirm delete
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={deletingTemplate}
                        onClick={() => setConfirmingTemplateDelete(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`Delete template ${templates.find((t) => t.id === pickedTemplate)?.name ?? ""}`}
                        onClick={() => setConfirmingTemplateDelete(true)}
                      >
                        Delete
                      </Button>
                    </div>
                  ))}
                {templateDeleteError && (
                  <p className="text-sm text-destructive" role="alert">
                    {templateDeleteError}
                  </p>
                )}
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
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
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
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
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
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
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
            {/* audit DY Low 32, 2026-10-07: the form sent min_age from templates but never let
                an org set it. Bounds match the backend schema (ge=0, le=120). */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="min_age">Minimum age (optional)</Label>
              <Input
                id="min_age"
                type="number"
                min={0}
                max={120}
                value={minAge ?? ""}
                onChange={(e) => setMinAge(e.target.value === "" ? null : Number(e.target.value))}
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
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
              />
            </div>
            {!editId && (
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
            )}
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            {createdId && (
              <Link href={`/opportunities/${createdId}`} className="text-sm text-primary underline-offset-4 hover:underline">
                View your listing
              </Link>
            )}
            <Button type="submit" disabled={submitting || createdId !== null} className="w-full">
              {editId ? (submitting ? "Saving…" : "Save changes") : submitting ? "Posting…" : "Post opportunity"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

// `?edit=<opportunity_id>` loads that listing and prefills the form (decision 13A).
function NewOpportunityInner() {
  const editId = useSearchParams().get("edit");
  const { user } = useAuth();
  // A per-mount nonce in the key: a cached copy of this listing from an earlier visit would
  // seed the form with old values, and the form seeds ONCE. A fresh key always fetches.
  const [nonce] = useState(() => Math.random().toString(36).slice(2));
  const {
    data: listing,
    loading: listingLoading,
    error: listingError,
  } = useAuthedQuery(
    editId && user?.role === "org" ? `opportunities/edit/${editId}:${nonce}` : null,
    (t) => api.getOpportunity(editId as string, t),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  if (!editId) return <OpportunityForm editId={null} initial={null} />;
  // Not an org (or still signing in): the form renders its own org-only message.
  if (!user || user.role !== "org") return <OpportunityForm editId={editId} initial={null} />;
  if (listingLoading) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <p className="text-muted-foreground">Loading…</p>
      </main>
    );
  }
  if (listingError || !listing) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <p className="text-muted-foreground">
          {listingError && listingError.status < 500
            ? listingError.message
            : "Could not load this listing. Check your connection and try again."}
        </p>
      </main>
    );
  }
  if (listing.org_id !== user.id) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <p className="text-muted-foreground">You can only edit your own listings.</p>
      </main>
    );
  }
  return <OpportunityForm key={listing.id} editId={listing.id} initial={valuesOf(listing)} />;
}

// useSearchParams needs a Suspense boundary in the App Router (same as /login).
export default function NewOpportunityPage() {
  return (
    <Suspense fallback={null}>
      <NewOpportunityInner />
    </Suspense>
  );
}
