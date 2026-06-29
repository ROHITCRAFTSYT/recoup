import { NextResponse } from "next/server";
import {
  createLemmaClientFromEnv,
  lemmaSdkConfigured,
} from "@/lib/lemma/sdk/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/lemma/health
 *
 * Lightweight health check that the browser can poll without
 * exposing credentials.
 */
export async function GET() {
  if (!lemmaSdkConfigured()) {
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 503 },
    );
  }

  const client = createLemmaClientFromEnv();
  const start = Date.now();

  try {
    const info = await client.pod.info();
    return NextResponse.json({
      ok: true,
      pod: { id: info.id, name: info.name },
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unreachable";
    return NextResponse.json(
      { ok: false, error: message, latencyMs: Date.now() - start },
      { status: 502 },
    );
  }
}
