import { NextResponse } from "next/server";
import {
  createLemmaClientFromEnv,
  lemmaSdkConfigured,
} from "@/lib/lemma/sdk/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/lemma/live
 *
 * Returns live data from the Lemma pod for the client-side UI.
 * This endpoint proxies authenticated requests so the browser never
 * sees the bearer token.
 */
export async function GET(request: Request) {
  if (!lemmaSdkConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Lemma not configured" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const table = searchParams.get("table");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);

  const client = createLemmaClientFromEnv();

  try {
    const pod = await client.pod.info();
    const tables = await client.datastore.tables.list();

    let records: unknown[] = [];
    if (table) {
      const res = await client.datastore.records.list(table, { limit });
      records = res.items ?? [];
    }

    return NextResponse.json({
      ok: true,
      pod: { id: pod.id, name: pod.name },
      tables: tables.map((t) => ({ name: t.name, columns: t.columns.length })),
      records,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Pod request failed";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
