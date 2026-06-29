// Seed: one demo user, a collections playbook, and a book of overdue invoices
// for Indian B2B accounts. A subset is run through the recovery pipeline so the
// dashboard and board look alive immediately; the rest stay "outstanding" so you
// can watch the risk → policy → draft → authorization pipeline run live in the
// UI (or via POST /api/ingest). Runs with or without an API key (heuristics).

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { ingestPolicy, search } from "@/lib/lemma/docstore";
import {
  upsertAccount,
  createInvoice,
  addOutreach,
  updateInvoice,
  saveAction,
} from "@/lib/lemma/datastore";
import { processInvoice } from "@/lib/lemma/workflow";
import { assessRisk, draftOutreach, type Strategy } from "@/lib/lemma/agent";
import { daysOverdue } from "@/lib/ui";

const DEMO_EMAIL = "demo@recoup.app";
const DEMO_PASSWORD = "demo1234";
const DAY = 86_400_000;
const L = (rupees: number) => rupees * 100; // rupees → paise

const POLICIES: { title: string; text: string }[] = [
  {
    title: "Collections Policy & Authority Limits",
    text: `Standard payment terms are Net 30 from invoice date. A late-payment fee of 1.5% per month may be applied after 15 days overdue, at the collector's discretion.

Authority limits — who can authorize what:
- Collectors may send reminders and final notices on their own authority.
- Any settlement discount, any payment-plan offer, and any pause of dunning requires manager authorization before it is communicated to the debtor.
- Write-offs and legal/agency escalation require Finance Head authorization.

No concession, discount, or legal step may be communicated to a debtor until it has been authorized inside Recoup. Reminders that contain no concession do not require authorization.`,
  },
  {
    title: "Dunning Cadence & Tone Ladder",
    text: `Contact cadence for an overdue invoice: a gentle reminder at day 3–7, a firmer follow-up around day 15, and a final notice around day 30–45. Space contacts at least 5 days apart.

Tone ladder: start warm and assume an oversight. Escalate to firm and unambiguous by the second contact. A final notice should state consequences plainly and professionally — never threatening, never abusive.

Channels: a first gentle nudge may go over WhatsApp when we have a mobile number; firmer follow-ups and all final notices go by email so there is a written record. Always reference the invoice number, the amount outstanding, and the days overdue.`,
  },
  {
    title: "Settlement & Payment-Plan Guidelines",
    text: `Settlement discounts are capped at 20% of the outstanding balance and are only appropriate when an invoice is more than 60 days overdue and the debtor is engaged but unable to pay in full. Offer the smallest discount likely to close the balance; never open above 15%.

Payment plans may split the balance into up to three equal monthly installments. Plans are appropriate when the debtor has signalled willingness to pay but cites a cash-flow constraint.

Every settlement and every payment plan must be authorized by a manager before it is offered, because both reduce or defer recognized revenue.`,
  },
  {
    title: "Legal Escalation & Write-off Criteria",
    text: `Escalate to legal or a recovery agency only when: the invoice is more than 90 days overdue, standard dunning has been exhausted, and either the balance is material (over ₹2,00,000) or the debtor is unresponsive or hostile. Legal escalation requires Finance Head authorization.

Write off an invoice as uncollectable when it is more than 180 days overdue with no realistic path to recovery, or upon credible evidence of debtor insolvency. Write-offs require Finance Head authorization and a recorded rationale.

Prefer settlement over legal action where the debtor is engaged — litigation is slow and costly.`,
  },
  {
    title: "Disputes & Promise-to-Pay Handling",
    text: `If a debtor disputes an invoice, pause the dunning cadence immediately, log the dispute reason, and route it to the account owner. Do not send further reminders until the dispute is resolved.

When a debtor makes a promise to pay, record the promised date and amount and suppress reminders until the day after. If a promise lapses, resume the cadence one level firmer than before.

Always keep the tone professional. Reciprocity and a clear, easy path to pay recover more than pressure.`,
  },
];

