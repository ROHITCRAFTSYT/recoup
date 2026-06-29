"use client";

/**
 * useLemmaToasts — polls the Lemma pod for new records and fires
 * toast notifications when changes are detected.
 *
 * Usage: call this in a client component wrapped in ToastProvider.
 */

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/toast";

interface PodSnapshot {
  recordCount: number;
  tables: string[];
  podName: string | null;
}

export function useLemmaToasts({
  enabled = true,
  pollIntervalMs = 12000,
}: {
  enabled?: boolean;
  pollIntervalMs?: number;
}) {
  const { addToast } = useToast();
  const lastSnapshot = useRef<PodSnapshot | null>(null);
  const isFirst = useRef(true);

  useEffect(() => {
    if (!enabled) return;

    const check = async () => {
      try {
        const res = await fetch("/api/lemma/live?table=recoup_invoices&limit=1", {
          cache: "no-store",
        });
        const json = (await res.json()) as {
          ok: boolean;
          pod?: { name: string };
          tables?: { name: string }[];
          records?: unknown[];
          error?: string;
        };

        if (!json.ok) {
          // Only notify on transition from ok -> error
          if (lastSnapshot.current?.podName) {
            addToast({
              type: "error",
              title: "Lemma pod disconnected",
              message: json.error ?? "Connection lost",
              duration: 6000,
            });
          }
          lastSnapshot.current = null;
          return;
        }

        const current: PodSnapshot = {
          recordCount: json.records?.length ?? 0,
          tables: (json.tables ?? []).map((t) => t.name),
          podName: json.pod?.name ?? null,
        };

        const prev = lastSnapshot.current;

        if (isFirst.current) {
          isFirst.current = false;
          if (current.podName) {
            addToast({
              type: "info",
              title: `Connected to ${current.podName}`,
              message: `${current.tables.length} tables · ${current.recordCount} records`,
              duration: 4000,
            });
          }
          lastSnapshot.current = current;
          return;
        }

        if (prev) {
          // Detect new records
          if (current.recordCount > prev.recordCount) {
            addToast({
              type: "success",
              title: "New pod records",
              message: `${current.recordCount} records in recoup_invoices`,
              duration: 4000,
            });
          }

          // Detect new tables
          const newTables = current.tables.filter((t) => !prev.tables.includes(t));
          if (newTables.length > 0) {
            addToast({
              type: "info",
              title: "New table created",
              message: newTables.join(", "),
              duration: 4000,
            });
          }

          // Detect reconnection
          if (!prev.podName && current.podName) {
            addToast({
              type: "success",
              title: `Reconnected to ${current.podName}`,
              duration: 4000,
            });
          }
        }

        lastSnapshot.current = current;
      } catch {
        /* silent — health endpoint handles offline state */
      }
    };

    check();
    const id = setInterval(check, pollIntervalMs);
    return () => clearInterval(id);
  }, [enabled, pollIntervalMs, addToast]);
}
