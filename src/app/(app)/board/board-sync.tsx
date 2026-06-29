"use client";

/**
 * BoardSync — quick-sync button for the collections board.
 *
 * Pushes the current invoice book and pending authorizations
 * to the live Lemma pod via the server action.
 */

import { useTransition, useState } from "react";
import { syncToLemmaAction } from "@/app/actions";
import { PlugIcon, RefreshIcon } from "@/lib/icons";

export default function BoardSync() {
  const [pending, start] = useTransition();
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const handleSync = () => {
    start(async () => {
      const msg = await syncToLemmaAction();
      setLastMessage(msg);
      setTimeout(() => setLastMessage(null), 5000);
    });
  };

  return (
    <div className="flex items-center gap-3">
      {lastMessage && (
        <span className="text-xs text-positive">{lastMessage}</span>
      )}
      <button
        onClick={handleSync}
        disabled={pending}
        className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted transition hover:text-foreground disabled:opacity-60"
        title="Sync invoices and authorizations to Lemma pod"
      >
        <PlugIcon className="h-3.5 w-3.5" />
        {pending ? (
          <>
            <RefreshIcon className="inline h-3.5 w-3.5 animate-spin" />
            Syncing…
          </>
        ) : (
          "Sync to pod"
        )}
      </button>
    </div>
  );
}
