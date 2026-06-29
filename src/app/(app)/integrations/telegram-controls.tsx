"use client";

import { useState, useTransition } from "react";
import { testTelegramAction, syncTelegramAction } from "@/app/actions";
import { SendIcon, RefreshIcon } from "@/lib/icons";

export default function TelegramControls({ configured }: { configured: boolean }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [testing, startTest] = useTransition();
  const [syncing, startSync] = useTransition();

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => startTest(async () => setMsg(await testTelegramAction()))}
          disabled={testing || !configured}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-accent-fg transition hover:opacity-90 disabled:opacity-50"
        >
          <SendIcon className="h-3.5 w-3.5" />
          {testing ? "Sending…" : "Send test message"}
        </button>
        <button
          onClick={() => startSync(async () => setMsg(await syncTelegramAction()))}
          disabled={syncing || !configured}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-xs font-medium text-foreground transition hover:bg-black/[.04] disabled:opacity-50"
        >
          <RefreshIcon className="h-3.5 w-3.5" />
          {syncing ? "Syncing…" : "Sync replies & approvals"}
        </button>
      </div>
      {msg && (
        <div className="rounded-lg border border-border bg-background p-2.5 text-xs text-muted">
          {msg}
        </div>
      )}
    </div>
  );
}
