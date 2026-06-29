import { NextResponse } from "next/server";
import {
  createLemmaClientFromEnv,
  lemmaSdkConfigured,
} from "@/lib/lemma/sdk/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/lemma/ensure-table
 *
 * Creates a demo table in the Lemma pod (idempotent).
 * Expects: { name: string }
 */
export async function POST(request: Request) {
  if (!lemmaSdkConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Lemma not configured" },
      { status: 503 },
    );
  }

  let body: { name?: string };
  try {
    body = (await request.json()) as { name?: string };
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json(
      { ok: false, error: "Missing name" },
      { status: 400 },
    );
  }

  const client = createLemmaClientFromEnv();
  try {
    await client.datastore.tables.ensure({
      name,
      enable_rls: false,
      columns: [
        { name: "data", type: "JSON" },
        { name: "created_at", type: "TIMESTAMP" },
      ],
    });
    return NextResponse.json({ ok: true, table: name });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Table creation failed";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
