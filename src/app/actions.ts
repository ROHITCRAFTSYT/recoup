"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ingestInvoice, type IngestInput } from "@/lib/lemma/integrations";
import { processInvoice, regenerateAction } from "@/lib/lemma/workflow";
import { prisma } from "@/lib/db";
import { getSetting, setSetting } from "@/lib/lemma/datastore";
import { ingestPolicy } from "@/lib/lemma/docstore";
import { lemmaSyncInvoices, lemmaSyncAuthorizations } from "@/lib/lemma/lemma-rest";
import { listInvoices, listPendingAuthorizations } from "@/lib/lemma/datastore";
import { requiredRole, roleLabel } from "@/lib/ui";
import {
  executeAction,
  authorizeLatest,
  declineLatest,
  recordPayment,
  markPaid,
  ingestReply,
  handleTelegramText,
  handleTelegramCallback,
} from "@/lib/lemma/operations";
import {
  notifyManager,
  getUpdates,
  answerCallback,
  sendMessage,
  getMe,
} from "@/lib/lemma/telegram";
import { destroySession } from "@/lib/auth";

function revalidateAll(invoiceId?: string) {
  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath("/authorizations");
  if (invoiceId) revalidatePath(`/invoices/${invoiceId}`);
}

// ---- Inbound invoice (simulate / accounting webhook) -----------------------

export async function ingestAction(input: IngestInput) {
  const result = await ingestInvoice(input);
  revalidateAll();
  redirect(`/invoices/${result.invoiceId}`);
}

// ---- Recovery workflow -----------------------------------------------------

export async function runWorkflowAction(invoiceId: string) {
  await processInvoice(invoiceId);
  revalidateAll(invoiceId);
}

export async function regenerateActionAction(invoiceId: string) {
  await regenerateAction(invoiceId);
  revalidateAll(invoiceId);
}

export async function processAllOutstandingAction() {
  const open = await prisma.invoice.findMany({
    where: { status: "outstanding" },
    select: { id: true },
  });
  for (const i of open) await processInvoice(i.id);
  revalidateAll();
}

// ---- Authorizations --------------------------------------------------------

export async function authorizeLatestActionAction(invoiceId: string) {
  await authorizeLatest(invoiceId);
  revalidateAll(invoiceId);
}

export async function sendActionAction(input: {
  invoiceId: string;
  actionId: string;
  body: string;
}) {
  await executeAction(input);
  revalidateAll(input.invoiceId);
}

export async function declineActionAction(invoiceId: string) {
  await declineLatest(invoiceId);
  revalidateAll(invoiceId);
}

// ---- Replies & payments ----------------------------------------------------

export async function simulateReplyAction(input: {
  invoiceId: string;
  body: string;
  channel?: string;
}) {
  await ingestReply({
    invoiceId: input.invoiceId,
    channel: input.channel ?? "email",
    body: input.body,
  });
  revalidateAll(input.invoiceId);
}

export async function recordPaymentAction(invoiceId: string, amountRupees: number) {
  await recordPayment(invoiceId, Math.round(amountRupees * 100));
  revalidateAll(invoiceId);
}

export async function markPaidAction(invoiceId: string) {
  await markPaid(invoiceId);
  revalidateAll(invoiceId);
}

// ---- Manual status ---------------------------------------------------------

export async function setStatusAction(invoiceId: string, status: string) {
  await prisma.invoice.update({ where: { id: invoiceId }, data: { status } });
  revalidateAll(invoiceId);
}

// ---- Playbook --------------------------------------------------------------

export async function addPolicyAction(title: string, text: string) {
  await ingestPolicy({ title, rawText: text, source: "manual" });
  revalidatePath("/playbook");
}

// ---- Telegram integration --------------------------------------------------

export async function testTelegramAction(): Promise<string> {
  const me = await getMe();
  if (!me.ok) return `Not connected: ${me.error ?? "check TELEGRAM_BOT_TOKEN"}.`;
  const res = await notifyManager(
    "✅ <b>Recoup is connected.</b> Authorization requests will arrive here. Reply <code>approve INV-1234</code> or <code>decline INV-1234</code>.",
  );
  return res.ok
    ? `Sent a test message to your manager chat — check Telegram.`
    : `Bot @${me.result?.username} is live, but sending failed: ${res.error ?? "set TELEGRAM_MANAGER_CHAT_ID"}.`;
}

/** Poll Telegram for new messages / button taps and act on them (no public URL needed). */
export async function syncTelegramAction(): Promise<string> {
  const offsetStr = await getSetting("tg_offset");
  const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
  const upd = await getUpdates(offset);
  if (!upd.ok) return `Sync failed: ${upd.error ?? "not connected"}.`;

  const updates = upd.result ?? [];
  let last = offset;
  let acted = 0;
  for (const u of updates) {
    last = u.update_id + 1;
    if (u.callback_query?.data) {
      const reply = await handleTelegramCallback(
        u.callback_query.data,
        u.callback_query.from?.first_name,
      );
      await answerCallback(u.callback_query.id, reply);
      if (u.callback_query.message?.chat.id)
        await sendMessage(String(u.callback_query.message.chat.id), reply);
      acted++;
    } else if (u.message?.text) {
      const reply = await handleTelegramText(u.message.text, u.message.from?.first_name);
      await sendMessage(String(u.message.chat.id), reply);
      acted++;
    }
  }
  if (last !== offset) await setSetting("tg_offset", String(last));
  revalidateAll();
  return updates.length
    ? `Processed ${acted} Telegram message${acted === 1 ? "" : "s"}.`
    : "No new Telegram messages.";
}

// ---- Lemma pod (real platform integration) ---------------------------------

export async function syncToLemmaAction(): Promise<string> {
  const invoices = await listInvoices();
  const r = await lemmaSyncInvoices(invoices);
  if (!r.ok) {
    return `Sync failed: ${r.error ?? "not connected (token may have expired)"}`;
  }
  // Also mirror the current authorization queue into the pod.
  const pending = await listPendingAuthorizations();
  const auths = pending
    .map((i) => {
      const a = i.actions[0];
      return a
        ? {
            invoiceNumber: i.number,
            account: i.account.name,
            kind: a.kind,
            impactPaise: a.financialImpactPaise,
            requiredRole: roleLabel(requiredRole(a.kind)),
            rationale: a.rationale,
          }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const ar = await lemmaSyncAuthorizations(auths);
  revalidatePath("/integrations");
  return `Synced ${r.count} invoices and ${ar.count} pending authorizations into the live Lemma pod.`;
}

// ---- Authority tiers (acting role) -----------------------------------------

export async function setActingRoleAction(role: string) {
  await setSetting("acting_role", role);
  revalidatePath("/", "layout");
}

// ---- Auth ------------------------------------------------------------------

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
