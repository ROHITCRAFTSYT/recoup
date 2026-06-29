// Workflow — the agentic pipeline that turns an overdue invoice into a scored,
// drafted, authorization-checked collection move.
//
//   risk assess  →  policy search (RAG)  →  draft outreach  →  authorization review
//
// The pivotal branch: routine reminders (no concession) are sent AUTONOMOUSLY;
// any money or legal move stops and waits in the Authorizations queue for a
// human. That gate is the whole point — agents do the work, humans hold the
// money. Orchestrated in code today; expressible as a Lemma workflow later.

import {
  getInvoice,
  updateInvoice,
  addOutreach,
  saveAction,
  updateAction,
  logActivity,
} from "./datastore";
import { search } from "./docstore";
import { assessRisk, draftOutreach, reviewAction, type CaseContext } from "./agent";
import {
  notifyManager,
  authorizationButtons,
  telegramConfigured,
} from "./telegram";
import { lemmaConfigured, lemmaRecordAuthorization } from "./lemma-rest";
import {
  daysOverdue,
  actionMeta,
  formatMoney,
  requiredRole,
  roleLabel,
} from "@/lib/ui";

export type ProcessResult = {
  invoiceId: string;
  riskScore: number;
  strategy: string;
  kind: string;
  requiresApproval: boolean;
  financialImpactPaise: number;
  autoSent: boolean;
  actionId: string;
  citationCount: number;
};

function buildContext(
  invoice: NonNullable<Awaited<ReturnType<typeof getInvoice>>>,
): CaseContext {
  const outbound = invoice.outreach.filter((o) => o.direction === "outbound");
  const lastInbound = [...invoice.outreach].reverse().find((o) => o.direction === "inbound");
  const remaining = invoice.amountPaise - invoice.paidPaise;
  return {
    number: invoice.number,
    amountPaise: invoice.amountPaise,
    remainingPaise: remaining,
    daysOverdue: daysOverdue(invoice.dueDate),
    accountName: invoice.account.name,
    contactName: invoice.account.contactName,
    segment: invoice.account.segment,
    channel: "email",
    attempts: outbound.length,
    lastReply: lastInbound?.body ?? null,
    notes: invoice.notes ?? null,
  };
}

