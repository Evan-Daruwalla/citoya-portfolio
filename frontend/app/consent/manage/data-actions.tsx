"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api } from "@/lib/api";
import { canDelete, cleanCode } from "@/lib/guardian-code";

type Action = "export" | "delete";

// K4 (2026-09-27): the guardian's export and delete had endpoints since 2026-08-11 and no
// caller. Each needs a single-use code emailed to the guardian (Appendix R H4). The backend
// allows ONE code request per child per 5 minutes, shared by both actions, and binds each code
// to the action it was asked for, so the copy says both out loud: a delete code asked for
// right after an export code is silently not sent. The two numbers are pinned to the backend
// constants by `backend/tests/test_frontend_guardian_code.py`.
export function GuardianDataActions({
  token,
  childName,
  onDeleted,
}: {
  token: () => string;
  childName: string;
  onDeleted: (message: string) => void;
}) {
  const [mode, setMode] = useState<Action | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState<"code" | Action | null>(null);

  function open(next: Action) {
    setMode(next);
    setNotice(null);
    setError(null);
    setCode("");
    setTyped("");
  }

  async function run(kind: "code" | Action, step: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await step();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const requestCode = (action: Action) =>
    run("code", async () => {
      setNotice((await api.guardianStepUp(token(), action)).message);
    });

  const download = () =>
    run("export", async () => {
      const data = await api.guardianExport(token(), cleanCode(code));
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "citoya-child-data-export.json";
      a.click();
      URL.revokeObjectURL(url);
      setCode("");
      setNotice("Downloaded. That code is now used up; ask for a new one to download again.");
    });

  const remove = () =>
    run("delete", async () => {
      onDeleted((await api.guardianDelete(token(), cleanCode(code))).message);
    });

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{childName}&apos;s data</CardTitle>
        <CardDescription>
          Download a copy, or delete the account. Each needs a code we email to the guardian
          address on file.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          <Button
            variant={mode === "export" ? "default" : "outline"}
            aria-pressed={mode === "export"}
            onClick={() => open("export")}
          >
            Download their data
          </Button>
          <Button
            variant={mode === "delete" ? "destructive" : "outline"}
            aria-pressed={mode === "delete"}
            onClick={() => open("delete")}
          >
            Delete their account
          </Button>
        </div>
        {mode && (
          <div className="flex flex-col gap-3">
            {mode === "export" ? (
              <p className="text-sm">
                The file holds their profile, applications, hours, messages, reviews,
                notifications, goals and their own calendar events: the same copy they can
                download from their dashboard.
              </p>
            ) : (
              <p className="text-sm">
                Deleting removes {childName}&apos;s account right away, and it cannot be undone.
                Their signups are released so others can take the spots, and their profile,
                guardian information, saved items and notifications are erased. Verified hours
                are kept for the organizations that recorded them, with the name removed. There
                is no 48-hour window to restore it, unlike when a student deletes their own
                account. This link stops working once the account is deleted.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              A code lasts 15 minutes, works once, and only for the action you asked it for. You
              can ask for one code every 5 minutes, for either action; a new code replaces the
              old one.
            </p>
            <Button variant="outline" onClick={() => requestCode(mode)} disabled={busy !== null}>
              {busy === "code" ? "Sending…" : "Email me a code"}
            </Button>
            {notice && (
              <p className="text-sm" role="status">
                {notice}
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="guardian-code">Code from the email</Label>
              <Input
                id="guardian-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="one-time-code"
                spellCheck={false}
              />
            </div>
            {mode === "delete" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="guardian-delete-confirm">Type DELETE to confirm</Label>
                <Input
                  id="guardian-delete-confirm"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="DELETE"
                />
              </div>
            )}
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            {mode === "export" ? (
              <Button onClick={download} disabled={busy !== null || !cleanCode(code)}>
                {busy === "export" ? "Downloading…" : "Download"}
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={remove}
                disabled={busy !== null || !canDelete(code, typed)}
              >
                {busy === "delete" ? "Deleting…" : "Delete the account"}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
