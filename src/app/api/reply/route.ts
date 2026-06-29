import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestReply } from "@/lib/lemma/operations";

// POST /api/reply — a generic inbound-reply surface. An email/WhatsApp provider
// (or a test script) posts a debtor's reply here; the agent logs it and adapts.
const schema = z
  .object({
    invoiceId: z.string().optional(),
    invoiceNumber: z.string().optional(),
    channel: z.string().default("email"),
    body: z.string().min(1),
    author: z.string().optional(),
  })
  .refine((d) => d.invoiceId || d.invoiceNumber, {
    message: "invoiceId or invoiceNumber is required",
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

  const result = await ingestReply(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Failed" }, { status: 404 });
  }
  return NextResponse.json(result, { status: 201 });
}
