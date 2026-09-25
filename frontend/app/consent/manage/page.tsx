"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, api } from "@/lib/api";
import type { ConsentManageContext } from "@/lib/types";

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
    tokenRef.current = fromHash;
    (fromHash
      ? api.manageContext(fromHash)
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

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
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
                  {ctx.student_first_name} {ctx.student_last_initial}
                  {ctx.student_last_initial ? "." : ""}
                </span>
                . Current status: <span className="font-medium">{ctx.status}</span>.
              </p>
              {error && <p className="text-sm text-destructive">{error}</p>}
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
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
