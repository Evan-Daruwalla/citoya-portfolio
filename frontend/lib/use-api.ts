"use client";

/**
 * The one data-fetch idiom for authenticated client pages (M13.6, decided
 * 2026-08-31: adopt SWR).
 *
 * Replaces the hand-rolled `useEffect` + `useState(loading)` + `useState(error)`
 * pattern that 19 pages each wrote slightly differently — the shape that already
 * shipped two real bugs, both of the same kind: a failed load falling through to
 * an EMPTY state, telling a student with verified hours that they had none
 * (audit 2026-08-11), and a page whose `fetching` flag never cleared.
 * `loading` here stays true while auth is still hydrating, so a page can never
 * render "nothing here yet" before it knows whether the fetch even ran.
 *
 * Usage — the key identifies the DATA, not the caller:
 *
 *   const { data, loading, error, retry } = useAuthedQuery(
 *     "applications/my", (t) => api.myApplications(t),
 *   );
 *
 * Two pages sharing a key share one cache entry, which is the point (the header
 * and a page can both read the unread count without two requests) — so the same
 * key must always mean the same fetcher. Pass `null` as the key to hold the
 * request (a dependent fetch whose input isn't known yet).
 */

import useSWR, { type SWRConfiguration } from "swr";

import { ApiError, TOKEN_KEY } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

/**
 * Retry network failures, never client errors.
 *
 * SWR's default retries every error with backoff. That is wrong for this API:
 * a 403 from the guardian-consent gate, a 404, or a 401 on an expired token are
 * all settled answers — retrying them hammers the endpoint (and the in-memory
 * rate limiter counts every attempt) while the user watches a spinner that can
 * never resolve. 5xx and offline errors are worth retrying; those carry no
 * `ApiError` status or a 5xx one.
 */
const onErrorRetry: SWRConfiguration["onErrorRetry"] = (
  error,
  _key,
  _config,
  revalidate,
  { retryCount },
) => {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return;
  if (retryCount >= 3) return;
  setTimeout(() => revalidate({ retryCount }), 2000 * 2 ** retryCount);
};

export function useAuthedQuery<T>(
  key: string | null,
  fetcher: (token: string) => Promise<T>,
  config?: SWRConfiguration<T>,
) {
  const { user, loading: authLoading } = useAuth();
  // Hold the request until auth has hydrated and a user exists — otherwise the
  // first render fires a tokenless call that 401s and clears nothing useful.
  const active = !authLoading && user !== null && key !== null;

  const { data, error, isLoading, mutate } = useSWR<T>(
    active ? key : null,
    () => {
      // Read the token at fetch time, not render time: it is a localStorage
      // value, so touching it during render would differ between server and
      // client. `api` clears it itself on a 401.
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) throw new ApiError(401, "You're signed out.");
      return fetcher(token);
    },
    { onErrorRetry, ...config },
  );

  return {
    data,
    error: error as ApiError | undefined,
    // True while auth hydrates too — see the header comment.
    loading: authLoading || (active && isLoading),
    /** Re-run the request (the Retry button). */
    retry: () => {
      void mutate();
    },
    /** Full SWR mutate, for optimistic updates and post-write refreshes. */
    mutate,
  };
}


/**
 * The same contract for endpoints that need no token — the public leaderboard,
 * an opportunity detail page, a shared portfolio, a guardian consent link.
 *
 * Split from `useAuthedQuery` rather than given an `auth: false` flag because
 * the two differ in the one thing that matters: this one must fetch for a
 * signed-OUT visitor, while that one must not fire at all until auth has
 * hydrated. A boolean hiding that difference is how a public page ends up
 * silently gated on a user it never needed.
 */
export function usePublicQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  config?: SWRConfiguration<T>,
) {
  const { data, error, isLoading, mutate } = useSWR<T>(key, fetcher, {
    onErrorRetry,
    ...config,
  });

  return {
    data,
    error: error as ApiError | undefined,
    loading: key !== null && isLoading,
    retry: () => {
      void mutate();
    },
    mutate,
  };
}
