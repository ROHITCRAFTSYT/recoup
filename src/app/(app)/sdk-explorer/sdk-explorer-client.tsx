"use client";

/**
 * SDK Explorer — interactive demo of the Lemma SDK surface.
 *
 * Shows live:
 *   - Connection health + latency
 *   - Table management (list, ensure, delete)
 *   - Record CRUD (create, list, update, delete)
 *   - Query options (filter, sort, limit)
 *   - Raw JSON viewer for API responses
 */

import { useState, useCallback, useEffect } from "react";
import {
  CodeIcon,
  RefreshIcon,
  PlusIcon,
  SearchIcon,
  PlugIcon,
  PulseIcon,
} from "@/lib/icons";
import {
  useLemmaBrowserSdk,
  useBrowserRecords,
  useBrowserTables,
} from "@/lib/lemma/sdk/react";
import { formatMoney } from "@/lib/ui";

interface TableInfo {
  name: string;
  columns: number;
}

interface HealthState {
  ok: boolean;
  podName: string | null;
  latencyMs: number | null;
  error: string | null;
}

interface QueryResult {
  items: Record<string, unknown>[];
  total: number;
}

type Tab = "health" | "tables" | "records" | "query" | "browser";

export default function SdkExplorerClient() {
  const [activeTab, setActiveTab] = useState<Tab>("health");
  const [health, setHealth] = useState<HealthState>({
    ok: false,
    podName: null,
    latencyMs: null,
    error: null,
  });
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [rawJson, setRawJson] = useState<string>("");
  const [newTableName, setNewTableName] = useState("");
  const [selectedTable, setSelectedTable] = useState("");
  const [queryTable, setQueryTable] = useState("recoup_invoices");
  const [queryLimit, setQueryLimit] = useState("10");
  const [queryFilter, setQueryFilter] = useState("");
  const [queryOrderBy, setQueryOrderBy] = useState("updated_at");
  const [queryDirection, setQueryDirection] = useState<"asc" | "desc">("desc");

  const fetchHealth = useCallback(async () => {
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
      setRawJson(JSON.stringify(json, null, 2));
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

  const fetchTables = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/lemma/live?limit=1", { cache: "no-store" });
      const json = (await res.json()) as {
        ok: boolean;
        tables?: { name: string; columns: number }[];
      };
      if (json.ok) {
        setTables(json.tables ?? []);
        setRawJson(JSON.stringify(json, null, 2));
      }
    } catch (e) {
      setRawJson(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRecords = useCallback(async (table: string) => {
    if (!table) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/lemma/live?table=${encodeURIComponent(table)}&limit=50`, {
        cache: "no-store",
      });
      const json = (await res.json()) as {
        ok: boolean;
        records?: Record<string, unknown>[];
      };
      if (json.ok) {
        setRecords(json.records ?? []);
        setRawJson(JSON.stringify(json, null, 2));
      }
    } catch (e) {
      setRawJson(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const ensureTable = useCallback(async () => {
    if (!newTableName) return;
    setLoading(true);
    try {
      const res = await fetch("/api/lemma/ensure-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTableName }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      setRawJson(JSON.stringify(json, null, 2));
      if (json.ok) {
        setNewTableName("");
        fetchTables();
      }
    } catch (e) {
      setRawJson(String(e));
    } finally {
      setLoading(false);
    }
  }, [newTableName, fetchTables]);

  const runQuery = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("table", queryTable);
      params.set("limit", queryLimit);
      if (queryFilter) params.set("filter", queryFilter);
      if (queryOrderBy) {
        params.set("order_by", queryOrderBy);
        params.set("order_direction", queryDirection);
      }
      const res = await fetch(`/api/lemma/live?${params.toString()}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as {
        ok: boolean;
        records?: Record<string, unknown>[];
        total?: number;
      };
      if (json.ok) {
        setQueryResult({
          items: json.records ?? [],
          total: json.total ?? json.records?.length ?? 0,
        });
        setRawJson(JSON.stringify(json, null, 2));
      }
    } catch (e) {
      setRawJson(String(e));
    } finally {
      setLoading(false);
    }
  }, [queryTable, queryLimit, queryFilter, queryOrderBy, queryDirection]);

  // Auto-poll health
  useEffect(() => {
    fetchHealth();
    fetchTables();
    const id = setInterval(fetchHealth, 10000);
    return () => clearInterval(id);
  }, [fetchHealth, fetchTables]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "health", label: "Health" },
    { key: "tables", label: "Tables" },
    { key: "records", label: "Records" },
    { key: "query", label: "Query" },
    { key: "browser", label: "Browser SDK" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-surface px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
              <CodeIcon className="h-6 w-6 text-accent" />
              SDK Explorer
            </h1>
            <p className="mt-0.5 text-xs text-muted">
              Interactive surface for the Lemma SDK — health, tables, records, and queries.
            </p>
          </div>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted transition hover:text-foreground disabled:opacity-50"
          >
            <RefreshIcon className={`mr-1.5 inline h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      <div className="flex-1 p-8">
        <div className="mx-auto max-w-5xl">
          {/* Connection banner */}
          <div
            className={`mb-6 flex items-center gap-3 rounded-xl border p-4 ${
              health.ok
                ? "border-positive/30 bg-positive-soft/40"
                : "border-danger/30 bg-danger-soft/40"
            }`}
          >
            <PlugIcon
              className={`h-5 w-5 ${health.ok ? "text-positive" : "text-danger"}`}
            />
            <div className="flex-1">
              <div className="text-sm font-semibold">
                {health.ok
                  ? `Connected to ${health.podName ?? "pod"}`
                  : health.error ?? "Disconnected"}
              </div>
              <div className="text-[11px] text-muted">
                {health.latencyMs != null
                  ? `Latency: ${health.latencyMs}ms · Auto-refreshes every 10s`
                  : "Checking connection…"}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-4 flex gap-1 border-b border-border pb-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`rounded-t-lg px-4 py-2 text-xs font-medium transition ${
                  activeTab === t.key
                    ? "text-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              {activeTab === "health" && (
                <div className="rounded-2xl border border-border bg-surface p-6">
                  <h2 className="text-sm font-semibold">Pod health</h2>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-border bg-background p-3">
                      <div className="text-[11px] text-muted">Status</div>
                      <div className={`mt-1 text-sm font-semibold ${health.ok ? "text-positive" : "text-danger"}`}>
                        {health.ok ? "Healthy" : "Error"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-3">
                      <div className="text-[11px] text-muted">Pod name</div>
                      <div className="mt-1 text-sm font-semibold">
                        {health.podName ?? "—"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-3">
                      <div className="text-[11px] text-muted">Latency</div>
                      <div className="mt-1 text-sm font-semibold tnum">
                        {health.latencyMs != null ? `${health.latencyMs}ms` : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "tables" && (
                <div className="rounded-2xl border border-border bg-surface p-6">
                  <h2 className="text-sm font-semibold">Tables in pod</h2>
                  {tables.length === 0 ? (
                    <p className="mt-4 text-xs text-muted">No tables found.</p>
                  ) : (
                    <div className="mt-4 divide-y divide-border">
                      {tables.map((t) => (
                        <div
                          key={t.name}
                          className="flex items-center justify-between py-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs">{t.name}</span>
                            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">
                              {t.columns} cols
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedTable(t.name);
                              setActiveTab("records");
                              fetchRecords(t.name);
                            }}
                            className="text-xs font-medium text-accent hover:underline"
                          >
                            View records →
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-5 rounded-lg border border-border bg-background p-3">
                    <div className="text-[11px] font-semibold text-muted">Create demo table</div>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={newTableName}
                        onChange={(e) => setNewTableName(e.target.value)}
                        placeholder="table_name"
                        className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs"
                      />
                      <button
                        onClick={ensureTable}
                        disabled={!newTableName || loading}
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg disabled:opacity-50"
                      >
                        <PlusIcon className="mr-1 inline h-3 w-3" />
                        Ensure
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "records" && (
                <div className="rounded-2xl border border-border bg-surface p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">
                      Records{selectedTable ? ` · ${selectedTable}` : ""}
                    </h2>
                    <div className="flex gap-2">
                      <select
                        value={selectedTable}
                        onChange={(e) => {
                          setSelectedTable(e.target.value);
                          fetchRecords(e.target.value);
                        }}
                        className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                      >
                        <option value="">Select table…</option>
                        {tables.map((t) => (
                          <option key={t.name} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {records.length === 0 ? (
                    <p className="mt-4 text-xs text-muted">
                      {selectedTable
                        ? "No records in this table."
                        : "Select a table to view records."}
                    </p>
                  ) : (
                    <div className="mt-4 max-h-96 overflow-y-auto rounded-lg border border-border bg-background">
                      <table className="w-full text-[11px]">
                        <thead className="text-muted">
                          <tr className="border-b border-border">
                            <th className="px-2.5 py-1.5 text-left font-medium">ID</th>
                            <th className="px-2.5 py-1.5 text-left font-medium">Data</th>
                          </tr>
                        </thead>
                        <tbody>
                          {records.slice(0, 20).map((r, i) => (
                            <tr key={String(r.id ?? i)} className="border-b border-border/60 last:border-0">
                              <td className="px-2.5 py-1.5 font-mono text-[10px]">
                                {String(r.id ?? "—").slice(0, 8)}…
                              </td>
                              <td className="px-2.5 py-1.5">
                                <code className="text-[10px]">
                                  {JSON.stringify(r).slice(0, 120)}
                                  {JSON.stringify(r).length > 120 ? "…" : ""}
                                </code>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "query" && (
                <div className="rounded-2xl border border-border bg-surface p-6">
                  <h2 className="text-sm font-semibold">Query builder</h2>
                  <p className="mt-0.5 text-xs text-muted">
                    Build and run filtered, sorted queries against the pod.
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-muted">Table</label>
                      <select
                        value={queryTable}
                        onChange={(e) => setQueryTable(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
                      >
                        {tables.map((t) => (
                          <option key={t.name} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                        <option value="recoup_invoices">recoup_invoices</option>
                        <option value="recoup_authorizations">recoup_authorizations</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-muted">Limit</label>
                      <input
                        type="number"
                        value={queryLimit}
                        onChange={(e) => setQueryLimit(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-muted">Order by</label>
                      <input
                        type="text"
                        value={queryOrderBy}
                        onChange={(e) => setQueryOrderBy(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-muted">Direction</label>
                      <select
                        value={queryDirection}
                        onChange={(e) => setQueryDirection(e.target.value as "asc" | "desc")}
                        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
                      >
                        <option value="desc">desc</option>
                        <option value="asc">asc</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="mb-1 block text-[11px] font-medium text-muted">Filter JSON</label>
                    <textarea
                      value={queryFilter}
                      onChange={(e) => setQueryFilter(e.target.value)}
                      placeholder='{"status": "outstanding"}'
                      rows={3}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-xs"
                    />
                  </div>

                  <button
                    onClick={runQuery}
                    disabled={loading}
                    className="mt-4 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-50"
                  >
                    <SearchIcon className="mr-1.5 inline h-3.5 w-3.5" />
                    Run query
                  </button>

                  {queryResult && (
                    <div className="mt-4">
                      <div className="mb-1.5 text-[11px] text-muted">
                        Returned <span className="font-semibold tnum">{queryResult.items.length}</span> of{" "}
                        <span className="font-semibold tnum">{queryResult.total}</span> records
                      </div>
                      <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-background p-2.5">
                        <pre className="text-[10px] font-mono text-muted">
                          {JSON.stringify(queryResult.items.slice(0, 5), null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "browser" && <BrowserSdkTab />}
            </div>

            {/* Raw JSON panel */}
            <div className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold">Raw response</h2>
              <div className="mt-3 rounded-lg border border-border bg-background p-3">
                <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-[10px] font-mono text-muted">
                  {rawJson || "Make a request to see the raw JSON response."}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Browser SDK tab — runs the OFFICIAL `lemma-sdk` npm package directly in the
 * browser (no server proxy). Loaded lazily and gated behind an opt-in
 * NEXT_PUBLIC_LEMMA_TOKEN; when that isn't set, the app's secure server path is
 * the default and this tab explains how to switch the showcase on.
 */
function BrowserSdkTab() {
  const sdk = useLemmaBrowserSdk();
  const { tables } = useBrowserTables(sdk.client);
  const { records, total, loading, error, refresh } = useBrowserRecords(
    sdk.client,
    sdk.client ? "recoup_invoices" : null,
    { limit: 50, pollMs: 8000 },
  );

  if (!sdk.configured) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center gap-2">
          <PulseIcon className="h-5 w-5 text-accent" />
          <h2 className="text-sm font-semibold">
            Official <code className="text-accent">lemma-sdk</code> · browser mode
          </h2>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          This tab runs the published <code>lemma-sdk</code> npm package directly
          in your browser — the surface the SDK was built for (Bearer testing
          token + real <code>LemmaClient</code>). It is off by default because it
          needs a pod token exposed to the client. Everywhere else the app keeps
          the token server-side behind the <code>/api/lemma/*</code> proxy.
        </p>
        <div className="mt-4 rounded-lg border border-border bg-background p-3">
          <div className="text-[11px] font-semibold text-muted">
            Enable the browser SDK showcase
          </div>
          <pre className="mt-2 overflow-x-auto text-[11px] leading-relaxed text-muted">
{`# .env  (browser-visible — use a short-lived pod token)
NEXT_PUBLIC_LEMMA_POD_ID="<your-pod-id>"
NEXT_PUBLIC_LEMMA_TOKEN="<short-lived pod token>"
NEXT_PUBLIC_LEMMA_API_URL="https://api.lemma.work"`}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PulseIcon
            className={`h-5 w-5 ${
              sdk.status === "connected"
                ? "text-positive"
                : sdk.status === "error"
                  ? "text-danger"
                  : "text-accent"
            }`}
          />
          <div>
            <h2 className="text-sm font-semibold">
              Official <code className="text-accent">lemma-sdk</code> · in your
              browser
            </h2>
            <p className="mt-0.5 text-[11px] text-muted">
              Real <code>LemmaClient</code> — no server proxy ·{" "}
              {sdk.status === "connected"
                ? `connected to ${sdk.podName ?? "pod"}${
                    sdk.latencyMs != null ? ` · ${sdk.latencyMs}ms` : ""
                  }`
                : sdk.status === "loading"
                  ? "loading SDK…"
                  : sdk.status === "error"
                    ? sdk.error ?? "error"
                    : "idle"}
            </p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading || sdk.status !== "connected"}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground disabled:opacity-50"
        >
          <RefreshIcon
            className={`mr-1.5 inline h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {sdk.status === "error" && (
        <div className="mt-3 rounded-lg border border-danger/30 bg-danger-soft/40 p-3 text-xs text-danger">
          {sdk.error}
        </div>
      )}
      {error && (
        <div className="mt-3 rounded-lg border border-danger/30 bg-danger-soft/40 p-3 text-xs text-danger">
          {error}
        </div>
      )}

      {tables.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            client.tables.list()
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tables.map((t) => (
              <span
                key={t.name}
                className="rounded-lg border border-border bg-background px-2 py-1 text-[11px]"
              >
                <span className="font-mono">{t.name}</span>
                <span className="ml-1 text-muted">({t.columns} cols)</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted">
          <span>
            client.records.list(&quot;recoup_invoices&quot;) ·{" "}
            <span className="tnum">{total}</span>
          </span>
        </div>
        {records.length === 0 ? (
          <p className="text-xs text-muted">
            {sdk.status === "connected"
              ? "No records — use “Sync invoices to Lemma pod” on Integrations."
              : "Waiting for the pod…"}
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-background">
            <table className="w-full text-[11px]">
              <thead className="text-muted">
                <tr className="border-b border-border">
                  <th className="px-2.5 py-1.5 text-left font-medium">Invoice</th>
                  <th className="px-2.5 py-1.5 text-left font-medium">Account</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">
                    Outstanding
                  </th>
                  <th className="px-2.5 py-1.5 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {records.slice(0, 10).map((r, i) => (
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
        )}
      </div>
    </div>
  );
}
