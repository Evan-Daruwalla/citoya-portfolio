import type { MetadataRoute } from "next";

import { IS_STAGING } from "@/lib/flags";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Static public routes only. Dynamic /opportunities/<id> URLs are a later follow-up.
const ROUTES = [
  "/",
  "/discover",
  "/leaderboard",
  "/pricing",
  "/for-organizations",
  "/donate",
  "/privacy",
  "/terms",
  "/login",
  "/register",
];

export default function sitemap(): MetadataRoute.Sitemap {
  // Staging advertises nothing: robots.ts already disallows it, and a sitemap would
  // hand a crawler the URL list anyway.
  if (IS_STAGING) return [];
  return ROUTES.map((route) => ({
    url: `${BASE_URL}${route}`,
  }));
}
