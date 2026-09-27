import type { ReactNode } from "react";

// Route title, the same pass-through pattern as app/hours/layout.tsx. It matters more
// here: browsers name the saved PDF after the page title.
export const metadata = { title: "Volunteer hours - Citoya" };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
