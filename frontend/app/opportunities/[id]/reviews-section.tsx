"use client";

import { useState, type FormEvent } from "react";

import { WifiOff } from "lucide-react";

import { ApiError, api } from "@/lib/api";
import { ReportConcern } from "@/components/report-concern";
import { TOKEN_KEY, useAuth } from "@/lib/auth-context";
import { consentGated } from "@/lib/consent";
import { usePublicQuery } from "@/lib/use-api";

export function ReviewsSection({ orgId, opportunityId }: { orgId: string; opportunityId: string }) {
  const { user } = useAuth();
  // Public: reviews render for a signed-out visitor, same as the listing around
  // them. Until this conversion the load was `.catch(() => undefined)` — a
  // failed fetch left `data` null and the card rendered as a bare "Reviews"
  // heading, indistinguishable from an org that has never been reviewed.
  // The key includes the viewer (as F23 did for the listing): with a token the response
  // marks the caller's own review. What actually keeps one user's `mine` from reaching
  // another is the auth context clearing the SWR cache on login and logout; while auth is
  // still loading, the key reads `:anon` even though the token is sent (same as F23).
  const { data, loading, error, retry, mutate } = usePublicQuery(
    `orgs/${orgId}/reviews:${user?.id ?? "anon"}`,
    () => api.orgReviews(orgId, localStorage.getItem(TOKEN_KEY) ?? undefined),
  );
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  // The WRITE's error stays separate from the LOAD's, the same split the parent
  // page made: one string serving both let a failed post clear a failed load.
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      setDeleteError(err instanceof ApiError ? err.message : "Could not delete the review.");
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
      setSubmitError(err instanceof ApiError ? err.message : "Something went wrong.");
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
            <span style={{ marginLeft: 8, fontSize: ".82rem", fontWeight: 400, color: "var(--muted)" }}>
              ★ {data.average_rating} ({data.count})
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
              : "Couldn't load reviews. Check your connection and try again."}
            <div style={{ marginTop: 12 }}>
              <button className="btn-s" onClick={retry}>Retry</button>
            </div>
          </div>
        )}

        {data && data.reviews.length === 0 && <p className="progress-label" style={{ marginTop: 0 }}>No reviews yet.</p>}
        {data?.reviews.map((r) => (
          <div key={r.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
            <p style={{ fontSize: ".84rem", fontWeight: 600, color: "var(--text)", margin: 0 }}>
              {"★".repeat(r.rating)}
              {"☆".repeat(5 - r.rating)} · {r.author_name}
            </p>
            {r.text && <p className="progress-label" style={{ marginTop: 4 }}>{r.text}</p>}
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6, fontSize: ".72rem" }}>
              {(r.mine || user?.is_admin) && (
                <button
                  className="btn-s"
                  style={{ padding: "4px 10px", fontSize: ".72rem" }}
                  disabled={deletingId === r.id}
                  onClick={() => onDelete(r.id, r.mine)}
                >{r.mine ? "Delete my review" : "Remove (admin)"}</button>
              )}
              {/* Anyone may report a review (2026-09-26, #10 option C): the same mailto to
                  support that listings and messages use; handled under P5 in
                  docs/SUPPORT_PROCEDURES.md. Not on your own review: delete it instead. */}
              {!r.mine && (
                <ReportConcern subject={`Report a review (${r.id}) on listing ${opportunityId}`} label="Report" />
              )}
            </div>
          </div>
        ))}
        {deleteError && <p className="ferr" style={{ marginBottom: 0 }}>{deleteError}</p>}

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
            {submitError && <p className="ferr" style={{ marginBottom: 0 }}>{submitError}</p>}
            <button
              className="btn-p"
              type="submit"
              disabled={submitting}
              style={{ alignSelf: "flex-start", padding: "9px 18px", fontSize: ".83rem" }}
            >
              {submitting ? "Posting…" : "Post review"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
