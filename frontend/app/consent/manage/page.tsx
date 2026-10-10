"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, api } from "@/lib/api";
import type { ConsentManageContext } from "@/lib/types";

import { GuardianDataActions } from "./data-actions";

// audit DY Low 37, 2026-10-07: this token is long-lived and later actions need it, so it
// cannot just be dropped like the single-use ones. It moves from the address bar into
// sessionStorage (this tab only), so browser history no longer holds it and a reload in
// the same tab still works.
const CONSENT_STORAGE_SLOT = "citoya_consent_manage_token";

export default function ConsentManagePage() {
  // The token arrives in the URL FRAGMENT (`/consent/manage#<token>`), not a path
  // segment. Everything after "#" stays inside the browser and is never sent to a
  // server, so this permanent credential cannot reach an access log, a proxy log
  // or a Referer header — which a path segment guaranteed it would
  // (2026-09-20, Appendix R H4 sibling).
  //
  // Read in an effect, not during render: `location` does not exist on the server,
  // and this page is prerendered.
  // A ref, not state: the token is never rendered and must not trigger a render.
  // Keeping it out of state also keeps every setState in this file inside an
  // async callback, which is what `react-hooks/set-state-in-effect` asks for.
  const tokenRef = useRef<string>("");
  const [ctx, setCtx] = useState<ConsentManageContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const fromHash = window.location.hash.replace(/^#/, "");
    if (fromHash) {
      tokenRef.current = fromHash;
      try {
        sessionStorage.setItem(CONSENT_STORAGE_SLOT, fromHash);
      } catch {
        // Storage blocked: the page works until it is reloaded, then the email link is needed.
      }
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } else if (!tokenRef.current) {
      try {
        tokenRef.current = sessionStorage.getItem(CONSENT_STORAGE_SLOT) ?? "";
      } catch {
        tokenRef.current = "";
      }
    }
    const token = tokenRef.current;
    (token
      ? api.manageContext(token)
      : Promise.reject(new Error("missing fragment"))
    )
      .then(setCtx)
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? err.message
            : "This link is invalid or missing its access code. Use the link from your email."
        )
      );
  }, []);

  async function revoke() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.revokeConsent(tokenRef.current);
      setDone(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  // A guardian delete scrubs the manage token too, so the link is dead from here on: drop
  // it and show only the server's final message (K4, 2026-09-27).
  function deleted(message: string) {
    tokenRef.current = "";
    try {
      sessionStorage.removeItem(CONSENT_STORAGE_SLOT);
    } catch {
      // Nothing stored to remove.
    }
    setDone(message);
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Manage your approval</CardTitle>
          <CardDescription>You can revoke your consent at any time.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {done ? (
            <p className="text-sm">{done}</p>
          ) : ctx ? (
            <>
              <p className="text-sm">
                Approval for{" "}
                <span className="font-medium">
                  {ctx.student_first_name}
                  {ctx.student_last_initial ? ` ${ctx.student_last_initial}.` : ""}
                </span>
                {/* The initial's own period ends the sentence ("Robin R. Current"), 2026-09-28. */}
                {ctx.student_last_initial ? "" : "."} Current status:{" "}
                <span className="font-medium">{ctx.status}</span>.
              </p>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              {ctx.status === "revoked" ? (
                <p className="text-sm text-muted-foreground">You&apos;ve already revoked approval.</p>
              ) : !confirming ? (
                <Button variant="outline" onClick={() => setConfirming(true)}>
                  Revoke consent
                </Button>
              ) : (
                <div className="flex gap-3">
                  <Button onClick={revoke} disabled={busy}>
                    {busy ? "Revoking…" : "Yes, revoke"}
                  </Button>
                  <Button variant="outline" onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </>
          ) : error ? (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </CardContent>
      </Card>
      {ctx && !done && (
        <GuardianDataActions
          token={() => tokenRef.current}
          childName={ctx.student_first_name}
          onDeleted={deleted}
        />
      )}
    </main>
  );
}
