"use client";

/**
 * Cloudflare Turnstile signup bot defense (M11.1). Renders NOTHING and reports no
 * token unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, so local dev / CI (no key)
 * behave exactly as before. Uses the plain script API — no npm dependency. Loads
 * api.js once (explicit render), renders the widget into a div, and reports the
 * solved token to the parent via onToken (null on expiry/error so the parent can
 * re-require a fresh solve). The paired server key gates the actual request.
 */
import { useEffect, useRef, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_ID = "cf-turnstile-script";

interface TurnstileApi {
  render: (el: HTMLElement, opts: {
    sitekey: string;
    callback: (token: string) => void;
    "expired-callback"?: () => void;
    "error-callback"?: () => void;
  }) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    // On a load failure, remove the tag so a later mount can try again.
    const fail = (el: HTMLScriptElement) => () => {
      el.remove();
      reject(new Error("turnstile script failed to load"));
    };
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", fail(existing), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.addEventListener("load", () => resolve(), { once: true });
    s.addEventListener("error", fail(s), { once: true });
    document.head.appendChild(s);
  });
}

export function TurnstileWidget({
  onToken,
  resetSignal,
}: {
  onToken: (token: string | null) => void;
  /** Bump after a failed submit: a token is single-use, so the one just spent must
   *  be replaced with a fresh solve. */
  resetSignal?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!SITE_KEY) return;
    let widgetId: string | undefined;
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !ref.current || !window.turnstile) return;
      widgetId = window.turnstile.render(ref.current, {
        sitekey: SITE_KEY,
        callback: (token) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
      widgetIdRef.current = widgetId;
    }, () => {
      if (cancelled) return;
      setLoadFailed(true);
      onToken(null);
    });
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
      widgetIdRef.current = undefined;
    };
  }, [onToken]);

  // audit DY Med 18, 2026-10-05: Cloudflare accepts a token once. A failed submit
  // (wrong password, taken email, 429) spends it, so the retry re-sent a dead token
  // and failed for a reason the user could not see. A separate effect, so the
  // render/cleanup effect above never re-runs for a reset.
  useEffect(() => {
    const id = widgetIdRef.current;
    if (!resetSignal || !id || !window.turnstile) return;
    window.turnstile.reset(id);
    onToken(null);
  }, [resetSignal, onToken]);

  if (!SITE_KEY) return null;
  if (loadFailed) {
    return <p role="alert" className="ferr">The security check did not load. Check your connection and refresh the page.</p>;
  }
  return <div ref={ref} className="fr" style={{ marginBottom: 4 }} />;
}