/** Run the full risk → policy → draft → review pipeline for one invoice. */
export async function processInvoice(invoiceId: string): Promise<ProcessResult> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) throw new Error(`Invoice not found: ${invoiceId}`);

  await updateInvoice(invoiceId, { status: "analyzing" });

  const ctx = buildContext(invoice);

  // 1. Risk assessment + strategy
  const risk = await assessRisk(ctx);

  // 2. Pick the channel — a gentle early nudge goes to WhatsApp when we have a
  //    number; everything firmer (and all internal notes) uses email.
  ctx.channel =
    risk.strategy === "nudge" && invoice.account.phone ? "whatsapp" : "email";

  // 3. Policy retrieval (RAG) to ground the move within authority limits
  const query = `${risk.strategy} collections ${risk.summary}`;
  const chunks = await search(query, 4);

  // 4. Draft the outreach / internal note
  const draft = await draftOutreach(ctx, risk.strategy, chunks);

  // 5. Authorization review (deterministic gate + human-readable reason)
  const review = await reviewAction(ctx, draft);

  // 6. Branch: autonomous send vs. human authorization
  let autoSent = false;
  let status: string;
  let actionStatus: string;

  if (!review.requiresApproval) {
    // Routine reminder — the agent sends it itself and logs the outreach.
    await addOutreach({
      invoiceId,
      direction: "outbound",
      channel: draft.channel,
      author: "Recoup Agent",
      body: draft.body,
    });
    autoSent = true;
    actionStatus = "sent";
    status = "in_progress";
  } else {
    // Money/legal move — hold for a human in the Authorizations queue.
    actionStatus = "proposed";
    status = "escalated";
  }

  const action = await saveAction({
    invoiceId,
    kind: draft.kind,
    channel: draft.channel,
    body: draft.body,
    financialImpactPaise: draft.financialImpactPaise,
    rationale: `${draft.rationale}${review.reason ? ` · ${review.reason}` : ""}`,
    requiresApproval: review.requiresApproval,
    citations: draft.citations,
  });
  if (actionStatus !== "proposed") {
    await updateAction(action.id, { status: actionStatus });
  }

  await updateInvoice(invoiceId, {
    riskScore: risk.riskScore,
    strategy: risk.strategy,
    summary: risk.summary,
    lastAnalyzedAt: new Date(),
    status,
  });

  // Audit trail + (if a money move) ping the human on Telegram.
  await logActivity({
    invoiceId,
    type: "analyzed",
    message: `Scored ${risk.riskScore}/100 · strategy: ${risk.strategy}`,
    actor: "agent",
  });
  if (autoSent) {
    await logActivity({
      invoiceId,
      type: "reminder_sent",
      message: `Auto-sent a ${risk.strategy} reminder via ${draft.channel}`,
      actor: "agent",
    });
  } else {
    await logActivity({
      invoiceId,
      type: "proposed",
      message: `Proposed ${actionMeta(draft.kind).label} for sign-off`,
      actor: "agent",
      amountPaise: draft.financialImpactPaise || undefined,
    });
    // Route the approval gate through the live Lemma pod (best-effort).
    if (lemmaConfigured()) {
      await lemmaRecordAuthorization({
        invoiceNumber: invoice.number,
        account: invoice.account.name,
        kind: draft.kind,
        impactPaise: draft.financialImpactPaise,
        requiredRole: roleLabel(requiredRole(draft.kind)),
        rationale: draft.rationale,
      }).catch(() => {});
    }
    if (telegramConfigured()) {
      const base = process.env.APP_URL?.replace(/\/$/, "");
      const url = base ? `${base}/invoices/${invoiceId}` : undefined;
      const meta = actionMeta(draft.kind);
      const text = [
        `🔐 <b>Authorization needed</b>`,
        `<b>${meta.label}</b> · ${invoice.account.name}`,
        `Invoice ${invoice.number} · ${ctx.daysOverdue}d overdue`,
        `Outstanding: <b>${formatMoney(ctx.remainingPaise)}</b>`,
        draft.financialImpactPaise
          ? `💸 At stake: <b>${formatMoney(draft.financialImpactPaise)}</b>`
          : "",
        ``,
        draft.rationale,
        ``,
        `Reply <code>approve ${invoice.number}</code> or <code>decline ${invoice.number}</code>.`,
      ]
        .filter((l) => l !== null)
        .join("\n");
      const res = await notifyManager(text, authorizationButtons(invoice.number, url));
      if (res.ok) {
        await logActivity({
          invoiceId,
          type: "notified",
          message: "Manager pinged on Telegram for authorization",
          actor: "system",
        });
      }
    }
  }

  return {
    invoiceId,
    riskScore: risk.riskScore,
    strategy: risk.strategy,
    kind: draft.kind,
    requiresApproval: review.requiresApproval,
    financialImpactPaise: draft.financialImpactPaise,
    autoSent,
    actionId: action.id,
    citationCount: draft.citations.length,
  };
}

/** Re-run the analysis and propose a fresh action (never auto-sends). */
export async function regenerateAction(invoiceId: string) {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) throw new Error(`Invoice not found: ${invoiceId}`);

  const ctx = buildContext(invoice);
  const risk = await assessRisk(ctx);
  ctx.channel =
    risk.strategy === "nudge" && invoice.account.phone ? "whatsapp" : "email";
  const chunks = await search(`${risk.strategy} collections ${risk.summary}`, 4);
  const draft = await draftOutreach(ctx, risk.strategy, chunks);
  const review = await reviewAction(ctx, draft);

  await updateInvoice(invoiceId, {
    riskScore: risk.riskScore,
    strategy: risk.strategy,
    summary: risk.summary,
    lastAnalyzedAt: new Date(),
  });

  return saveAction({
    invoiceId,
    kind: draft.kind,
    channel: draft.channel,
    body: draft.body,
    financialImpactPaise: draft.financialImpactPaise,
    rationale: `${draft.rationale}${review.reason ? ` · ${review.reason}` : ""}`,
    requiresApproval: review.requiresApproval,
    citations: draft.citations,
  });
}
