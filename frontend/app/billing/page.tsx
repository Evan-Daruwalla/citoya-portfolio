"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, api } from "@/lib/api";
import { TOKEN_KEY, useAuth } from "@/lib/auth-context";
import { BILLING_LIVE } from "@/lib/flags";

function BillingInner() {
  const { user, loading } = useAuth();
  const params = useSearchParams();
  const status = params.get("status");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upgrade() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.createCheckout(token);
      window.location.href = url; // redirect to Stripe-hosted Checkout
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start checkout.");
      setBusy(false);
    }
  }

  if (loading) return null;
  if (!user || user.role !== "org") {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <p className="text-muted-foreground">Billing is for organization accounts.</p>
      </main>
    );
  }

  const isPro = user.plan === "pro";
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 p-8">
      <div>
        <span className="section-tag">Organization</span>
        <h1 className="section-title">Billing</h1>
      </div>

      {status === "success" && (
        <p className="text-sm text-primary">Payment received. Your plan flips to Pro once Stripe confirms it.</p>
      )}
      {status === "cancelled" && <p className="text-sm text-muted-foreground">Checkout cancelled.</p>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current plan
            <span className={`badge ${isPro ? "badge-featured" : "badge-verified"}`}>
              {isPro ? "Pro" : "Free"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">
            Free covers up to 3 active listings. Pro is unlimited listings plus up to 3 featured
            listings that surface first in Discover.
          </p>
          {isPro ? (
            <p className="text-muted-foreground">
              Cancel any time from your Stripe receipt email. Cancelling drops you back to Free.
            </p>
          ) : BILLING_LIVE ? (
            <Button disabled={busy} onClick={upgrade} className="self-start">
              {busy ? "Starting…" : "Upgrade to Pro"}
            </Button>
          ) : (
            <p className="text-muted-foreground">
              Pro upgrades aren’t open yet — every organization is on the free Community plan
              while Citoya launches. Free covers up to 3 active listings.
            </p>
          )}
          {error && <p className="text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </main>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingInner />
    </Suspense>
  );
}
