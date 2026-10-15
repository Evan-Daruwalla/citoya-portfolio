"use client";

/**
 * Client auth state. The JWT lives in localStorage under `TOKEN_KEY`; on mount we
 * hydrate `user` by calling `/auth/me` with it (a stale/invalid token is dropped and
 * the app renders logged-out). `login`/`register` set the token then fetch the user;
 * `register` auto-logs-in. Consume via `useAuth()` inside `<AuthProvider>` (mounted in
 * the root layout). `loading` is true only during the initial hydrate — gate redirects
 * on it so a page doesn't bounce a logged-in user to /login before hydration finishes.
 * Two-factor (2FA build, 2026-10-13): `login` returns `{ mfaToken }` when a code is still
 * needed (finish with `loginMfa`); `adoptToken` stores the fresh token enable/disable return;
 * an account that must have two-factor but does not is sent to /security.
 */
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSWRConfig } from "swr";

import { api, ApiError, MFA_ENROLLMENT_REQUIRED_EVENT, SESSION_EXPIRED_EVENT, TOKEN_KEY } from "@/lib/api";
import type { User } from "@/lib/types";

type RegisterInput = {
  email: string;
  password: string;
  full_name?: string;
  role?: string;
  dob?: string;
  guardian_name?: string;
  guardian_email?: string;
  turnstile_token?: string;
  accepted_terms?: boolean;
};

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** `{ user }` = signed in. `{ mfaToken }` = the password was right and a code is still needed. */
  login: (
    email: string,
    password: string,
    opts?: { restore?: boolean },
  ) => Promise<{ mfaToken: string } | { user: User }>;
  loginMfa: (mfaToken: string, code: string, opts?: { restore?: boolean }) => Promise<User>;
  /** Store the new token enable/disable return (they bump token_version) and reload the user. */
  adoptToken: (accessToken: string) => Promise<User>;
  /** The stored token, for pages that call an authenticated endpoint without touching storage. */
  getToken: () => string | null;
  register: (input: RegisterInput) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { mutate } = useSWRConfig();
  const router = useRouter();
  const pathname = usePathname();

  /**
   * Drop every cached response. Called whenever the signed-in identity changes.
   *
   * SWR's cache is process-global and survives until a hard reload — the app's
   * `<SWRConfig>` (components/swr-provider.tsx) sets defaults only, no per-user cache, and
   * nothing else clears it. Without this, signing
   * out and signing in as someone else in the SAME TAB left every key populated,
   * and SWR serves a cached entry synchronously (`isLoading` is false when data
   * exists). The next account's first paint therefore rendered the PREVIOUS
   * account's data — on this platform, one minor's verified-hours transcript in
   * another minor's browser (audit 2026-09-01).
   *
   * `revalidate: false` because the new session refetches on mount anyway; asking
   * SWR to revalidate here would fire every key with whatever token happens to be
   * in localStorage mid-swap.
   *
   * OBSERVED, not theorised (2026-09-01). Reproduced on a production build with
   * the clear disabled: sign in, save an opportunity, click Log Out — the token
   * is gone from localStorage and `saved/ids` is STILL in the cache, holding
   * that account's private list. With the clear enabled, the same sequence
   * leaves zero keys holding data. The next account in that tab inherits
   * whatever the previous one cached.
   *
   * Method note, because the first attempt to reproduce this FAILED and wrongly
   * cleared the code: navigate with `<Link>`/`router.push` only. A plain `<a>`
   * click is a full page load in the App Router, which destroys the JS context
   * and the cache with it — so it "passes" no matter what this function does.
   */
  function clearCache() {
    void mutate(() => true, undefined, { revalidate: false });
  }

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me(token)
      .then(setUser)
      .catch((err) => {
        // Only a REJECTED token gets dropped. This caught every failure,
        // including "the API is unreachable" — so a dead backend, a dropped
        // wifi connection or a deploy restart silently signed the user out and
        // made them log in again, with the session gone rather than resumed
        // (landing-check 2026-08-31, seen live with the API stopped). A network
        // error says nothing about whether the token is valid, so it must not
        // be treated as an answer. `api.request` already clears the key itself
        // on a 401; this branch is what handles 401s raised before that, and
        // any other status is left alone.
        if (err instanceof ApiError && err.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Audit DY Med 16/17, 2026-10-05. Two ways the stored token changes without this
  // tab calling logout():
  // - Med 17: the server rejected it (401), so `request` removed the key and fired
  //   SESSION_EXPIRED_EVENT. Without this the UI stayed signed in until a reload.
  // - Med 16: another tab signed in, out or in as someone else. The `storage` event
  //   fires only in the OTHER tabs, so this tab would keep showing the old identity
  //   and its cached data. Re-read the token and re-hydrate from it.
  useEffect(() => {
    function onExpired() {
      setUser(null);
      clearCache();
    }
    function onStorage(e: StorageEvent) {
      // `key === null` is localStorage.clear(), which also removed the token.
      if (e.key !== null && e.key !== TOKEN_KEY) return;
      // Audit DY Low 38, 2026-10-07: the new token is already in storage when this
      // fires, so clear now and hydrate from it. Same order as `login`.
      const token = localStorage.getItem(TOKEN_KEY);
      clearCache();
      if (!token) {
        setUser(null);
        return;
      }
      api
        .me(token)
        .then(setUser)
        .catch((err) => {
          // Same rule as the hydrate effect: only a rejected token is an answer.
          if (err instanceof ApiError && err.status === 401) setUser(null);
        });
    }
    // An admin/org API call answered 403 MFA_ENROLLMENT_REQUIRED: go set two-factor up.
    // Reads the live path (the closure's would be stale), so it never loops on /security.
    function onEnrollmentRequired() {
      if (window.location.pathname !== "/security") router.replace("/security");
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    window.addEventListener(MFA_ENROLLMENT_REQUIRED_EVENT, onEnrollmentRequired);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
      window.removeEventListener(MFA_ENROLLMENT_REQUIRED_EVENT, onEnrollmentRequired);
      window.removeEventListener("storage", onStorage);
    };
    // clearCache closes over SWR's stable `mutate`; re-subscribing every render is
    // not needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enforcement (2FA build, 2026-10-13): an account that must have two-factor but does not
  // is held on /security. Runs on every user or path change, so it covers hydrate, login,
  // refresh and adoptToken alike, and a nav click away from /security bounces back. The API
  // refuses such an account's other calls anyway (403 MFA_ENROLLMENT_REQUIRED); this is the UX.
  // /logout is exempt too: since logout became a confirm page (2026-10-13) such an account
  // could otherwise never sign out (POST /auth/logout is on the server's enrollment allowlist).
  useEffect(() => {
    if (user && user.two_factor_required && !user.two_factor_enabled && pathname !== "/security" && pathname !== "/logout") {
      router.replace("/security");
    }
  }, [user, pathname, router]);

  async function login(email: string, password: string, opts?: { restore?: boolean }) {
    const res = await api.login({ email, password, restore: opts?.restore });
    if ("mfa_required" in res) return { mfaToken: res.mfa_token };
    const { access_token } = res;
    localStorage.setItem(TOKEN_KEY, access_token);
    // Audit DY Low 38, 2026-10-07: clear AFTER the new token is stored, before the new
    // identity is hydrated. Clearing first, while the old token was still in storage,
    // let SWR refetch the previous account's keys during the login round trip and
    // re-fill the cache this call had just emptied. `mutate` also discards any request
    // already in flight, so a late old-token response cannot land after this — see
    // clearCache.
    clearCache();
    const me = await api.me(access_token);
    setUser(me);
    return { user: me };
  }

  async function loginMfa(mfaToken: string, code: string, opts?: { restore?: boolean }) {
    const { access_token } = await api.loginMfa({ mfa_token: mfaToken, code, restore: opts?.restore });
    return adoptToken(access_token);
  }

  // The code step and enable/disable land here: same three steps and order as `login` above
  // (store, clear the cache, hydrate), for the same Low 38 reason.
  async function adoptToken(access_token: string) {
    localStorage.setItem(TOKEN_KEY, access_token);
    clearCache();
    const me = await api.me(access_token);
    setUser(me);
    return me;
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  async function register(input: RegisterInput) {
    await api.register(input);
    await login(input.email, input.password);
  }

  async function refresh() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) setUser(await api.me(token));
  }

  function logout() {
    const token = localStorage.getItem(TOKEN_KEY);
    // Best-effort server-side invalidation (bumps token_version so the token
    // dies everywhere). Fire-and-forget: never block the UI or trap the user
    // logged-in if the network/server is down — we clear locally regardless.
    if (token) void api.logout(token).catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    clearCache();
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginMfa, adoptToken, getToken, register, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export { ApiError, TOKEN_KEY };
