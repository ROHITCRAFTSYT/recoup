import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestInvoice } from "@/lib/lemma/integrations";

// POST /api/ingest — the accounting-system surface. Drop an overdue invoice in
// (or curl one) and the full recovery workflow runs.
const schema = z.object({
  source: z.string().optional(),
  accountName: z.string().min(1),
  accountEmail: z.string().email(),
  contactName: z.string().min(1),
  phone: z.string().optional(),
  segment: z.string().optional(),
  invoiceNumber: z.string().min(1),
  amountPaise: z.number().int().positive(),
  issueDate: z.string(),
  dueDate: z.string(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await ingestInvoice(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ingest failed" },
      { status: 500 },
    );
  }
}
