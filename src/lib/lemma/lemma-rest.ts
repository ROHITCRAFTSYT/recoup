// REAL Lemma platform integration — now powered by the Lemma SDK client.
//
// This module wraps the Lemma datastore REST API using the typed LemmaClient
// from src/lib/lemma/sdk/. It keeps the same public API so all call sites in
// the app continue to work unchanged, but every call now goes through the SDK
// surface (retries, error handling, and a clean typed interface).
//
// Import from here for the legacy helpers, or from @/lib/lemma/sdk for the
// full SDK surface (LemmaClient, useLiveRecords, LemmaProvider, etc.).

import { daysOverdue } from "@/lib/ui";
import { LemmaClient, createLemmaClientFromEnv, lemmaSdkConfigured } from "./sdk/client";
import type { TableColumn } from "./sdk/types";

export { lemmaSdkConfigured as lemmaConfigured };

const TABLE = "recoup_invoices";
const AUTH_TABLE = "recoup_authorizations";

/** Re-use a single client instance per request (Node.js server). */
function getClient(): LemmaClient {
  return createLemmaClientFromEnv();
}

/** Pod metadata (name etc.) — also serves as a live auth check. */
export async function lemmaPodInfo(): Promise<{
  ok: boolean;
  status: number;
  data?: { name: string; id: string };
  error?: string;
}> {
  if (!lemmaSdkConfigured()) return { ok: false, status: 0, error: "not configured" };
  try {
    const info = await getClient().pod.info();
    return { ok: true, status: 200, data: { name: info.name, id: info.id } };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : "request failed",
    };
  }
}

const COLUMNS: TableColumn[] = [
  { name: "number", type: "TEXT", required: true, unique: true },
  { name: "account_name", type: "TEXT" },
  { name: "amount_paise", type: "INTEGER" },
  { name: "status", type: "TEXT" },
  { name: "risk_score", type: "INTEGER" },
  { name: "strategy", type: "TEXT" },
  { name: "days_overdue", type: "INTEGER" },
  { name: "summary", type: "TEXT" },
];

/** Create the recoup_invoices table if it doesn't exist (idempotent). */
export async function lemmaEnsureTable(): Promise<boolean> {
  if (!lemmaSdkConfigured()) return false;
  try {
    await getClient().datastore.tables.ensure({
      name: TABLE,
      enable_rls: false,
      columns: COLUMNS,
    });
    return true;
  } catch {
    return false;
  }
}

type _LemmaRecord = {
  id: string;
  number: string;
  account_name?: string;
  amount_paise?: number;
  status?: string;
  risk_score?: number | null;
  strategy?: string | null;
  days_overdue?: number;
  summary?: string | null;
  updated_at?: string;
};

export async function lemmaListInvoices(limit = 100): Promise<_LemmaRecord[]> {
  if (!lemmaSdkConfigured()) return [];
  try {
    const res = await getClient().datastore.records.list<_LemmaRecord>(TABLE, { limit });
    return res.items ?? [];
  } catch {
    return [];
  }
}

type AppInvoice = {
  number: string;
  amountPaise: number;
  paidPaise: number;
  status: string;
  riskScore: number | null;
  strategy: string | null;
  summary: string | null;
  dueDate: Date;
  account: { name: string };
};

function toRecord(i: AppInvoice) {
  return {
    number: i.number,
    account_name: i.account.name,
    amount_paise: i.amountPaise - i.paidPaise,
    status: i.status,
    risk_score: i.riskScore ?? null,
    strategy: i.strategy ?? null,
    days_overdue: daysOverdue(i.dueDate),
    summary: i.summary ?? null,
  };
}

/** Best-effort mirror of one invoice into the Lemma pod (create or update). */
export async function lemmaMirrorInvoice(invoice: AppInvoice): Promise<void> {
  if (!lemmaSdkConfigured()) return;
  await lemmaEnsureTable();
  const client = getClient();
  await client.datastore.records.upsert(TABLE, {
    matchField: "number",
    matchValue: invoice.number,
    payload: { data: toRecord(invoice) },
  });
}

/** Push the whole book into the Lemma pod (clear + recreate). Returns count. */
export async function lemmaSyncInvoices(
  invoices: AppInvoice[],
): Promise<{ ok: boolean; count: number; error?: string }> {
  if (!lemmaSdkConfigured()) return { ok: false, count: 0, error: "not configured" };
  const tableOk = await lemmaEnsureTable();
  if (!tableOk) return { ok: false, count: 0, error: "table create failed" };

  const client = getClient();
  // Clear existing, then create fresh — deterministic and simple for a demo book.
  const existing = await lemmaListInvoices(500);
  for (const r of existing) {
    await client.datastore.records.delete(TABLE, r.id).catch(() => {});
  }
  let count = 0;
  let lastError: string | undefined;
  for (const inv of invoices) {
    try {
      await client.datastore.records.create(TABLE, { data: toRecord(inv) });
      count++;
    } catch (e) {
      lastError = e instanceof Error ? e.message : "create failed";
    }
  }
  return { ok: count > 0, count, error: count === 0 ? lastError : undefined };
}

