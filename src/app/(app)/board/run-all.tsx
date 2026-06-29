"use client";

import { useTransition } from "react";
import { processAllOutstandingAction } from "@/app/actions";
import { SparkIcon } from "@/lib/icons";

export default function RunAll({ count }: { count: number }) {
  const [pending, start] = useTransition();
  if (count === 0)
    return (
      <span className="text-xs text-muted">No outstanding invoices to run</span>
    );

  return (
    <button
      onClick={() => start(() => processAllOutstandingAction())}
      disabled={pending}
      className="cta-shine flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:opacity-90 disabled:opacity-60"
    >
      <SparkIcon className="h-4 w-4" />
      {pending
        ? "Running recovery pipeline…"
        : `Run recovery on ${count} outstanding`}
    </button>
  );
}
