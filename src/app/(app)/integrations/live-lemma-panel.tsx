"use client";

/**
 * LiveLemmaPanel — auto-refreshing client component that polls the Lemma pod
 * via the SDK-powered API route. Shows live records, connection health, and
 * pod metadata without ever exposing the bearer token to the browser.
 */

import { useState, useEffect, useCallback } from "react";
import { formatMoney } from "@/lib/ui";
import { RefreshIcon, PlugIcon, PulseIcon } from "@/lib/icons";

interface LiveState {
  podName: string | null;
  tables: { name: string; columns: number }[];
  records: Record<string, unknown>[];
  recordCount: number;
  lastUpdated: string | null;
  loading: boolean;
  error: string | null;
  latencyMs: number | null;
}

export default function LiveLemmaPanel({ tableName }: { tableName?: string }) {
  const [state, setState] = useState<LiveState>({
    podName: null,
    tables: [],
    records: [],
    recordCount: 0,
    lastUpdated: null,
    loading: true,
    error: null,
    latencyMs: null,
  });

  const fetchLive = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const start = Date.now();
    try {
      const qs = new URLSearchParams();
      if (tableName) qs.set("table", tableName);
      qs.set("limit", "50");
      const res = await fetch(`/api/lemma/live?${qs.toString()}`);
      const json = (await res.json()) as {
        ok: boolean;
        pod?: { id: string; name: string };
        tables?: { name: string; columns: number }[];
        records?: Record<string, unknown>[];
        error?: string;
      };
      const latency = Date.now() - start;

      if (!json.ok) {
        setState((s) => ({
          ...s,
          loading: false,
          error: json.error ?? "Pod request failed",
          latencyMs: latency,
        }));
        return;
      }

      setState({
        podName: json.pod?.name ?? null,
        tables: json.tables ?? [],
        records: json.records ?? [],
        recordCount: json.records?.length ?? 0,
        lastUpdated: new Date().toLocaleTimeString(),
        loading: false,
        error: null,
        latencyMs: latency,
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : "Network error",
        latencyMs: Date.now() - start,
      }));
    }
  }, [tableName]);

  // Poll every 8 seconds
  useEffect(() => {
    fetchLive();
    const id = setInterval(fetchLive, 8000);
    return () => clearInterval(id);
  }, [fetchLive]);

  const hasRecords = state.records.length > 0;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <PlugIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Lemma SDK · Live pod</h2>
            <p className="mt-0.5 text-xs text-muted">
              {state.podName
                ? `Connected to ${state.podName}`
                : "Polling pod health…"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {state.latencyMs != null && (
            <span className="text-[11px] text-muted tnum">
              {state.latencyMs}ms
            </span>
          )}
          <button
            onClick={fetchLive}
            disabled={state.loading}
            className="rounded-lg p-1.5 text-muted transition hover:bg-black/[.04] hover:text-foreground disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshIcon
              className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {state.error && (
        <div className="mt-3 rounded-lg border border-danger/30 bg-danger-soft/40 p-3 text-xs text-danger">
          {state.error}
        </div>
      )}

      {state.tables.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Tables in pod
          </div>
          <div className="flex flex-wrap gap-1.5">
            {state.tables.map((t) => (
              <span
                key={t.name}
                className={`rounded-lg border px-2 py-1 text-[11px] ${
                  t.name === "recoup_invoices" || t.name === "recoup_authorizations"
                    ? "border-accent/30 bg-accent-soft text-accent"
                    : "border-border bg-background text-muted"
                }`}
              >
                <span className="font-mono">{t.name}</span>
                <span className="ml-1 text-muted">({t.columns} cols)</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {hasRecords && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted">
            <span>
              {tableName ?? "Records"} ·{" "}
              <span className="tnum">{state.recordCount}</span>
            </span>
            {state.lastUpdated && (
              <span className="font-normal normal-case text-muted">
                updated {state.lastUpdated}
              </span>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background">
            <table className="w-full text-[11px]">
              <thead className="text-muted">
                <tr className="border-b border-border">
                  <th className="px-2.5 py-1.5 text-left font-medium">Invoice</th>
                  <th className="px-2.5 py-1.5 text-left font-medium">Account</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Outstanding</th>
                  <th className="px-2.5 py-1.5 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {state.records.slice(0, 8).map((r, i) => (
                  <tr
                    key={String(r.id ?? i)}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-2.5 py-1.5 font-mono">
                      {String(r.number ?? "—")}
                    </td>
                    <td className="px-2.5 py-1.5">
                      {String(r.account_name ?? "—")}
                    </td>
                    <td className="px-2.5 py-1.5 text-right">
                      {formatMoney(Number(r.amount_paise ?? 0))}
                    </td>
                    <td className="px-2.5 py-1.5 capitalize text-muted">
                      {String(r.status ?? "").replace(/_/g, " ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!hasRecords && !state.loading && !state.error && (
        <div className="mt-4 rounded-lg border border-border bg-background p-3 text-xs text-muted">
          No records in the selected table. Use{" "}
          <span className="font-mono">Sync invoices to Lemma pod</span> to
          mirror data.
        </div>
      )}
    </div>
  );
}
