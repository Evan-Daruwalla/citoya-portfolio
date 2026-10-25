import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { LEADERBOARD_ENABLED } from "@/lib/flags";

// Route title (audit 2026-07-13 #12) — pages here are client components, which
// can't export metadata themselves; this pass-through layout carries it.
export const metadata = { title: "Community leaderboard — Citoya" };

export default function Layout({ children }: { children: ReactNode }) {
  if (!LEADERBOARD_ENABLED) notFound();
  return children;
}
