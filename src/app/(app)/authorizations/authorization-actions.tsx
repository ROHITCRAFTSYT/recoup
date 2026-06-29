"use client";

import { useTransition } from "react";
import {
  authorizeLatestActionAction,
  declineActionAction,
} from "@/app/actions";
import { CheckIcon, RefreshIcon, ShieldIcon } from "@/lib/icons";

export default function AuthorizationActions({
  invoiceId,
  allowed,
  requiredRoleLabel,
}: {
  invoiceId: string;
  allowed: boolean;
  requiredRoleLabel: string;
}) {
  const [approving, startApprove] = useTransition();
  const [declining, startDecline] = useTransition();
  const busy = approving || declining;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        {allowed ? (
          <button
            onClick={() => startApprove(() => authorizeLatestActionAction(invoiceId))}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-positive px-3.5 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            <CheckIcon className="h-3.5 w-3.5" />
            {approving ? "Authorizing…" : "Authorize"}
          </button>
        ) : (
          <span
            className="flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3.5 py-2 text-xs font-medium text-muted"
            title={`Above your authority — needs ${requiredRoleLabel}`}
          >
            <ShieldIcon className="h-3.5 w-3.5" />
            Needs {requiredRoleLabel}
          </span>
        )}
        <button
          onClick={() => startDecline(() => declineActionAction(invoiceId))}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-xs font-medium text-muted transition hover:bg-black/[.04] disabled:opacity-60"
        >
          <RefreshIcon className="h-3.5 w-3.5" />
          {declining ? "Redrafting…" : "Decline"}
        </button>
      </div>
      {!allowed && (
        <span className="text-[10px] text-muted">
          Switch role in the sidebar to authorize
        </span>
      )}
    </div>
  );
}
