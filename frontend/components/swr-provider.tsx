"use client";

import { SWRConfig } from "swr";

/**
 * App-wide SWR defaults. Lives in its own client component because the root layout is a
 * server component and cannot pass a config object down to a client provider tree.
 *
 * `revalidateOnFocus: false` (2026-10-12, audit 2026-10-11 #18, D9): every tab focus refetched
 * every mounted query, which is a burst of API calls per tab switch for data the push channel
 * (`lib/use-event-stream.ts`) already keeps current. Reconnect revalidation stays on, and a
 * query that wants focus revalidation can still ask for it.
 */
export function SWRProvider({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={{ revalidateOnFocus: false }}>{children}</SWRConfig>;
}
