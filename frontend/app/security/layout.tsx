import type { ReactNode } from "react";

// Route title — the page is a client component, which can't export metadata itself; this
// pass-through layout carries it (same pattern as app/login/layout.tsx).
export const metadata = { title: "Two-factor login — Citoya" };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
