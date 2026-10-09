import type { ReactNode } from "react";

// Route title (audit 2026-07-13 #12) — pages here are client components, which
// can't export metadata themselves; this pass-through layout carries it.
// audit DY Low 36, 2026-10-07 (Evan's decision, 2026-10-07): keep /portfolio and
// /portfolio/[id] out of search indexes; they hold a student's personal record.
export const metadata = {
  title: "Service Transcript — Citoya",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
