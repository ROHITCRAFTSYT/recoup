// Operations — the core, side-effecting collection moves (authorize, decline,
// record payment, ingest a reply, handle a Telegram command). Kept free of the
// Next "use server" boundary so they can be reused by BOTH server actions
// (src/app/actions.ts) and webhooks (src/app/api/**). The actions layer just
// wraps these with revalidatePath; the API layer calls them directly.

import { prisma } from "@/lib/db";
import {
  updateInvoice,
  addOutreach,
  updateAction,
  latestPendingAction,
  getInvoiceByNumber,
  logActivity,
} from "./datastore";
import { processInvoice, regenerateAction } from "./workflow";
import { lemmaConfigured, lemmaDecideAuthorization } from "./lemma-rest";
import { actionMeta, formatMoney } from "@/lib/ui";

function postStatus(kind: string): string {
  switch (kind) {
    case "payment_plan":
    case "settlement":
      return "promised";
    case "write_off":
      return "written_off";
    case "escalate_legal":
      return "escalated";
    default:
      return "in_progress";
  }
}

/** Execute (send/record) a specific action and advance the invoice. */
export async function executeAction(input: {
  invoiceId: string;
  actionId: string;
  body: string;
  actor?: string;
}) {
  const action = await prisma.proposedAction.findUnique({
    where: { id: input.actionId },
  });
  if (!action) return { ok: false as const };

  await updateAction(input.actionId, { body: input.body, status: "sent" });

  const isInternal =
    action.kind === "write_off" || action.kind === "escalate_legal";

  await addOutreach({
    invoiceId: input.invoiceId,
    direction: "outbound",
    channel: action.channel,
    author: isInternal ? "Manager (authorized)" : "Recoup Agent",
    body: input.body,
  });

  await updateInvoice(input.invoiceId, { status: postStatus(action.kind) });

  await logActivity({
    invoiceId: input.invoiceId,
    type: "authorized",
    message: `Authorized: ${actionMeta(action.kind).label}`,
    actor: input.actor ?? "Asha Verma",
    amountPaise: action.financialImpactPaise || undefined,
  });

  // Write the decision back to the live Lemma pod's authorization record.
  if (action.requiresApproval && lemmaConfigured()) {
    const inv = await prisma.invoice.findUnique({
      where: { id: input.invoiceId },
      select: { number: true },
    });
    if (inv)
      await lemmaDecideAuthorization(inv.number, "authorized", input.actor ?? "Asha Verma").catch(
        () => {},
      );
  }

  return { ok: true as const, kind: action.kind };
}

export async function authorizeLatest(invoiceId: string, actor?: string) {
  const action = await latestPendingAction(invoiceId);
  if (!action) return { ok: false as const };
  return executeAction({ invoiceId, actionId: action.id, body: action.body, actor });
}

export async function declineLatest(invoiceId: string, actor?: string) {
  const action = await latestPendingAction(invoiceId);
  if (action) {
    await updateAction(action.id, { status: "rejected" });
    await logActivity({
      invoiceId,
      type: "declined",
      message: `Declined: ${actionMeta(action.kind).label} — redrafting`,
      actor: actor ?? "Asha Verma",
    });
    if (lemmaConfigured()) {
      const inv = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { number: true },
      });
      if (inv)
        await lemmaDecideAuthorization(inv.number, "declined", actor ?? "Asha Verma").catch(
          () => {},
        );
    }
  }
  await regenerateAction(invoiceId);
  return { ok: true as const };
}

/** Record a (full or partial) payment. */
export async function recordPayment(
  invoiceId: string,
  amountPaise: number,
  actor = "Asha Verma",
) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return { ok: false as const };

  const paid = Math.min(invoice.amountPaise, invoice.paidPaise + Math.max(0, amountPaise));
  const fullyPaid = paid >= invoice.amountPaise;

  await updateInvoice(invoiceId, {
    paidPaise: paid,
    status: fullyPaid ? "recovered" : "promised",
  });
  await addOutreach({
    invoiceId,
    direction: "inbound",
    channel: invoice.currency === "INR" ? "email" : "email",
    author: invoice.number,
    body: fullyPaid
      ? "Payment received in full. Invoice cleared."
      : `Partial payment received: ${formatMoney(amountPaise)}. Remaining: ${formatMoney(invoice.amountPaise - paid)}.`,
  });
  await logActivity({
    invoiceId,
    type: "paid",
    message: fullyPaid
      ? "Recovered in full"
      : `Partial payment ${formatMoney(amountPaise)}`,
    actor,
    amountPaise,
  });
  return { ok: true as const, fullyPaid };
}