type SeedInvoice = {
  accountName: string;
  accountEmail: string;
  contactName: string;
  phone?: string;
  segment: string;
  number: string;
  amount: number; // rupees
  daysOverdue: number;
  reply?: string; // optional inbound message from the debtor
  process?: boolean; // run the recovery pipeline at seed time
  recovered?: boolean; // mark paid (happy ending, for dashboard)
  // Force a specific gated move so the Authorizations queue is reliably populated
  // for the demo (the message text is still written by the live AI / heuristic).
  forceStrategy?: Strategy;
};

const INVOICES: SeedInvoice[] = [
  {
    accountName: "BrightLoop Media Pvt Ltd",
    accountEmail: "accounts@brightloop.io",
    contactName: "Priya Nair",
    phone: "+91 98200 11234",
    segment: "SMB",
    number: "INV-2041",
    amount: 45_000,
    daysOverdue: 6,
    process: true,
  },
  {
    accountName: "Northstar Analytics",
    accountEmail: "finance@northstar.co",
    contactName: "Dana Olsson",
    phone: "+91 99876 55210",
    segment: "SMB",
    number: "INV-2033",
    amount: 18_500,
    daysOverdue: 12,
    process: true,
  },
  {
    accountName: "Carterworks Studio",
    accountEmail: "ben@carterworks.in",
    contactName: "Ben Carter",
    segment: "SMB",
    number: "INV-2019",
    amount: 1_20_000,
    daysOverdue: 27,
    process: true,
  },
  {
    accountName: "Studiomint Design LLP",
    accountEmail: "ar@studiomint.design",
    contactName: "Aisha Rahman",
    segment: "Mid-Market",
    number: "INV-1998",
    amount: 2_40_000,
    daysOverdue: 41,
    process: true,
  },
  {
    accountName: "Kim Ventures",
    accountEmail: "grace@kimventures.vc",
    contactName: "Grace Kim",
    segment: "Mid-Market",
    number: "INV-1974",
    amount: 90_000,
    daysOverdue: 38,
    reply: "Apologies for the delay — cash is tight this month. Can we split this into a few installments? We do want to clear it.",
    forceStrategy: "plan",
  },
  {
    accountName: "Lang Legal GmbH (India)",
    accountEmail: "tobias@lang-legal.in",
    contactName: "Tobias Lang",
    segment: "Enterprise",
    number: "INV-1952",
    amount: 3_50_000,
    daysOverdue: 73,
    forceStrategy: "settle",
  },
  {
    accountName: "Ferrari & Co Trading",
    accountEmail: "lucia@ferrari-co.in",
    contactName: "Lucia Ferrari",
    segment: "Mid-Market",
    number: "INV-1908",
    amount: 6_00_000,
    daysOverdue: 96,
    reply: "Stop emailing us. We are not paying this until you fix the issues we raised. Talk to our lawyer.",
    forceStrategy: "legal",
  },
  {
    accountName: "Okoye Dev Solutions",
    accountEmail: "sam@okoye.dev",
    contactName: "Sam Okoye",
    segment: "SMB",
    number: "INV-1881",
    amount: 1_75_000,
    daysOverdue: 132,
    forceStrategy: "settle",
  },
  // Recovered — happy ending, feeds the dashboard's recovered total
  {
    accountName: "Webb Consulting",
    accountEmail: "marcus@webb.consulting",
    contactName: "Marcus Webb",
    segment: "SMB",
    number: "INV-1860",
    amount: 65_000,
    daysOverdue: 22,
    recovered: true,
  },
  // Left outstanding for the live demo
  {
    accountName: "Mehta Retail Group",
    accountEmail: "payables@mehtaretail.in",
    contactName: "Rohan Mehta",
    phone: "+91 90040 22118",
    segment: "Mid-Market",
    number: "INV-2052",
    amount: 2_10_000,
    daysOverdue: 9,
  },
  {
    accountName: "Sealine Logistics",
    accountEmail: "accounts@sealine.in",
    contactName: "Farah Sheikh",
    segment: "SMB",
    number: "INV-2057",
    amount: 38_000,
    daysOverdue: 4,
  },
];

