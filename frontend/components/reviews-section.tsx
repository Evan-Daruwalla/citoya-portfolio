"use client";

import { errorText } from "@/lib/errors";
import { useState, type FormEvent } from "react";

import { Star, WifiOff } from "lucide-react";

import { ApiError, api } from "@/lib/api";
import { ReportConcern } from "@/components/report-concern";
import { TOKEN_KEY, useAuth } from "@/lib/auth-context";
import { consentGated } from "@/lib/consent";
import { usePublicQuery } from "@/lib/use-api";

// `opportunityId` is optional because the org's own page (PRD M17.1, 2026-10-06)
// shows these reviews with no listing around them; the Report subject names where
// the reader actually was.
export function ReviewsSection({ orgId, opportunityId }: { orgId: string; opportunityId?: string }) {
  const { user, loading: authLoading } = useAuth();
  // Public: reviews render for a signed-out visitor, same as the listing around
  // them. Until this conversion the load was `.catch(() => undefined)` — a
  // failed fetch left `data` null and the card rendered as a bare "Reviews"
  // heading, indistinguishable from an org that has never been reviewed.
  // The key includes the viewer (as F23 did for the listing): with a token the response
  // marks the caller's own review. What actually keeps one user's `mine` from reaching
  // another is the auth context clearing the SWR cache on login and logout. The key
  // waits for auth to settle, as the listing's does (record CQ): keyed `:anon` while
  // auth loaded, a token-bearing answer was filed under `:anon`.
  const { data, loading: reviewsLoading, error, retry, mutate } = usePublicQuery(
    authLoading ? null : `orgs/${orgId}/reviews:${user?.id ?? "anon"}`,
    () => api.orgReviews(orgId, localStorage.getItem(TOKEN_KEY) ?? undefined),
  );
  const loading = authLoading || reviewsLoading;
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  // The WRITE's error stays separate from the LOAD's, the same split the parent
  // page made: one string serving both let a failed post clear a failed load.
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Author edits their review (PRD #10, 2026-10-09).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  async function onSaveEdit(reviewId: string) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setDeleteError(null);
    setSavingEdit(true);
    try {
      await api.updateReview(orgId, reviewId, { rating: editRating, text: editText }, token);
      void mutate();
      setEditingId(null);
    } catch (err) {
      setDeleteError(errorText(err, "Could not save the review."));
    } finally {
      setSavingEdit(false);
    }
  }

  // The author, or an admin, can take a review down (2026-09-26, feature inventory
  // #10). The reviewed org cannot; the API refuses it too.
  async function onDelete(reviewId: string, mine: boolean) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    const prompt = mine
      ? "Delete your review? This cannot be undone."
      : "Remove this review as an admin? This cannot be undone.";
    if (!window.confirm(prompt)) return;
    setDeleteError(null);
    setDeletingId(reviewId);
    try {
      await api.deleteReview(orgId, reviewId, token);
      void mutate();
    } catch (err) {
      setDeleteError(errorText(err, "Could not delete the review."));
    } finally {
      setDeletingId(null);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await api.createReview(orgId, { rating, text }, token);
      setText("");
      void mutate();
    } catch (err) {
      setSubmitError(errorText(err, "We could not post your review. Check your connection and try again."));
    } finally {
      setSubmitting(false);
    }
  }

  // `.modal-card` + `.mbody`, matching the Featured panel this page already renders
  // as a sibling — not `.form-box`, so the two cards on one screen agree.
  return (
    <div className="modal-card">
      <div className="mbody" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h2 className="mtitle" style={{ marginBottom: 0 }}>
          Reviews
          {data && data.average_rating != null && (
            <span style={{ marginLeft: 8, fontSize: "var(--fs-label)", fontWeight: 400, color: "var(--muted)" }}>
              <Star size={16} strokeWidth={1.75} aria-hidden fill="currentColor" /> {data.average_rating} ({data.count})
            </span>
          )}
        </h2>
        {loading && (
          <div className="loading" style={{ padding: "12px 0" }}>
            <div className="spinner" />
            <div>Loading reviews…</div>
          </div>
        )}

        {!loading && error && (
          <div className="empty" style={{ padding: "12px 0" }}>
            <div className="empty-icon"><WifiOff size={28} strokeWidth={1.75} aria-hidden /></div>
            {error instanceof ApiError && error.status >= 400 && error.status < 500
              ? error.message
              : "Could not load reviews. Check your connection and try again."}
            <div style={{ marginTop: 12 }}>
              <button className="btn-s" onClick={retry}>Retry</button>
            </div>
          </div>
        )}

        {data && data.reviews.length === 0 && <p className="progress-label" style={{ marginTop: 0 }}>No reviews yet. Students review an organization after they volunteer with it.</p>}
        {data?.reviews.map((r) => (
          <div key={r.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
            <p style={{ fontSize: "var(--fs-label)", fontWeight: 600, color: "var(--text)", margin: 0 }}>
              <span role="img" aria-label={`${r.rating} out of 5 stars`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={16} strokeWidth={1.75} aria-hidden fill={n <= r.rating ? "currentColor" : "none"} />
                ))}
              </span>{" "}
              · {r.author_name}
            </p>
            {editingId === r.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
                <select
                  className="fsel"
                  style={{ width: 140 }}
                  aria-label="Rating"
                  value={editRating}
                  onChange={(e) => setEditRating(Number(e.target.value))}
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} star{n > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
                <textarea
                  className="fsel"
                  style={{ width: "100%", resize: "vertical", cursor: "text" }}
                  aria-label="Review text"
                  maxLength={2000}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={2}
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    className="btn-p"
                    style={{ padding: "4px 10px", fontSize: "var(--fs-micro)" }}
                    disabled={savingEdit}
                    onClick={() => onSaveEdit(r.id)}
                  >{savingEdit ? "Saving…" : "Save"}</button>
                  <button
                    className="btn-s"
                    style={{ padding: "4px 10px", fontSize: "var(--fs-micro)" }}
                    disabled={savingEdit}
                    onClick={() => setEditingId(null)}
                  >Cancel</button>
                </div>
              </div>
            ) : (
              r.text && <p className="progress-label" style={{ marginTop: 4 }}>{r.text}</p>
            )}
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6, fontSize: "var(--fs-micro)" }}>
              {r.mine && editingId !== r.id && (
                <button
                  className="btn-s"
                  style={{ padding: "4px 10px", fontSize: "var(--fs-micro)" }}
                  onClick={() => {
                    setEditRating(r.rating);
                    setEditText(r.text);
                    setEditingId(r.id);
                  }}
                >Edit my review</button>
              )}
              {(r.mine || user?.is_admin) && (
                <button
                  className="btn-s"
                  style={{ padding: "4px 10px", fontSize: "var(--fs-micro)" }}
                  disabled={deletingId === r.id}
                  onClick={() => onDelete(r.id, r.mine)}
                >{r.mine ? "Delete my review" : "Remove (admin)"}</button>
              )}
              {/* Anyone may report a review (2026-09-26, #10 option C): the same mailto to
                  support that listings and messages use; handled under P5 in
                  docs/SUPPORT_PROCEDURES.md. Not on your own review: delete it instead. */}
              {!r.mine && (
                <ReportConcern subject={`Report a review (${r.id}) ${opportunityId ? `on listing ${opportunityId}` : `on the organization page ${orgId}`}`} label="Report" />
              )}
            </div>
          </div>
        ))}
        {deleteError && <p className="ferr" role="alert" style={{ marginBottom: 0 }}>{deleteError}</p>}

        {user?.role === "student" && !consentGated(user) && (
          <form
            onSubmit={onSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 16 }}
          >
            <div className="fr" style={{ marginBottom: 0 }}>
              <label htmlFor="review-rating">Leave a review</label>
            </div>
            <select
              id="review-rating"
              className="fsel"
              style={{ width: 140 }}
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} star{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>
            <textarea
              className="fsel"
              style={{ width: "100%", resize: "vertical", cursor: "text" }}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder="Share your experience (optional)"
            />
            {submitError && <p className="ferr" role="alert" style={{ marginBottom: 0 }}>{submitError}</p>}
            <button
              className="btn-p btn-sm"
              type="submit"
              disabled={submitting}
              style={{ alignSelf: "flex-start" }}
            >
              {submitting ? "Posting…" : "Post review"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
