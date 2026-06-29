"use client";

import { useTransition } from "react";
import {
  runWorkflowAction,
  setStatusAction,
  markPaidAction,
} from "@/app/actions";
import { INVOICE_STATUSES, statusLabel } from "@/lib/ui";
import { SparkIcon, CheckIcon } from "@/lib/icons";

export function RunWorkflowButton({
  invoiceId,
  analyzed,
}: {
  invoiceId: string;
  analyzed: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => runWorkflowAction(invoiceId))}
      disabled={pending}
      className="cta-shine flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-accent-fg transition hover:opacity-90 disabled:opacity-60"
    >
      <SparkIcon className="h-4 w-4" />
      {pending
        ? "Running risk → policy → draft → review…"
        : analyzed
          ? "Re-run recovery pipeline"
          : "Run recovery pipeline"}
    </button>
  );
}

export function StatusSelect({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: string;
}) {
  const [pending, start] = useTransition();
  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        start(() => setStatusAction(invoiceId, next));
      }}
      className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium capitalize outline-none focus:border-accent disabled:opacity-60"
    >
      {INVOICE_STATUSES.filter((s) => s !== "analyzing").map((s) => (
        <option key={s} value={s}>
          {statusLabel(s)}
        </option>
      ))}
    </select>
  );
}

export function MarkPaidButton({ invoiceId }: { invoiceId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => markPaidAction(invoiceId))}
      disabled={pending}
      className="flex items-center gap-1.5 rounded-lg border border-positive/40 bg-positive-soft px-2.5 py-1.5 text-xs font-semibold text-positive transition hover:opacity-90 disabled:opacity-60"
    >
      <CheckIcon className="h-3.5 w-3.5" />
      {pending ? "Marking…" : "Mark paid"}
    </button>
  );
}
