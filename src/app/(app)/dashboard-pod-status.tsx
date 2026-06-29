"use client";

/**
 * DashboardPodStatus — live connection badge for the main dashboard.
 *
 * Polls the Lemma health endpoint and shows pod name + latency.
 * Also includes a one-click sync button.
 */

import { useState, useEffect, useCallback } from "react";
import { syncToLemmaAction } from "@/app/actions";
import { PlugIcon, PulseIcon, RefreshIcon } from "@/lib/icons";

interface HealthState {
  ok: boolean;
  podName: string | null;
  latencyMs: number | null;
  error: string | null;
}

export default function DashboardPodStatus() {
  const [health, setHealth] = useState<HealthState>({
    ok: false,
    podName: null,
    latencyMs: null,
    error: null,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/lemma/health", { cache: "no-store" });
      const json = (await res.json()) as {
        ok: boolean;
        pod?: { name: string };
        latencyMs?: number;
        error?: string;
      };
      setHealth({
        ok: json.ok,
        podName: json.pod?.name ?? null,
        latencyMs: json.latencyMs ?? null,
        error: json.ok ? null : json.error ?? "unreachable",
      });
    } catch (e) {
      setHealth({
        ok: false,
        podName: null,
        latencyMs: null,
        error: e instanceof Error ? e.message : "offline",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, [check]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const msg = await syncToLemmaAction();
      setSyncMsg(msg);
      setTimeout(() => setSyncMsg(null), 5000);
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const { ok, podName, latencyMs, error } = health;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              ok ? "bg-positive-soft text-positive" : "bg-surface-2 text-muted"
            }`}
          >
            <PulseIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Lemma pod</h2>
            <p className="mt-0.5 text-xs text-muted">
              {ok
                ? `Connected to ${podName ?? "pod"}`
                : loading
                  ? "Checking…"
                  : error ?? "Offline"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {latencyMs != null && ok && (
            <span className="text-[11px] text-muted tnum">{latencyMs}ms</span>
          )}
          <button
            onClick={check}
            disabled={loading}
            className="rounded-lg p-1.5 text-muted transition hover:bg-black/[.04] hover:text-foreground disabled:opacity-50"
            aria-label="Refresh health"
          >
            <RefreshIcon
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        {syncMsg ? (
          <span className="text-xs text-positive">{syncMsg}</span>
        ) : (
          <span className="text-xs text-muted">
            {ok
              ? "Data is mirrored to the live pod."
              : "Configure LEMMA_POD_ID and LEMMA_TOKEN to connect."}
          </span>
        )}
        <button
          onClick={handleSync}
          disabled={syncing || !ok}
          className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-50"
        >
          <PlugIcon className="h-3.5 w-3.5" />
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>
    </div>
  );
}
