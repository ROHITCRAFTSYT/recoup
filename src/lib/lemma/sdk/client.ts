/**
 * LemmaClient — a typed, retry-aware REST client for the Lemma platform.
 *
 * This is the server-side SDK surface. It wraps the Lemma datastore REST API
 * with a clean, Promise-based interface that mirrors the expected shape of the
 * real `lemma-sdk` npm package.
 *
 * Usage:
 *   const client = new LemmaClient({
 *     apiUrl: "https://api.lemma.work",
 *     podId:  process.env.LEMMA_POD_ID!,
 *     token:  process.env.LEMMA_TOKEN!,
 *   });
 *   const pod = await client.pod.info();
 *   const records = await client.datastore.records.list("invoices");
 */

import type {
  LemmaClientConfig,
  LemmaRecord,
  ListRecordsResponse,
  TableInfo,
  TableSchema,
  CreateRecordPayload,
  UpdateRecordPayload,
  QueryOptions,
  PodInfo,
  ConnectionState,
} from "./types";

export { type LemmaClientConfig, type LemmaRecord, type PodInfo, type ConnectionState };

export class LemmaError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "LemmaError";
  }
}

export class LemmaClient {
  private readonly apiUrl: string;
  private readonly podId: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly retries: number;

  constructor(config: LemmaClientConfig) {
    this.apiUrl = config.apiUrl.replace(/\/$/, "");
    this.podId = config.podId;
    this.token = config.token;
    this.timeoutMs = config.timeoutMs ?? 12000;
    this.retries = config.retries ?? 2;
  }

  /** True when the client has non-empty credentials. */
  get configured(): boolean {
    return Boolean(this.podId && this.token);
  }

  /** Build a pod-scoped URL. */
  private url(path: string): string {
    return `${this.apiUrl}/pods/${this.podId}${path}`;
  }

  /** Standard headers for every request. */
  private headers(init?: HeadersInit): HeadersInit {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      ...(init || {}),
    };
  }

  /** Low-level fetch with timeout and retries. */
  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const url = this.url(path);
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const res = await fetch(url, {
          ...init,
          headers: this.headers(init?.headers),
          cache: "no-store",
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        const text = await res.text();
        const data = text ? (JSON.parse(text) as T) : undefined;

        if (!res.ok) {
          const err = (data as { error?: string; message?: string }) ?? {};
          throw new LemmaError(
            res.status,
            res.status >= 500 ? "server_error" : "request_error",
            err.error ?? err.message ?? `HTTP ${res.status}`,
            data as Record<string, unknown> | undefined,
          );
        }
        return data as T;
      } catch (e) {
        if (e instanceof LemmaError) throw e;
        lastError = e instanceof Error ? e : new Error(String(e));
        if (attempt < this.retries) {
          const backoff = 500 * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, backoff));
        }
      }
    }

    throw new LemmaError(0, "network_error", lastError?.message ?? "Request failed after retries");
  }

  // -------------------------------------------------------------------------
  // Pod
  // -------------------------------------------------------------------------
  pod = {
    info: async (): Promise<PodInfo> => {
      return this.fetch<PodInfo>("");
    },
  };

  // -------------------------------------------------------------------------
  // Datastore — tables
  // -------------------------------------------------------------------------
  datastore = {
    tables: {
      list: async (): Promise<TableInfo[]> => {
        const res = await this.fetch<{ items: TableInfo[] }>("/datastore/tables");
        return res.items ?? [];
      },

      get: async (name: string): Promise<TableInfo | null> => {
        try {
          return await this.fetch<TableInfo>(`/datastore/tables/${name}`);
        } catch (e) {
          if (e instanceof LemmaError && e.status === 404) return null;
          throw e;
        }
      },

      ensure: async (schema: TableSchema): Promise<TableInfo> => {
        const existing = await this.datastore.tables.get(schema.name);
        if (existing) return existing;
        return this.fetch<TableInfo>("/datastore/tables", {
          method: "POST",
          body: JSON.stringify(schema),
        });
      },

      delete: async (name: string): Promise<void> => {
        await this.fetch(`/datastore/tables/${name}`, { method: "DELETE" });
      },
    },

    // -----------------------------------------------------------------------
    // Datastore — records
    // -----------------------------------------------------------------------
    records: {
      list: async <T = LemmaRecord>(
        tableName: string,
        opts?: QueryOptions,
      ): Promise<ListRecordsResponse<T>> => {
        const params = new URLSearchParams();
        if (opts?.limit) params.set("limit", String(opts.limit));
        if (opts?.offset) params.set("offset", String(opts.offset));
        if (opts?.orderBy) params.set("order_by", opts.orderBy);
        if (opts?.orderDirection) params.set("order_direction", opts.orderDirection);
        if (opts?.filter) {
          for (const [k, v] of Object.entries(opts.filter)) {
            params.set(`filter[${k}]`, String(v));
          }
        }
        const qs = params.toString();
        return this.fetch<ListRecordsResponse<T>>(
          `/datastore/tables/${tableName}/records${qs ? `?${qs}` : ""}`,
        );
      },

      get: async <T = LemmaRecord>(tableName: string, id: string): Promise<T> => {
        return this.fetch<T>(`/datastore/tables/${tableName}/records/${id}`);
      },

      create: async <T = LemmaRecord>(
        tableName: string,
        payload: CreateRecordPayload,
      ): Promise<T> => {
        return this.fetch<T>(`/datastore/tables/${tableName}/records`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      },

      update: async <T = LemmaRecord>(
        tableName: string,
        id: string,
        payload: UpdateRecordPayload,
      ): Promise<T> => {
        return this.fetch<T>(`/datastore/tables/${tableName}/records/${id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      },

      delete: async (tableName: string, id: string): Promise<void> => {
        await this.fetch(`/datastore/tables/${tableName}/records/${id}`, { method: "DELETE" });
      },

      upsert: async <T = LemmaRecord>(
        tableName: string,
        opts: {
          matchField: string;
          matchValue: unknown;
          payload: CreateRecordPayload;
        },
      ): Promise<T> => {
        const { items } = await this.datastore.records.list<T>(tableName, {
          limit: 100,
          filter: { [opts.matchField]: String(opts.matchValue) },
        });
        const match = items[0];
        if (match && (match as unknown as LemmaRecord).id) {
          return this.datastore.records.update<T>(tableName, (match as unknown as LemmaRecord).id, opts.payload);
        }
        return this.datastore.records.create<T>(tableName, opts.payload);
      },
    },
  };

  // -------------------------------------------------------------------------
  // Health / connectivity
  // -------------------------------------------------------------------------
  async health(): Promise<{ ok: boolean; podName?: string; latencyMs: number }> {
    const start = Date.now();
    try {
      const info = await this.pod.info();
      return { ok: true, podName: info.name, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }
}

/** Create a client from environment variables (server-side). */
export function createLemmaClientFromEnv(): LemmaClient {
  const apiUrl = (process.env.LEMMA_API_URL || "https://api.lemma.work").replace(/\/$/, "");
  const podId = process.env.LEMMA_POD_ID || "";
  const token = process.env.LEMMA_TOKEN || "";
  return new LemmaClient({ apiUrl, podId, token });
}

/** Convenience wrapper for the most common pattern: check if Lemma is wired. */
export function lemmaSdkConfigured(): boolean {
  return Boolean(process.env.LEMMA_POD_ID && process.env.LEMMA_TOKEN);
}
