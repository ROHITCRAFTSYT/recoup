"use client";

/**
 * LemmaSdkStatus — a small, live connection badge that polls the
 * Lemma health endpoint and shows latency + pod name.
 *
 * Used in the sidebar and on the Integrations page.
 */

import { useState, useEffect, useCallback } from "react";
import { PulseIcon } from "@/lib/icons";

type HealthState = {
  ok: boolean;
  podName: string | null;
  latencyMs: number | null;
  error: string | null;
};

export default function LemmaSdkStatus({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [state, setState] = useState<HealthState>({
    ok: false,
    podName: null,
    latencyMs: null,
    error: null,
  });
  const [loading, setLoading] = useState(true);

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
      setState({
        ok: json.ok,
        podName: json.pod?.name ?? null,
        latencyMs: json.latencyMs ?? null,
        error: json.ok ? null : (json.error ?? "unreachable"),
      });
    } catch (e) {
      setState({
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

  const { ok, podName, latencyMs, error } = state;

  if (compact) {
    return (
      <div className="flex w-full items-center justify-between">
        <span>Lemma SDK</span>
        <span
          className={
            ok
              ? "text-positive"
              : loading
                ? "text-accent"
                : error
                  ? "text-danger"
                  : "text-muted"
          }
        >
          {ok ? "live" : loading ? "checking…" : error ? "error" : "offline"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-[11px]">
      <PulseIcon
        className={`h-3.5 w-3.5 ${
          ok ? "text-positive" : loading ? "text-accent animate-pulse" : "text-muted"
        }`}
      />
      <span className="text-muted">
        {ok
          ? `Pod: ${podName ?? "connected"}`
          : loading
            ? "Connecting…"
            : error ?? "Offline"}
      </span>
      {latencyMs != null && ok && (
        <span className="ml-auto tnum text-muted">{latencyMs}ms</span>
      )}
    </div>
  );
}