// Force a specific gated proposal onto an invoice so the Authorizations queue is
// reliably populated for the demo. The message text is still AI/heuristic-written.
async function proposeGated(invoiceId: string, strategy: Strategy) {
  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { account: true, outreach: true },
  });
  if (!inv) return;
  const lastInbound = [...inv.outreach].reverse().find((o) => o.direction === "inbound");
  const ctx = {
    number: inv.number,
    amountPaise: inv.amountPaise,
    remainingPaise: inv.amountPaise - inv.paidPaise,
    daysOverdue: daysOverdue(inv.dueDate),
    accountName: inv.account.name,
    contactName: inv.account.contactName,
    segment: inv.account.segment,
    channel: "email" as const,
    attempts: inv.outreach.filter((o) => o.direction === "outbound").length,
    lastReply: lastInbound?.body ?? null,
    notes: null,
  };
  const risk = await assessRisk(ctx);
  const chunks = await search(`${strategy} collections`, 4);
  const draft = await draftOutreach(ctx, strategy, chunks);
  await updateInvoice(invoiceId, {
    riskScore: risk.riskScore,
    strategy,
    summary: risk.summary,
    lastAnalyzedAt: new Date(),
    status: "escalated",
  });
  await saveAction({
    invoiceId,
    kind: draft.kind,
    channel: draft.channel,
    body: draft.body,
    financialImpactPaise: draft.financialImpactPaise,
    rationale: draft.rationale,
    requiresApproval: true,
    citations: draft.citations,
  });
}

async function main() {
  console.log("Seeding Recoup…");

  // Seeding runs the pipeline on several invoices; don't blast the manager's
  // Telegram with alerts during a seed. (Live alerts still fire from the app.)
  delete process.env.TELEGRAM_BOT_TOKEN;

  await prisma.activityLog.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.proposedAction.deleteMany();
  await prisma.outreach.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.policyChunk.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await prisma.user.create({
    data: { email: DEMO_EMAIL, name: "Asha Verma", password: passwordHash },
  });
  console.log(`  • demo user: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);

  for (const p of POLICIES) {
    await ingestPolicy({ title: p.title, rawText: p.text, source: "manual" });
  }
  console.log(`  • ${POLICIES.length} playbook policies ingested`);

  const now = Date.now();
  let processed = 0;
  for (const t of INVOICES) {
    const account = await upsertAccount({
      name: t.accountName,
      email: t.accountEmail,
      contactName: t.contactName,
      phone: t.phone,
      segment: t.segment,
    });
    const dueDate = new Date(now - t.daysOverdue * DAY);
    const issueDate = new Date(dueDate.getTime() - 30 * DAY);
    const invoice = await createInvoice({
      number: t.number,
      amountPaise: L(t.amount),
      issueDate,
      dueDate,
      accountId: account.id,
    });

    if (t.reply) {
      await addOutreach({
        invoiceId: invoice.id,
        direction: "inbound",
        channel: "email",
        author: t.contactName,
        body: t.reply,
      });
    }

    if (t.recovered) {
      await updateInvoice(invoice.id, {
        status: "recovered",
        paidPaise: L(t.amount),
        riskScore: 80,
        strategy: "firm",
        summary: "Cleared after a firm follow-up.",
      });
      await addOutreach({
        invoiceId: invoice.id,
        direction: "inbound",
        channel: "email",
        author: t.number,
        body: "Payment received in full. Invoice cleared.",
      });
      continue;
    }

    if (t.forceStrategy) {
      try {
        await proposeGated(invoice.id, t.forceStrategy);
        processed++;
      } catch (e) {
        console.warn(`  ! forced proposal failed for ${t.number}`, e);
      }
    } else if (t.process) {
      try {
        await processInvoice(invoice.id);
        processed++;
      } catch (e) {
        console.warn(`  ! pipeline failed for ${t.number}, leaving outstanding`, e);
      }
    }
  }
  console.log(`  • ${INVOICES.length} invoices created (${processed} run through the pipeline)`);
  console.log("Done. Log in and open the dashboard.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
