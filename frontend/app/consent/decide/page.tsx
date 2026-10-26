"use client";

import { errorText } from "@/lib/errors";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { ConsentContext } from "@/lib/types";

export default function ConsentDecisionPage() {
  // The approve token arrives in the URL FRAGMENT (`/consent/decide#<token>`), the
  // same way the manage page gets its token. It used to be a path segment, which
  // wrote the token that GRANTS consent into the access log of every page load and
  // API call; a replayed log line approved a minor's account (AO H1, 2026-09-23).
  // Everything after "#" stays inside the browser.
  //
  // Read in an effect, not during render: `location` does not exist on the server,
  // and this page is prerendered. A ref, not state: the token is never rendered.
  const tokenRef = useRef<string>("");
  const [ctx, setCtx] = useState<ConsentContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const confirmRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (confirmDecline) confirmRef.current?.focus();
  }, [confirmDecline]);

  useEffect(() => {
    const fromHash = window.location.hash.replace(/^#/, "");
    // audit DY Low 37, 2026-10-07: the token is single-use, so once it is held in the ref
    // the fragment comes out of the address bar and history. The guard keeps a second
    // run of this effect (StrictMode in development) from reading the emptied hash.
    if (fromHash) {
      tokenRef.current = fromHash;
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    const token = tokenRef.current;
    (token ? api.consentContext(token) : Promise.reject(new Error("missing fragment")))
      .then(setCtx)
      .catch((err) =>
        setError(
          errorText(
            err,
            "This link is invalid or missing its access code. Use the link from your email."
          )
        )
      );
  }, []);

  async function decide(decision: "approve" | "decline") {
    setBusy(true);
    setError(null);
    try {
      const res = await api.decideConsent(tokenRef.current, decision);
      setDone(res.message);
    } catch (err) {
      setError(errorText(err, "We could not record your decision. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Parent / guardian approval</CardTitle>
          <CardDescription>Citoya helps students find volunteer opportunities.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {done ? (
            <p className="text-sm">{done}</p>
          ) : ctx ? (
            <>
              <p className="text-sm">
                <span className="font-medium">
                  {ctx.student_first_name} {ctx.student_last_initial}
                  {ctx.student_last_initial ? "." : ""}
                </span>{" "}
                listed you as their parent or guardian. They cannot sign up for any volunteer
                opportunity until you approve. You can revoke your approval anytime.
              </p>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              {confirmDecline ? (
                <>
                  <p ref={confirmRef} tabIndex={-1} className="text-sm">
                    Declining deletes this student&apos;s account and your email address right away.
                    If it was a mistake, the student can sign up again.
                  </p>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => decide("decline")} disabled={busy}>
                      Yes, decline and delete
                    </Button>
                    <Button onClick={() => setConfirmDecline(false)} disabled={busy}>
                      Go back
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex gap-3">
                  <Button onClick={() => decide("approve")} disabled={busy}>
                    Approve
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmDecline(true)} disabled={busy}>
                    Decline
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
    </main>
  );
}
