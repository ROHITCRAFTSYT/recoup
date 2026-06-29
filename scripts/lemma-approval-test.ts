import { prisma } from "../src/lib/db";
import { listPendingAuthorizations } from "../src/lib/lemma/datastore";
import { lemmaSyncAuthorizations, lemmaListAuthorizations } from "../src/lib/lemma/lemma-rest";
import { authorizeLatest } from "../src/lib/lemma/operations";
import { requiredRole, roleLabel } from "../src/lib/ui";
(async () => {
  const pending = await listPendingAuthorizations();
  const auths = pending.map((i) => { const a = i.actions[0]; return { invoiceNumber: i.number, account: i.account.name, kind: a.kind, impactPaise: a.financialImpactPaise, requiredRole: roleLabel(requiredRole(a.kind)), rationale: a.rationale }; });
  const sync = await lemmaSyncAuthorizations(auths);
  console.log("1) synced pending authorizations to pod:", sync);
  let live = await lemmaListAuthorizations(50);
  console.log("2) in pod:", live.map((r) => `${r.invoice_number}=${r.status}`).join(", "));
  const target = pending[0];
  if (target) {
    console.log(`3) authorizing ${target.number} (${target.actions[0].kind}) as Finance Head…`);
    await authorizeLatest(target.id, "Asha Verma");
    live = await lemmaListAuthorizations(50);
    console.log("4) in pod after decision:", live.map((r) => `${r.invoice_number}=${r.status}${r.decided_by ? "/" + r.decided_by : ""}`).join(", "));
  }
})().finally(() => prisma.$disconnect());
