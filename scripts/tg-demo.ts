// One-off: re-run the recovery pipeline on a gated invoice so it fires a real
// Telegram authorization alert to the manager chat. Run with: npx tsx scripts/tg-demo.ts
import { prisma } from "../src/lib/db";
import { processInvoice } from "../src/lib/lemma/workflow";

async function main() {
  const number = process.argv[2] || "INV-1952"; // Lang Legal — settlement, ₹ at stake
  const inv = await prisma.invoice.findUnique({ where: { number } });
  if (!inv) {
    console.error(`Invoice ${number} not found`);
    process.exit(1);
  }
  console.log(`Processing ${number}…`);
  const r = await processInvoice(inv.id);
  console.log(JSON.stringify(r, null, 2));
  console.log(
    r.requiresApproval
      ? `→ Gated: ${r.kind}. A Telegram authorization alert was sent to the manager.`
      : `→ Auto-sent (${r.kind}); not gated, so no Telegram alert. Try a longer-overdue invoice.`,
  );
}

main().finally(() => prisma.$disconnect());
