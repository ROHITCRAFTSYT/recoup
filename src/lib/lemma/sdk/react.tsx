"use client";

/**
 * Lemma SDK — React hooks over the OFFICIAL `lemma-sdk` npm package, running in
 * the browser. These wrap the real `LemmaClient` (loaded lazily via ./browser)
 * so components can read a live pod with the genuine SDK surface:
 *
 *   - useLemmaBrowserSdk()  — load the real client + a live pod health probe
 *   - useBrowserRecords()   — list records from a table (optional polling)
 *   - useBrowserTables()    — list the pod's tables
 *
 * These are gated behind NEXT_PUBLIC_LEMMA_TOKEN (opt-in). When it isn't set the
 * status is "unconfigured" and the app's secure server-proxy path is used instead.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { LemmaClient } from "lemma-sdk";
import { browserPodId, browserSdkConfigured, getBrowserLemmaClient } from "./browser";

export type BrowserSdkStatus =
  | "unconfigured"
  | "loading"
  | "connected"
  | "error";

export interface LemmaBrowserSdkState {
  client: LemmaClient | null;
  status: BrowserSdkStatus;
  podName: string | null;
  latencyMs: number | null;
  error: string | null;
  configured: boolean;
}

/** Load the real SDK client in the browser and probe pod health once. */
export function useLemmaBrowserSdk(): LemmaBrowserSdkState {
  const configured = browserSdkConfigured();
  const [status, setStatus] = useState<BrowserSdkStatus>(
    configured ? "loading" : "unconfigured",
  );
  const [podName, setPodName] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<LemmaClient | null>(null);

  useEffect(() => {
    if (!configured) {
      setStatus("unconfigured");
      return;
    }
    let cancelled = false;
    (async () => {
      setStatus("loading");
      const start =
        typeof performance !== "undefined" ? performance.now() : 0;
      try {
        const c = await getBrowserLemmaClient();
        // pods.get is a real, authenticated call — doubles as a live auth check.
        const pod = await c.pods.get(browserPodId());
        if (cancelled) return;
        setClient(c);
        setPodName(pod?.name ?? null);
        setLatencyMs(
          typeof performance !== "undefined"
            ? Math.round(performance.now() - start)
            : null,
        );
        setStatus("connected");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load Lemma SDK");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured]);

  return { client, status, podName, latencyMs, error, configured };
}

export interface BrowserRecordsState {
  records: Record<string, unknown>[];
  total: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** List records from a pod table via the real SDK (optional polling). */
export function useBrowserRecords(
  client: LemmaClient | null,
  table: string | null,
  opts?: { limit?: number; pollMs?: number },
): BrowserRecordsState {
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limit = opts?.limit ?? 50;
  const pollMs = opts?.pollMs ?? 0;

  const refresh = useCallback(async () => {
    if (!client || !table) return;
    setLoading(true);
    setError(null);
    try {
      const res = await client.records.list(table, { limit });
      setRecords(res.items ?? []);
      setTotal(res.total ?? res.items?.length ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to list records");
    } finally {
      setLoading(false);
    }
  }, [client, table, limit]);

  useEffect(() => {
    refresh();
    if (!pollMs || !client || !table) return;
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs, client, table]);

  return { records, total, loading, error, refresh };
}

export interface BrowserTable {
  name: string;
  columns: number;
}

/** List the pod's tables via the real SDK. */
export function useBrowserTables(client: LemmaClient | null): {
  tables: BrowserTable[];
  error: string | null;
  refresh: () => void;
} {
  const [tables, setTables] = useState<BrowserTable[]>([]);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  const refresh = useCallback(async () => {
    if (!client) return;
    try {
      const res = await client.tables.list({ limit: 100 });
      setTables(
        (res.items ?? []).map((t) => ({
          name: t.name,
          columns: t.column_count ?? 0,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to list tables");
    }
  }, [client]);

  useEffect(() => {
    if (!client || ran.current) return;
    ran.current = true;
    refresh();
  }, [client, refresh]);

  return { tables, error, refresh };
}
