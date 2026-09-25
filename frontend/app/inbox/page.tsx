"use client";

import { useState } from "react";

import { ReportConcern } from "@/components/report-concern";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { TOKEN_KEY, useAuth } from "@/lib/auth-context";
import { consentGated } from "@/lib/consent";
import { useAuthedQuery } from "@/lib/use-api";

export default function InboxPage() {
  const { user, loading } = useAuth();
  const gated = consentGated(user); // F12: replying is consent-gated server-side
  const {
    data: messages,
    loading: fetching,
    error,
    retry,
    mutate,
  } = useAuthedQuery("messages/inbox", (t) => api.inbox(t));
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);

  async function sendReply(id: string) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !replyBody.trim()) return;
    setSending(true);
    try {
      await api.replyMessage(id, replyBody.trim(), token);
      setReplyTo(null);
      setReplyBody("");
      void mutate();  // re-read the thread after a successful send
    } finally {
      setSending(false);
    }
  }

  if (loading) return null;

  if (!user) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <p className="text-muted-foreground">Please log in to see your messages.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <div>
        <span className="section-tag">Messages</span>
        <h1 className="section-title">Inbox</h1>
        <p className="text-sm text-muted-foreground">
          Got a message that worries you? <ReportConcern subject="Report a message in my inbox" label="Report it" />.
        </p>
        {gated && (
          <p className="text-sm text-muted-foreground">
            You can read messages, but you can&apos;t reply until a parent or guardian approves your account.
          </p>
        )}
      </div>

      {fetching && <p className="empty-state">Loading…</p>}

      {/* An error must not fall through to "No messages yet" — that told a
          student with an unread org message that their inbox was empty. */}
      {!fetching && error && (
        <div className="empty-state flex flex-col items-center gap-3">
          <span>Couldn&apos;t load your inbox. Check your connection and try again.</span>
          <Button variant="outline" onClick={retry}>Retry</Button>
        </div>
      )}

      {!fetching && !error && messages?.length === 0 && (
        <div className="empty-state">No messages yet.</div>
      )}

      <div className="flex flex-col gap-2">
        {messages?.map((m) => (
          <Card key={m.id}>
            <CardContent className="flex flex-col gap-2 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">{m.sender_name}</p>
                <span className="text-xs text-muted-foreground">
                  {new Date(m.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{m.body}</p>
              {replyTo === m.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    rows={2}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Write a reply…"
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={sending || !replyBody.trim()} onClick={() => sendReply(m.id)}>
                      {sending ? "Sending…" : "Send"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  disabled={gated}
                  onClick={() => {
                    setReplyTo(m.id);
                    setReplyBody("");
                  }}
                  className="self-start text-xs text-primary underline-offset-4 hover:underline"
                >
                  Reply
                </button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