// ---------------------------------------------------------------------------
// Authorizations — route the human-in-the-loop approval gate through Lemma.
// ---------------------------------------------------------------------------

const AUTH_COLUMNS: TableColumn[] = [
  { name: "invoice_number", type: "TEXT" },
  { name: "account", type: "TEXT" },
  { name: "kind", type: "TEXT" },
  { name: "financial_impact_paise", type: "INTEGER" },
  { name: "required_role", type: "TEXT" },
  { name: "status", type: "TEXT" },
  { name: "decided_by", type: "TEXT" },
  { name: "rationale", type: "TEXT" },
];

export async function lemmaEnsureAuthTable(): Promise<boolean> {
  if (!lemmaSdkConfigured()) return false;
  try {
    await getClient().datastore.tables.ensure({
      name: AUTH_TABLE,
      enable_rls: false,
      columns: AUTH_COLUMNS,
    });
    return true;
  } catch {
    return false;
  }
}

export type LemmaAuthRecord = {
  id: string;
  invoice_number?: string;
  account?: string;
  kind?: string;
  financial_impact_paise?: number;
  required_role?: string;
  status?: string;
  decided_by?: string | null;
  rationale?: string | null;
  updated_at?: string;
};

export async function lemmaListAuthorizations(limit = 100): Promise<LemmaAuthRecord[]> {
  if (!lemmaSdkConfigured()) return [];
  try {
    const res = await getClient().datastore.records.list<LemmaAuthRecord>(AUTH_TABLE, { limit });
    return res.items ?? [];
  } catch {
    return [];
  }
}

/** Record a freshly-proposed gated action as a pending authorization in Lemma. */
export async function lemmaRecordAuthorization(input: {
  invoiceNumber: string;
  account: string;
  kind: string;
  impactPaise: number;
  requiredRole: string;
  rationale: string;
}): Promise<void> {
  if (!lemmaSdkConfigured()) return;
  await lemmaEnsureAuthTable();
  const client = getClient();
  await client.datastore.records.create(AUTH_TABLE, {
    data: {
      invoice_number: input.invoiceNumber,
      account: input.account,
      kind: input.kind,
      financial_impact_paise: input.impactPaise,
      required_role: input.requiredRole,
      status: "pending",
      decided_by: null,
      rationale: input.rationale.slice(0, 500),
    },
  });
}

/** Replace the pending authorizations in the pod with the current queue. */
export async function lemmaSyncAuthorizations(
  pending: {
    invoiceNumber: string;
    account: string;
    kind: string;
    impactPaise: number;
    requiredRole: string;
    rationale: string;
  }[],
): Promise<{ ok: boolean; count: number }> {
  if (!lemmaSdkConfigured()) return { ok: false, count: 0 };
  await lemmaEnsureAuthTable();
  const client = getClient();
  const existing = await lemmaListAuthorizations(500);
  for (const r of existing.filter((r) => r.status === "pending")) {
    await client.datastore.records.delete(AUTH_TABLE, r.id).catch(() => {});
  }
  let count = 0;
  for (const p of pending) {
    try {
      await client.datastore.records.create(AUTH_TABLE, {
        data: {
          invoice_number: p.invoiceNumber,
          account: p.account,
          kind: p.kind,
          financial_impact_paise: p.impactPaise,
          required_role: p.requiredRole,
          status: "pending",
          decided_by: null,
          rationale: p.rationale.slice(0, 500),
        },
      });
      count++;
    } catch {
      /* best-effort */
    }
  }
  return { ok: true, count };
}

/** Write a human decision back onto the latest pending authorization for an invoice. */
export async function lemmaDecideAuthorization(
  invoiceNumber: string,
  status: "authorized" | "declined",
  decidedBy: string,
): Promise<void> {
  if (!lemmaSdkConfigured()) return;
  const client = getClient();
  const records = await lemmaListAuthorizations(200);
  const match = records
    .filter((r) => r.invoice_number === invoiceNumber && r.status === "pending")
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))[0];
  if (!match) return;
  await client.datastore.records.update(AUTH_TABLE, match.id, {
    data: { status, decided_by: decidedBy },
  });
}

// ---------------------------------------------------------------------------
// SDK-forwarding exports (new code can import from here or from sdk/)
// ---------------------------------------------------------------------------

export {
  LemmaClient,
  createLemmaClientFromEnv,
  lemmaSdkConfigured,
} from "./sdk/client";

export type {
  LemmaClientConfig,
  TableSchema,
  TableColumn,
  QueryOptions,
  CreateRecordPayload,
  UpdateRecordPayload,
  ListRecordsResponse,
  PodInfo,
  WatchEvent,
  ConnectionState,
} from "./sdk/types";
