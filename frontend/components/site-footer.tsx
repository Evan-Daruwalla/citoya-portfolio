"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isV1Route } from "@/lib/v1-routes";

export function SiteFooter() {
  const pathname = usePathname();
  if (isV1Route(pathname)) return null;

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
        <p>Citoya: free for students, always.</p>
        <nav className="flex items-center gap-4">
          <Link href="/discover" className="transition-colors hover:text-foreground">
            Discover
          </Link>
          <Link href="/leaderboard" className="transition-colors hover:text-foreground">
            Leaderboard
          </Link>
        </nav>
      </div>
    </footer>
  );
}
