// Headless equivalent of the Integrations page "Sync to Lemma pod" button.
// Reads the invoice book + pending authorizations from the database and mirrors
// them into the live Lemma pod over the datastore REST API. Run with:
//
//   npx tsx scripts/sync-lemma.ts
//
// Requires a working DATABASE_URL (Postgres) and a FRESH LEMMA_TOKEN + LEMMA_POD_ID
// in .env. Useful for repopulating the pod for a demo without starting the app.

import { listInvoices, listPendingAuthorizations } from "@/lib/lemma/datastore";
import { lemmaSyncInvoices, lemmaSyncAuthorizations } from "@/lib/lemma/lemma-rest";
import { lemmaSdkConfigured } from "@/lib/lemma/sdk/client";
import { requiredRole, roleLabel } from "@/lib/ui";

async function main() {
  if (!lemmaSdkConfigured()) {
    console.error("❌ LEMMA_POD_ID / LEMMA_TOKEN not set in .env — nothing to sync.");
    process.exit(1);
  }

  const invoices = await listInvoices();
  console.log(`Read ${invoices.length} invoices from the database.`);

  const r = await lemmaSyncInvoices(invoices);
  if (!r.ok) {
    console.error(
      `❌ Invoice sync failed: ${r.error ?? "not connected (token may have expired)"}`,
    );
    process.exit(1);
  }

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
  console.log(
    `✅ Synced ${r.count} invoices and ${ar.count} pending authorizations into the live Lemma pod.`,
  );
}

main()
  .catch((e) => {
    console.error("❌", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.$disconnect();
  });
