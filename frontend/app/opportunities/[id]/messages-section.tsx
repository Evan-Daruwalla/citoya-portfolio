"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { ReportConcern } from "@/components/report-concern";
import { ApiError, api } from "@/lib/api";
import { TOKEN_KEY, useAuth } from "@/lib/auth-context";
import { consentGated } from "@/lib/consent";
import { canReadThread } from "@/lib/thread-access";
import type { Message } from "@/lib/types";
import { useAuthedQuery } from "@/lib/use-api";

/** Renders only if the current user can access the thread (org owner or an approved
 * applicant). Fetched only when `canReadThread` says the backend will allow it
 * (2026-09-26); a 403 on the fetch still hides the section as a backstop.
 *
 * `canPost` is the owning org only (Evan, 2026-09-22): applicants READ the thread, and
 * the same box sends THEIR message privately to the org (`/messages/to-org`) instead of
 * posting it. The backend refuses a student's thread post regardless. */
export function MessagesSection({
  opportunityId,
  orgId,
  canPost,
}: {
  opportunityId: string;
  orgId: string;
  canPost: boolean;
}) {
  const { user } = useAuth();
  // Same key the signup section reads, so this is one shared request, not a second one.
  const { data: myApps } = useAuthedQuery(
    user?.role === "student" ? "applications/my" : null,
    (t) => api.myApplications(t),
  );
  const canRead = canPost || canReadThread(user, orgId, opportunityId, myApps);
  const blocked = !canPost && consentGated(user); // F12: the server refuses it anyway
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [visible, setVisible] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Applicant side only: the private message goes to the org's inbox, not the
  // thread, so there is nothing to reload — say where it went instead.
  const [sentNote, setSentNote] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function load() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !canRead) return;
    api
      .messages(opportunityId, token)
      .then((m) => {
        setMessages(m);
        setVisible(true);
      })
      // Only a 403 means "you can't see this thread". Catching everything hid the
      // whole feature on any timeout or 5xx, contradicting this module's own header
      // comment, with no retry affordance (audit 2026-09-02).
      .catch((err) => {
        // A successful retry sets visible=true, which exits the error branch below —
        // so loadError needs no reset, and resetting it in the effect body would
        // trip react-hooks/set-state-in-effect.
        if (err instanceof ApiError && err.status === 403) setVisible(false);
        else setLoadError(true);
      });
  }

  useEffect(load, [opportunityId, canRead]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !body.trim()) return;
    setSubmitting(true);
    setSentNote(null);
    setSubmitError(null);
    try {
      if (canPost) {
        await api.postMessage(opportunityId, body, token);
        setBody("");
        load();
      } else {
        await api.messageOrg(opportunityId, body, token);
        setBody("");
        setSentNote("Sent privately to the organization. Its reply will arrive in your inbox.");
      }
    } catch (err) {
      if (canPost && err instanceof ApiError && err.status === 403) setVisible(false);
      // An applicant's 403 is usually the consent gate — say so rather than vanish.
      else setSubmitError(err instanceof ApiError ? err.message : "Couldn't send your message.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError && !visible) {
    return (
      <div className="modal-card">
        <div
          className="mbody"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
        >
          <p className="progress-label" style={{ marginTop: 0 }}>Couldn&apos;t load messages.</p>
          <button
            className="btn-s"
            type="button"
            onClick={load}
            style={{ padding: "9px 18px", fontSize: ".83rem" }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  if (!visible) return null;

  return (
    <div className="modal-card">
      <div className="mbody" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 className="mtitle" style={{ marginBottom: 0 }}>Messages</h2>
        {messages && messages.length === 0 && (
          <p className="progress-label" style={{ marginTop: 0 }}>
            {canPost ? "No messages yet. Post an update for your volunteers." : "No updates from the organization yet."}
          </p>
        )}
        {messages?.map((m) => (
          <div key={m.id} style={{ fontSize: ".84rem", color: "var(--text)" }}>
            <span style={{ fontWeight: 600 }}>{m.sender_name}:</span> <span>{m.body}</span>
          </div>
        ))}
        {!canPost && !blocked && (
          <p className="progress-label" style={{ marginTop: 0 }}>
            Only the organization posts here. Ask it a question privately below — replies arrive in your{" "}
            <Link href="/inbox" style={{ color: "var(--green)" }}>inbox</Link>.
          </p>
        )}
        <form
          onSubmit={onSubmit}
          style={{ display: "flex", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 14 }}
        >
          <input
            className="fsel"
            style={{ flex: 1, cursor: "text" }}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={blocked}
            placeholder={canPost ? "Write a message…" : "Ask the organization privately…"}
            aria-label={canPost ? "Message your volunteers" : "Private message to the organization"}
          />
          <button
            className="btn-p"
            type="submit"
            disabled={blocked || submitting || !body.trim()}
            style={{ padding: "9px 18px", fontSize: ".83rem" }}
          >
            Send
          </button>
        </form>
        {sentNote && <p className="progress-label" style={{ marginTop: 0 }}>{sentNote}</p>}
        {submitError && <p className="ferr" style={{ marginBottom: 0 }}>{submitError}</p>}
        <p className="progress-label" style={{ marginTop: 0 }}>
          <ReportConcern subject={`Report a message on listing ${opportunityId}`} label="Report a message" />
        </p>
      </div>
    </div>
  );
}
