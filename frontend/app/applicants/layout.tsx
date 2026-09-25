import type { ReactNode } from "react";

// Route title (audit 2026-07-13 #12) — pages here are client components, which
// can't export metadata themselves; this pass-through layout carries it.
export const metadata = { title: "Organization Dashboard — Citoya" };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
