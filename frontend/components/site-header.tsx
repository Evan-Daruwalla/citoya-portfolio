"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useAuthedQuery } from "@/lib/use-api";
import { useEventStream } from "@/lib/use-event-stream";
import { isV1Route } from "@/lib/v1-routes";

export function SiteHeader() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();

  // The one open SSE stream for the tab. Mounted here because the header is on
  // every non-`.v1` route; an event invalidates the keys below and the badge
  // re-reads itself. This is what makes the count live rather than
  // refocus-driven (2026-09-07).
  useEventStream();

  // M13.6: was a hand-rolled useEffect + useState. The key is SHARED with
  // /notifications, so marking one read updates the badge instead of leaving it
  // stale until the header remounted — the bug HANDOFF listed under M13.6 and
  // the reason this component was worth converting first.
  const { data, error } = useAuthedQuery("notifications/unread-count", (t) =>
    api.unreadCount(t),
  );
  // null = not known (never fetched, or the fetch failed). Distinct from 0: a
  // badge must not assert a number it does not have, and showing 0 on a failed
  // read is indistinguishable from "nothing unread" (audit 2026-09-01).
  const unread = error || !data ? null : data.unread;

  if (isV1Route(pathname)) return null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="" width={30} height={30} className="rounded-md" unoptimized />
            <span className="font-display text-xl text-primary">
              Citoya
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            <Link
              href="/discover"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Discover
            </Link>
            <Link
              href="/leaderboard"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Leaderboard
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {loading ? null : user ? (
            <>
              <Link
                href="/notifications"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Notifications{unread !== null && unread > 0 ? ` (${unread})` : ""}
              </Link>
              <Link
                href="/inbox"
                className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:inline"
              >
                Inbox
              </Link>
              <Button variant="outline" size="sm" onClick={logout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
