"use client";

/**
 * Two-step logout (Evan, 2026-10-13): every Log Out control links here and the sign-out
 * happens only on the confirm button. The forced logouts after account deletion stay
 * one-step (they call `logout` directly). `leaving` stops the signed-out effect below from
 * racing the confirm button's own redirect to "/".
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { V1Shell } from "@/components/v1/v1-shell";
import { useAuth } from "@/lib/auth-context";
import { dashboardPath } from "@/lib/v1-routes";

export default function LogoutPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const leaving = useRef(false);

  useEffect(() => {
    if (!loading && !user && !leaving.current) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <V1Shell>
      <div className="auth-wrap">
        <div className="modal-card">
          <div className="mhdr">
            <div className="mtitle">Log out?</div>
            <div className="msub">You will need your password to log back in.</div>
          </div>
          <div className="mbody">
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn-p"
                type="button"
                onClick={() => {
                  leaving.current = true;
                  logout();
                  router.replace("/");
                }}
              >
                Log out
              </button>
              <Link className="btn-s" href={dashboardPath(user)}>
                Stay logged in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </V1Shell>
  );
}
