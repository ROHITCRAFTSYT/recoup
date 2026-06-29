import Link from "next/link";
import {
  listInvoices,
  listPendingAuthorizations,
  listActivity,
} from "@/lib/lemma/datastore";
import {
  formatMoney,
  formatMoneyCompact,
  daysOverdue,
  agingBucket,
  AGING_BUCKETS,
  riskTier,
  riskBadge,
  riskLabel,
  statusLabel,
  statusBadge,
} from "@/lib/ui";
import {
  ShieldIcon,
  BanknoteIcon,
  ClockIcon,
  TrendingIcon,
  AlertIcon,
  ActivityIcon,
} from "@/lib/icons";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { NumberTicker } from "@/components/ui/number-ticker";
import DashboardPodStatus from "./dashboard-pod-status";

export const dynamic = "force-dynamic";

const today = () =>
  new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

function timeAgo(d: Date): string {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ACTIVITY_TONE: Record<string, string> = {
  authorized: "var(--positive)",
  paid: "var(--positive)",
  proposed: "var(--danger)",
  notified: "var(--danger)",
  declined: "var(--warning)",
  reply: "var(--warning)",
  reminder_sent: "var(--accent)",
  analyzed: "var(--accent)",
  ingested: "var(--muted)",
};

function StatCard({
  label,
  value,
  format = "plain",
  sub,
  Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  format?: "moneyCompact" | "percent" | "days" | "plain";
  sub?: string;
  Icon: (p: { className?: string }) => React.ReactNode;
  tone?: "default" | "danger" | "positive" | "accent";
}) {
  const ring =
    tone === "danger"
      ? "text-danger"
      : tone === "positive"
        ? "text-positive"
        : tone === "accent"
          ? "text-accent"
          : "text-muted";
  return (
    <SpotlightCard className="rise">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted">{label}</span>
          <Icon className={`h-[18px] w-[18px] ${ring}`} />
        </div>
        <div className="mt-3 font-display text-3xl font-semibold tracking-tight tnum">
          <NumberTicker value={value} format={format} />
        </div>
        {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
      </div>
    </SpotlightCard>
  );
}

export default async function DashboardPage() {
  const [invoices, pending, activity] = await Promise.all([
    listInvoices(),
    listPendingAuthorizations(),
    listActivity(8),
  ]);

  const remaining = (i: { amountPaise: number; paidPaise: number }) =>
    i.amountPaise - i.paidPaise;
  const closed = (s: string) => s === "recovered" || s === "written_off";
  const active = invoices.filter((i) => !closed(i.status));

  const outstanding = active.reduce((s, i) => s + remaining(i), 0);
  const recovered = invoices
    .filter((i) => i.status === "recovered")
    .reduce((s, i) => s + i.paidPaise, 0);

  const scored = active.filter((i) => i.riskScore != null);
  const projected = scored.reduce(
    (s, i) => s + (remaining(i) * (i.riskScore as number)) / 100,
    0,
  );

  const atStake = pending.reduce(
    (s, i) => s + (i.actions[0]?.financialImpactPaise ?? 0),
    0,
  );

  // Weighted average days overdue (a DSO-style health number).
  const totalWeight = active.reduce((s, i) => s + remaining(i), 0);
  const avgDays = totalWeight
    ? Math.round(
        active.reduce((s, i) => s + remaining(i) * daysOverdue(i.dueDate), 0) /
          totalWeight,
      )
    : 0;

  // Aging buckets by outstanding amount.
  const aging = AGING_BUCKETS.map((b) => ({
    ...b,
    amount: active
      .filter((i) => agingBucket(daysOverdue(i.dueDate)) === b.key)
      .reduce((s, i) => s + remaining(i), 0),
  }));
  const maxBucket = Math.max(1, ...aging.map((b) => b.amount));

  // Highest-risk active cases (lowest collectability score first).
  const atRisk = [...scored]
    .sort((a, b) => (a.riskScore as number) - (b.riskScore as number))
    .slice(0, 5);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border bg-surface px-8 py-5">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Recovery dashboard
          </h1>
          <p className="mt-0.5 text-xs text-muted">{today()}</p>
        </div>
        <Link
          href="/board"
          className="cta-shine rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:opacity-90"
        >
          Open collections board
        </Link>
      </header>

      <div className="flex-1 space-y-6 p-8">
        {/* Headline metrics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Outstanding"
            value={outstanding}
            format="moneyCompact"
            sub={`${active.length} open invoices`}
            Icon={BanknoteIcon}
          />
          <StatCard
            label="Projected recovery"
            value={projected}
            format="moneyCompact"
            sub={
              scored.length
                ? `AI-weighted across ${scored.length} scored cases`
                : "Run recovery to project"
            }
            Icon={TrendingIcon}
            tone="accent"
          />
          <StatCard
            label="Awaiting authorization"
            value={pending.length}
            format="plain"
            sub={atStake > 0 ? `${formatMoney(atStake)} at stake` : "Money on hold"}
            Icon={ShieldIcon}
            tone={pending.length ? "danger" : "default"}
          />
          <StatCard
            label="Recovered"
            value={recovered}
            format="moneyCompact"
            sub={`Avg ${avgDays} days overdue`}
            Icon={ClockIcon}
            tone="positive"
          />
        </div>

        {/* Lemma pod status */}
        <DashboardPodStatus />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
          {/* Aging */}
          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-sm font-semibold">Outstanding by age</h2>
            <p className="mt-0.5 text-xs text-muted">
              Where the receivables are stuck — older money is harder to recover.
            </p>
            <div className="mt-5 space-y-4">
              {aging.map((b) => (
                <div key={b.key}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium">{b.label}</span>
                    <span className="text-muted tnum">{formatMoney(b.amount)}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(b.amount / maxBucket) * 100}%`,
                        background:
                          b.key === "90+"
                            ? "var(--danger)"
                            : b.key === "61-90"
                              ? "var(--warning)"
                              : "var(--accent)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Highest-risk cases */}
          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <AlertIcon className="h-4 w-4 text-danger" />
              Highest-risk cases
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Lowest collectability — prioritize or settle.
            </p>
            <div className="mt-4 divide-y divide-border">
              {atRisk.map((i) => {
                const tier = riskTier(i.riskScore as number);
                return (
                  <Link
                    key={i.id}
                    href={`/invoices/${i.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 transition hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {i.account.name}
                      </div>
                      <div className="text-[11px] text-muted tnum">
                        {i.number} · {daysOverdue(i.dueDate)}d overdue
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold tnum">
                        {formatMoneyCompact(remaining(i))}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${riskBadge(tier)}`}
                      >
                        {riskLabel(tier)}
                      </span>
                    </div>
                  </Link>
                );
              })}
              {atRisk.length === 0 && (
                <p className="py-6 text-center text-xs text-muted">
                  No scored cases yet. Run recovery on the board.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Authorizations preview */}
        {pending.length > 0 && (
          <section className="rounded-2xl border border-danger/30 bg-danger-soft/40 p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <ShieldIcon className="h-4 w-4 text-danger" />
                {pending.length} action{pending.length === 1 ? "" : "s"} need your
                sign-off
              </h2>
              <Link
                href="/authorizations"
                className="text-xs font-semibold text-accent hover:underline"
              >
                Review queue →
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {pending.slice(0, 6).map((i) => (
                <Link
                  key={i.id}
                  href="/authorizations"
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-xs transition hover:border-accent/50"
                >
                  <span className="font-medium">{i.account.name}</span>
                  <span className="ml-2 text-muted tnum">
                    {formatMoneyCompact(i.actions[0]?.financialImpactPaise || 0)} at
                    stake
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Recent activity */}
        {activity.length > 0 && (
          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ActivityIcon className="h-4 w-4 text-muted" />
              Recent activity
            </h2>
            <ul className="mt-4 divide-y divide-border">
              {activity.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ background: ACTIVITY_TONE[a.type] ?? "var(--muted)" }}
                  />
                  <span className="flex-1 text-sm">{a.message}</span>
                  {a.amountPaise ? (
                    <span className="text-xs font-medium tnum">
                      {formatMoney(a.amountPaise)}
                    </span>
                  ) : null}
                  <span className="w-16 flex-shrink-0 text-right text-[11px] text-muted">
                    {timeAgo(a.createdAt)}
                  </span>
                  <span className="w-20 flex-shrink-0 text-right text-[11px] uppercase tracking-wide text-muted">
                    {a.actor.split(" ")[0]}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Status legend strip */}
        <div className="flex flex-wrap gap-2">
          {["outstanding", "in_progress", "escalated", "promised", "recovered", "written_off"].map(
            (s) => {
              const n = invoices.filter((i) => i.status === s).length;
              return (
                <span
                  key={s}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadge(s)}`}
                >
                  {statusLabel(s)} · <span className="tnum">{n}</span>
                </span>
              );
            },
          )}
        </div>
      </div>
    </div>
  );
}
