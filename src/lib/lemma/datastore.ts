// Datastore — structured CRUD for accounts, invoices, outreach, and the agent's
// proposed actions. Backed by Prisma/PostgreSQL today; the UI and API import from
// here (never from Prisma directly) so the Lemma datastore swap stays local.

import { prisma } from "@/lib/db";

export async function upsertAccount(input: {
  name: string;
  email: string;
  contactName: string;
  phone?: string;
  segment?: string;
}) {
  return prisma.account.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      contactName: input.contactName,
      phone: input.phone,
      ...(input.segment ? { segment: input.segment } : {}),
    },
    create: {
      name: input.name,
      email: input.email,
      contactName: input.contactName,
      phone: input.phone,
      segment: input.segment ?? "SMB",
    },
  });
}

export async function createInvoice(input: {
  number: string;
  amountPaise: number;
  issueDate: Date;
  dueDate: Date;
  accountId: string;
}) {
  return prisma.invoice.create({
    data: {
      number: input.number,
      amountPaise: input.amountPaise,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      accountId: input.accountId,
      status: "outstanding",
    },
  });
}

export async function getInvoice(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      account: true,
      assignee: true,
      outreach: { orderBy: { createdAt: "asc" } },
      actions: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function listInvoices() {
  return prisma.invoice.findMany({
    include: { account: true },
    orderBy: { dueDate: "asc" },
  });
}

export async function updateInvoice(
  id: string,
  data: Partial<{
    status: string;
    riskScore: number;
    strategy: string;
    summary: string;
    notes: string;
    paidPaise: number;
    lastAnalyzedAt: Date;
  }>,
) {
  return prisma.invoice.update({ where: { id }, data });
}

export async function addOutreach(input: {
  invoiceId: string;
  direction: "outbound" | "inbound";
  channel: string;
  author: string;
  body: string;
}) {
  return prisma.outreach.create({ data: input });
}

export async function saveAction(input: {
  invoiceId: string;
  kind: string;
  channel: string;
  body: string;
  financialImpactPaise: number;
  rationale: string;
  requiresApproval: boolean;
  citations: { policyId: string; title: string; snippet: string }[];
}) {
  return prisma.proposedAction.create({
    data: {
      invoiceId: input.invoiceId,
      kind: input.kind,
      channel: input.channel,
      body: input.body,
      financialImpactPaise: input.financialImpactPaise,
      rationale: input.rationale,
      requiresApproval: input.requiresApproval,
      citations: JSON.stringify(input.citations),
      status: "proposed",
    },
  });
}

export async function updateAction(id: string, data: Partial<{ body: string; status: string }>) {
  return prisma.proposedAction.update({ where: { id }, data });
}

export async function latestPendingAction(invoiceId: string) {
  return prisma.proposedAction.findFirst({
    where: { invoiceId, status: "proposed" },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * The Authorizations queue: invoices whose latest action is a money/legal move
 * still awaiting a human decision. This is the human-in-the-loop surface — the
 * agent proposed an action with real financial consequences; a person signs off.
 */
export async function listPendingAuthorizations() {
  const invoices = await prisma.invoice.findMany({
    include: {
      account: true,
      actions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
  return invoices.filter(
    (i) =>
      i.actions[0] &&
      i.actions[0].status === "proposed" &&
      i.actions[0].requiresApproval,
  );
}

export async function getInvoiceByNumber(number: string) {
  return prisma.invoice.findUnique({
    where: { number },
    include: { account: true },
  });
}

export async function listPolicies() {
  return prisma.policy.findMany({
    include: { _count: { select: { chunks: true } } },
    orderBy: { createdAt: "desc" },
  });
}

// ---- Analytics -------------------------------------------------------------

export async function getAnalytics() {
  const [invoices, outreach, actions] = await Promise.all([
    prisma.invoice.findMany({ include: { account: true } }),
    prisma.outreach.groupBy({ by: ["channel"], _count: { _all: true } }),
    prisma.proposedAction.findMany({
      select: {
        kind: true,
        status: true,
        financialImpactPaise: true,
        requiresApproval: true,
      },
    }),
  ]);
  return { invoices, outreach, actions };
}

// ---- Audit trail -----------------------------------------------------------

export async function logActivity(input: {
  invoiceId?: string;
  type: string;
  message: string;
  actor?: string;
  amountPaise?: number;
}) {
  return prisma.activityLog.create({
    data: {
      invoiceId: input.invoiceId,
      type: input.type,
      message: input.message,
      actor: input.actor ?? "system",
      amountPaise: input.amountPaise,
    },
  });
}

export async function listActivity(limit = 12) {
  return prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function listActivityForInvoice(invoiceId: string) {
  return prisma.activityLog.findMany({
    where: { invoiceId },
    orderBy: { createdAt: "desc" },
  });
}

// ---- Key/value settings ----------------------------------------------------

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  return prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

/** The role the desk is currently acting as (drives authority-tier gating). */
export async function getActingRole(): Promise<string> {
  return (await getSetting("acting_role")) ?? "finance_head";
}
