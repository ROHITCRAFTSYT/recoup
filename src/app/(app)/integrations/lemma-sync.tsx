"use client";

import { useState, useTransition } from "react";
import { syncToLemmaAction } from "@/app/actions";
import { RefreshIcon } from "@/lib/icons";

export default function LemmaSync() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mt-4 flex flex-col gap-3">
      <button
        onClick={() => start(async () => setMsg(await syncToLemmaAction()))}
        disabled={pending}
        className="flex w-fit items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-accent-fg transition hover:opacity-90 disabled:opacity-50"
      >
        <RefreshIcon className="h-3.5 w-3.5" />
        {pending ? "Syncing to pod…" : "Sync invoices to Lemma pod"}
      </button>
      {msg && (
        <div className="rounded-lg border border-border bg-background p-2.5 text-xs text-muted">
          {msg}
        </div>
      )}
    </div>
  );
}
