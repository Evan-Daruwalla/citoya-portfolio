"use client";

/**
 * Client auth state. The JWT lives in localStorage under `TOKEN_KEY`; on mount we
 * hydrate `user` by calling `/auth/me` with it (a stale/invalid token is dropped and
 * the app renders logged-out). `login`/`register` set the token then fetch the user;
 * `register` auto-logs-in. Consume via `useAuth()` inside `<AuthProvider>` (mounted in
 * the root layout). `loading` is true only during the initial hydrate — gate redirects
 * on it so a page doesn't bounce a logged-in user to /login before hydration finishes.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSWRConfig } from "swr";

import { api, ApiError, TOKEN_KEY } from "@/lib/api";
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
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { mutate } = useSWRConfig();

  /**
   * Drop every cached response. Called whenever the signed-in identity changes.
   *
   * SWR's cache is process-global and survives until a hard reload — there is no
   * `<SWRConfig>` in this app, and nothing else clears it. Without this, signing
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

  async function login(email: string, password: string) {
    // Before the new identity exists, not after — see clearCache.
    clearCache();
    const { access_token } = await api.login({ email, password });
    localStorage.setItem(TOKEN_KEY, access_token);
    setUser(await api.me(access_token));
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
    <AuthContext.Provider value={{ user, loading, login, register, refresh, logout }}>
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
