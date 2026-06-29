import { getAnalytics } from "@/lib/lemma/datastore";
import {
  formatMoney,
  formatMoneyCompact,
  daysOverdue,
  actionMeta,
  type ActionKind,
} from "@/lib/ui";
import { TrendingIcon, ShieldIcon, MailIcon, ChatIcon, SendIcon } from "@/lib/icons";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { NumberTicker } from "@/components/ui/number-ticker";

export const dynamic = "force-dynamic";

const STRATEGY_LABEL: Record<string, string> = {
  nudge: "Nudge",
  firm: "Firm follow-up",
  final: "Final notice",
  plan: "Payment plan",
  settle: "Settlement",
  write_off: "Write-off",
  legal: "Legal",
};

function Stat({
  label,
  value,
  format = "plain",
  sub,
}: {
  label: string;
  value: number;
  format?: "moneyCompact" | "percent" | "days" | "plain";
  sub?: string;
}) {
  return (
    <SpotlightCard>
      <div className="p-5">
        <div className="text-xs font-medium text-muted">{label}</div>
        <div className="mt-2 font-display text-3xl font-semibold tracking-tight tnum">
          <NumberTicker value={value} format={format} />
        </div>
        {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
      </div>
    </SpotlightCard>
  );
}

function Bars({
  rows,
  color = "var(--accent)",
}: {
  rows: { label: string; value: number; display?: string }[];
  color?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium">{r.label}</span>
            <span className="text-muted tnum">{r.display ?? r.value}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full"
              style={{ width: `${(r.value / max) * 100}%`, background: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function AnalyticsPage() {
  const { invoices, outreach, actions } = await getAnalytics();

  const remaining = (i: { amountPaise: number; paidPaise: number }) =>
    i.amountPaise - i.paidPaise;

  const totalBilled = invoices.reduce((s, i) => s + i.amountPaise, 0);
  const recovered = invoices
    .filter((i) => i.status === "recovered")
    .reduce((s, i) => s + i.paidPaise, 0);
  const partial = invoices
    .filter((i) => i.status !== "recovered")
    .reduce((s, i) => s + i.paidPaise, 0);
  const writtenOff = invoices
    .filter((i) => i.status === "written_off")
    .reduce((s, i) => s + remaining(i), 0);
  const collected = recovered + partial;
  const recoveryRate = totalBilled ? Math.round((collected / totalBilled) * 100) : 0;

  const active = invoices.filter(
    (i) => i.status !== "recovered" && i.status !== "written_off",
  );
  const totalWeight = active.reduce((s, i) => s + remaining(i), 0);
  const dso = totalWeight
    ? Math.round(
        active.reduce((s, i) => s + remaining(i) * daysOverdue(i.dueDate), 0) /
          totalWeight,
      )
    : 0;

  // Strategy mix
  const strategyCounts = new Map<string, number>();
  for (const i of invoices) {
    if (i.strategy) strategyCounts.set(i.strategy, (strategyCounts.get(i.strategy) ?? 0) + 1);
  }
  const strategyRows = [...strategyCounts.entries()]
    .map(([k, v]) => ({ label: STRATEGY_LABEL[k] ?? k, value: v }))
    .sort((a, b) => b.value - a.value);

  // Channel mix
  const CH = { email: MailIcon, whatsapp: ChatIcon, telegram: SendIcon };
  const channelRows = outreach
    .map((o) => ({
      label: o.channel.charAt(0).toUpperCase() + o.channel.slice(1),
      value: o._count._all,
      key: o.channel,
    }))
    .sort((a, b) => b.value - a.value);

  // Authorization stats
  const gated = actions.filter((a) => a.requiresApproval);
  const authorized = actions.filter((a) => a.status === "sent" && a.requiresApproval);
  const conceded = authorized.reduce((s, a) => s + a.financialImpactPaise, 0);
  const autoReminders = actions.filter(
    (a) => !a.requiresApproval && a.status === "sent",
  ).length;

  // Action-kind mix
  const kindCounts = new Map<string, number>();
  for (const a of actions) kindCounts.set(a.kind, (kindCounts.get(a.kind) ?? 0) + 1);
  const kindRows = [...kindCounts.entries()]
    .map(([k, v]) => ({ label: actionMeta(k as ActionKind).label, value: v }))
    .sort((a, b) => b.value - a.value);

  // Top accounts by exposure
  const byAccount = new Map<string, number>();
  for (const i of active)
    byAccount.set(i.account.name, (byAccount.get(i.account.name) ?? 0) + remaining(i));
  const topAccounts = [...byAccount.entries()]
    .map(([label, value]) => ({ label, value, display: formatMoneyCompact(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-surface px-8 py-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Analytics
        </h1>
        <p className="mt-0.5 text-xs text-muted">
          How the desk is performing — recovery, autonomy, and where the agent
          spends its effort.
        </p>
      </header>

      <div className="flex-1 space-y-6 p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Recovery rate"
            value={recoveryRate}
            format="percent"
            sub={`${formatMoneyCompact(collected)} of ${formatMoneyCompact(totalBilled)} billed`}
          />
          <Stat
            label="Days sales outstanding"
            value={dso}
            format="days"
            sub="Weighted by balance"
          />
          <Stat
            label="Autonomy"
            value={autoReminders}
            format="plain"
            sub="Reminders sent without a human"
          />
          <Stat
            label="Conceded with sign-off"
            value={conceded}
            format="moneyCompact"
            sub={`${authorized.length} authorized · ${gated.length} gated`}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <TrendingIcon className="h-4 w-4 text-accent" />
              Strategy mix
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              What the agent decided to do across the book.
            </p>
            <div className="mt-5">
              {strategyRows.length ? (
                <Bars rows={strategyRows} />
              ) : (
                <p className="text-xs text-muted">Run recovery to populate.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <MailIcon className="h-4 w-4 text-accent" />
              Channel mix
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Where outreach went — multi-surface by design.
            </p>
            <div className="mt-5">
              {channelRows.length ? (
                <Bars rows={channelRows} color="var(--warning)" />
              ) : (
                <p className="text-xs text-muted">No outreach yet.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldIcon className="h-4 w-4 text-accent" />
              Action mix
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Routine vs. money/legal moves the agent proposed.
            </p>
            <div className="mt-5">
              {kindRows.length ? (
                <Bars rows={kindRows} />
              ) : (
                <p className="text-xs text-muted">Run recovery to populate.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-sm font-semibold">Top accounts by exposure</h2>
            <p className="mt-0.5 text-xs text-muted">
              Largest outstanding balances still open.
            </p>
            <div className="mt-5">
              {topAccounts.length ? (
                <Bars rows={topAccounts} color="var(--danger)" />
              ) : (
                <p className="text-xs text-muted">Nothing outstanding.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
