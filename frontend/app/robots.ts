import type { MetadataRoute } from "next";

import { IS_STAGING } from "@/lib/flags";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  // A staging deploy is public but must never be indexed: its Terms are an
  // unsigned draft and its data is throwaway. Everything, and no sitemap.
  if (IS_STAGING) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing here belongs in a search index. Four groups, for four reasons
      // (scheduled audit 2026-09-20, Appendix R H5 — the guardian routes were the
      // omission that mattered).
      disallow: [
        // 1. TOKEN-BEARING GUARDIAN LINKS. These are emailed to a parent. Both
        // tokens now sit in the URL FRAGMENT, which a crawler never receives
        // (manage 2026-09-20, approve 2026-09-23), so this rule is defence in depth:
        // it was written when the token sat in the PATH and an indexed URL would
        // have published it. Highest priority of the four.
        "/consent/",
        // 2. Operator surfaces.
        "/admin",
        "/dashboard",
        "/applicants",
        "/inbox",
        "/notifications",
        // 3. Authenticated per-user surfaces: signed-out crawlers get a redirect
        // or an empty shell, so indexing them is noise at best and a stale
        // half-page in results at worst.
        "/applications",
        "/billing",
        "/hours",
        "/saved",
        "/verify-hours",
        "/welcome",
        // 4. Credential flows — tokenised like the guardian links, and never
        // useful in a result.
        "/forgot",
        "/reset",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
