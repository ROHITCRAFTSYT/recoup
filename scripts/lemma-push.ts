import { prisma } from "../src/lib/db";
import { listInvoices } from "../src/lib/lemma/datastore";
import { lemmaSyncInvoices, lemmaListInvoices } from "../src/lib/lemma/lemma-rest";
(async () => {
  const invoices = await listInvoices();
  console.log("local invoices:", invoices.length);
  const r = await lemmaSyncInvoices(invoices);
  console.log("sync result:", r);
  const live = await lemmaListInvoices(100);
  console.log("records now in Lemma pod:", live.length);
  console.log("sample:", live.slice(0, 3).map(x => `${x.number} ${x.account_name} ₹${(x.amount_paise||0)/100} ${x.status}`));
})().finally(() => prisma.$disconnect());
