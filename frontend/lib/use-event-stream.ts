"use client";

/**
 * The server-push channel (2026-09-07, Evan's call).
 *
 * Before this, nothing polled AND nothing subscribed: SWR revalidates on focus
 * and reconnect, so an event created server-side reached the browser only when
 * the user refocused the tab. This adds the missing half — the server tells the
 * browser, and the browser invalidates exactly the SWR keys the event touched.
 *
 * Mount ONCE, in the header, which is on every non-`.v1` page. Two mounted
 * copies would open two streams per tab for no benefit.
 *
 * Auth: `EventSource` cannot set an Authorization header, and this project does
 * not put credentials in URLs — so the access token is spent on an authed POST
 * that returns a 30-second, stream-scoped ticket, and only that ticket rides in
 * the query string. See `backend/app/core/security.py`.
 */

import { useEffect } from "react";
import { useSWRConfig } from "swr";

import { API_URL, TOKEN_KEY, api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

/** Which SWR keys an event invalidates. The event names come from the backend. */
const AFFECTED_KEYS: Record<string, string[]> = {
  notification: ["notifications", "notifications/unread-count"],
};

export function useEventStream() {
  const { user } = useAuth();
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (!user) return;

    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    // Backoff for the case EventSource cannot handle itself: the ticket is
    // expired or rejected, so the server closes immediately and the browser's
    // own reconnect would spin against a 401 forever.
    let delay = 1000;

    async function connect() {
      if (closed) return;
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return;

      let ticket: string;
      try {
        ticket = (await api.streamTicket(token)).ticket;
      } catch {
        // No live updates this round. Deliberately silent: the page still works
        // — SWR's focus revalidation is what the user had before this existed —
        // and a toast about a background channel is noise they cannot act on.
        schedule();
        return;
      }
      if (closed) return;

      source = new EventSource(`${API_URL}/events?ticket=${encodeURIComponent(ticket)}`);

      source.addEventListener("ready", () => {
        delay = 1000; // a stream that actually opened resets the backoff
      });

      for (const [event, keys] of Object.entries(AFFECTED_KEYS)) {
        source.addEventListener(event, () => {
          for (const key of keys) void mutate(key);
        });
      }

      source.onerror = () => {
        // EventSource retries on its own ONLY while the connection is merely
        // dropped. A 401 (expired ticket) closes it for good, and a ticket lives
        // 30s while a stream lives hours — so reconnection has to re-mint, which
        // means owning the retry rather than trusting the browser's.
        source?.close();
        source = null;
        schedule();
      };
    }

    function schedule() {
      if (closed || retry) return;
      retry = setTimeout(() => {
        retry = null;
        void connect();
      }, delay);
      delay = Math.min(delay * 2, 30000);
    }

    void connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      source?.close();
    };
  }, [user, mutate]);
}
