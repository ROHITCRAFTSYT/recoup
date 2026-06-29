// Integrations — inbound surface adapters.
//
// The surface here is the accounting system (Tally / Zoho Books / QuickBooks /
// a CSV export): when an invoice crosses its due date it lands here, becomes a
// collection case, and the recovery workflow kicks off. The seed and the
// "simulate invoice" form both flow through ingestInvoice(). Swappable for real
// Lemma integrations (an accounting webhook, a Gmail/WhatsApp surface) later.

import { upsertAccount, createInvoice, logActivity, getInvoice } from "./datastore";
import { processInvoice, type ProcessResult } from "./workflow";
import { lemmaMirrorInvoice, lemmaConfigured } from "./lemma-rest";
import { formatMoney } from "@/lib/ui";

export type IngestInput = {
  source?: string; // accounting | csv | manual
  accountName: string;
  accountEmail: string;
  contactName: string;
  phone?: string;
  segment?: string;
  invoiceNumber: string;
  amountPaise: number;
  issueDate: string | Date;
  dueDate: string | Date;
};

export type IngestResult = ProcessResult;

/** Normalize an overdue invoice into a case and run the recovery workflow. */
export async function ingestInvoice(input: IngestInput): Promise<IngestResult> {
  const account = await upsertAccount({
    name: input.accountName,
    email: input.accountEmail,
    contactName: input.contactName,
    phone: input.phone,
    segment: input.segment,
  });
  const invoice = await createInvoice({
    number: input.invoiceNumber,
    amountPaise: input.amountPaise,
    issueDate: new Date(input.issueDate),
    dueDate: new Date(input.dueDate),
    accountId: account.id,
  });
  await logActivity({
    invoiceId: invoice.id,
    type: "ingested",
    message: `Invoice ${invoice.number} (${formatMoney(invoice.amountPaise)}) ingested from ${input.source ?? "accounting"} for ${account.name}`,
    actor: "system",
  });
  const result = await processInvoice(invoice.id);

  // Best-effort: mirror the fresh invoice into the live Lemma pod.
  if (lemmaConfigured()) {
    const full = await getInvoice(invoice.id);
    if (full) await lemmaMirrorInvoice(full).catch(() => {});
  }

  return result;
}