export async function markPaid(invoiceId: string, actor = "Asha Verma") {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return { ok: false as const };
  return recordPayment(invoiceId, invoice.amountPaise - invoice.paidPaise, actor);
}

/**
 * Ingest a reply from a debtor (any channel). Logs it, then either pauses for a
 * dispute or re-runs the recovery pipeline so the agent adapts (promise-to-pay →
 * plan, hostile → escalation).
 */
export async function ingestReply(input: {
  invoiceId?: string;
  invoiceNumber?: string;
  channel: string;
  body: string;
  author?: string;
}) {
  let invoiceId = input.invoiceId;
  if (!invoiceId && input.invoiceNumber) {
    const inv = await getInvoiceByNumber(input.invoiceNumber);
    invoiceId = inv?.id;
  }
  if (!invoiceId) return { ok: false as const, error: "invoice not found" };

  await addOutreach({
    invoiceId,
    direction: "inbound",
    channel: input.channel,
    author: input.author ?? "Debtor",
    body: input.body,
  });
  await logActivity({
    invoiceId,
    type: "reply",
    message: `Debtor replied via ${input.channel}`,
    actor: "debtor",
  });

  // Dispute → pause cadence per policy; route to a human (no money move).
  if (
    /(dispute|disputing|incorrect|wrong amount|already paid|not our|overcharg|never received|raise a complaint)/i.test(
      input.body,
    )
  ) {
    await updateInvoice(invoiceId, {
      status: "escalated",
      notes: "Dispute raised — cadence paused per policy; route to account owner.",
    });
    await logActivity({
      invoiceId,
      type: "proposed",
      message: "Dispute detected — cadence paused for human review",
      actor: "agent",
    });
    return { ok: true as const, invoiceId, disputed: true };
  }

  // Otherwise let the agent re-read the case and propose its next move.
  await processInvoice(invoiceId);
  return { ok: true as const, invoiceId, disputed: false };
}

/**
 * Handle a free-text Telegram command from the manager / debtor. Returns the
 * text to reply back into the chat. Used by both the webhook and the poll.
 */
export async function handleTelegramText(text: string, fromName?: string): Promise<string> {
  const cmd = text.trim().match(/^(approve|authorize|decline|reject)\s+(INV-[\w-]+)/i);
  if (cmd) {
    const number = cmd[2].toUpperCase();
    const inv = await getInvoiceByNumber(number);
    if (!inv) return `Invoice ${number} not found.`;
    if (/approve|authorize/i.test(cmd[1])) {
      const r = await authorizeLatest(inv.id, fromName ? `${fromName} (Telegram)` : "Manager (Telegram)");
      return r.ok ? `✅ Authorized ${number}.` : `Nothing pending to authorize on ${number}.`;
    }
    await declineLatest(inv.id, fromName ? `${fromName} (Telegram)` : "Manager (Telegram)");
    return `✋ Declined ${number}; the agent will redraft.`;
  }

  // "INV-1234 <message>" → treat as a debtor reply on that invoice.
  const reply = text.match(/(INV-[\w-]+)\s+([\s\S]+)/i);
  if (reply) {
    const r = await ingestReply({
      invoiceNumber: reply[1].toUpperCase(),
      channel: "telegram",
      body: reply[2].trim(),
      author: fromName ?? "Debtor",
    });
    return r.ok
      ? `Logged a reply on ${reply[1].toUpperCase()} and re-ran the agent.`
      : `Couldn't find ${reply[1].toUpperCase()}.`;
  }

  return "Commands: <code>approve INV-1234</code>, <code>decline INV-1234</code>, or <code>INV-1234 your message</code>.";
}

/** Handle an inline-button callback (data like "approve:INV-1234"). */
export async function handleTelegramCallback(data: string, fromName?: string): Promise<string> {
  const [verb, number] = data.split(":");
  if (!number) return "Unknown action.";
  return handleTelegramText(`${verb} ${number}`, fromName);
}
