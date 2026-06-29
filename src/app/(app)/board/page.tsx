import Link from "next/link";
import { listInvoices } from "@/lib/lemma/datastore";
import {
  STATUS_COLUMNS,
  statusBadge,
  formatMoney,
  formatMoneyCompact,
  daysOverdue,
  riskTier,
  riskBadge,
  riskBarColor,
} from "@/lib/ui";
import RunAll from "./run-all";
import BoardSync from "./board-sync";

export const dynamic = "force-dynamic";

type Card = Awaited<ReturnType<typeof listInvoices>>[number];

function InvoiceCard({ i }: { i: Card }) {
  const remaining = i.amountPaise - i.paidPaise;
  const days = daysOverdue(i.dueDate);
  const score = i.riskScore;
  const tier = score != null ? riskTier(score) : null;

  return (
    <Link
      href={`/invoices/${i.id}`}
      className="block rounded-xl border border-border bg-surface p-3.5 transition hover:border-accent/50 hover:shadow-sm"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted tnum">{i.number}</span>
        {tier && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${riskBadge(tier)}`}
          >
            {score}
          </span>
        )}
      </div>

      <div className="mt-1.5 font-display text-lg font-semibold tnum">
        {formatMoney(remaining)}
      </div>
      <div className="truncate text-xs text-muted">{i.account.name}</div>

      {score != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full"
            style={{ width: `${score}%`, background: riskBarColor(tier!) }}
          />
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className={days > 60 ? "font-medium text-danger" : "text-muted"}>
          {days}d overdue
        </span>
        {i.strategy && (
          <span className="rounded bg-surface-2 px-1.5 py-0.5 capitalize text-muted">
            {i.strategy}
          </span>
        )}
      </div>
    </Link>
  );
}

export default async function BoardPage() {
  const invoices = await listInvoices();
  const outstanding = invoices.filter((i) => i.status === "outstanding").length;
  const totalOpen = invoices
    .filter((i) => i.status !== "recovered" && i.status !== "written_off")
    .reduce((s, i) => s + (i.amountPaise - i.paidPaise), 0);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border bg-surface px-8 py-5">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Collections
          </h1>
          <p className="mt-0.5 text-xs text-muted tnum">
            {invoices.length} invoices · {formatMoneyCompact(totalOpen)} open
          </p>
        </div>
        <div className="flex items-center gap-3">
          <BoardSync />
          <RunAll count={outstanding} />
        </div>
      </header>

      <div className="scroll-thin flex flex-1 gap-4 overflow-x-auto p-6">
        {STATUS_COLUMNS.map((col) => {
          const items = invoices.filter((i) => i.status === col.key);
          const colTotal = items.reduce(
            (s, i) => s + (i.amountPaise - i.paidPaise),
            0,
          );
          return (
            <section key={col.key} className="flex w-72 flex-shrink-0 flex-col">
              <div className="mb-3 flex items-center justify-between">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(col.key)}`}
                >
                  {col.label}
                </span>
                <span className="text-[11px] text-muted tnum">
                  {items.length} · {formatMoneyCompact(colTotal)}
                </span>
              </div>
              <div className="scroll-thin flex flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
                {items.map((i) => (
                  <InvoiceCard key={i.id} i={i} />
                ))}
                {items.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted">
                    Empty
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
