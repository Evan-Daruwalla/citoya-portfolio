import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { LEADERBOARD_ENABLED } from "@/lib/flags";

// Route title (audit 2026-07-13 #12) — pages here are client components, which
// can't export metadata themselves; this pass-through layout carries it.
// While the board is hidden (2026-10-25) this route is a 404, so it takes the 404 title.
export const metadata = {
  title: LEADERBOARD_ENABLED ? "Community leaderboard — Citoya" : "Page not found — Citoya",
};

export default function Layout({ children }: { children: ReactNode }) {
  if (!LEADERBOARD_ENABLED) notFound();
  return children;
}
