import Link from "next/link";
import {
  listPendingAuthorizations,
  getActingRole,
} from "@/lib/lemma/datastore";
import {
  actionMeta,
  toneClasses,
  formatMoney,
  daysOverdue,
  channelLabel,
  requiredRole,
  roleLabel,
  canAuthorize,
  type ActionKind,
} from "@/lib/ui";
import {
  BellIcon,
  CalendarIcon,
  HandshakeIcon,
  BanknoteIcon,
  GavelIcon,
  ShieldIcon,
} from "@/lib/icons";
import AuthorizationActions from "./authorization-actions";
import { SpotlightCard } from "@/components/ui/spotlight-card";

export const dynamic = "force-dynamic";

const KIND_ICON: Record<ActionKind, (p: { className?: string }) => React.ReactNode> = {
  reminder: BellIcon,
  payment_plan: CalendarIcon,
  settlement: HandshakeIcon,
  write_off: BanknoteIcon,
  escalate_legal: GavelIcon,
};

export default async function AuthorizationsPage() {
  const [pending, actingRole] = await Promise.all([
    listPendingAuthorizations(),
    getActingRole(),
  ]);
  const totalAtStake = pending.reduce(
    (s, i) => s + (i.actions[0]?.financialImpactPaise ?? 0),
    0,
  );

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-border bg-surface px-8 py-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Authorizations
        </h1>
        <p className="mt-0.5 text-xs text-muted tnum">
          {pending.length} action{pending.length === 1 ? "" : "s"} awaiting
          sign-off
          {totalAtStake > 0 ? ` · ${formatMoney(totalAtStake)} at stake` : ""} ·
          the agent proposes, you hold the money
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {pending.map((i, idx) => {
            const action = i.actions[0];
            const meta = actionMeta(action.kind);
            const Icon = KIND_ICON[(action.kind as ActionKind)] ?? BellIcon;
            const citations = JSON.parse(action.citations) as unknown[];
            const days = daysOverdue(i.dueDate);
            const remaining = i.amountPaise - i.paidPaise;
            const reqRole = requiredRole(action.kind);
            const allowed = canAuthorize(actingRole, action.kind);

            return (
              <SpotlightCard
                key={i.id}
                radius={460}
                className="rise"
                style={{ animationDelay: `${idx * 70}ms` }}
              >
                {/* Top bar: what & who */}
                <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${toneClasses(meta.tone)}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{meta.label}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${toneClasses(meta.tone)}`}
                        >
                          needs sign-off
                        </span>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted">
                          Authority: {roleLabel(reqRole)}
                        </span>
                      </div>
                      <Link
                        href={`/invoices/${i.id}`}
                        className="text-xs text-muted hover:text-accent hover:underline tnum"
                      >
                        {i.account.name} · {i.number} · {days}d overdue ·{" "}
                        {channelLabel(action.channel)}
                      </Link>
                    </div>
                  </div>
                  <AuthorizationActions
                    invoiceId={i.id}
                    allowed={allowed}
                    requiredRoleLabel={roleLabel(reqRole)}
                  />
                </div>

                {/* Financial impact strip */}
                <div className="flex items-center justify-between gap-4 bg-background px-5 py-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted">
                      {action.financialImpactPaise > 0
                        ? meta.tone === "danger"
                          ? "Amount written off"
                          : "Concession value"
                        : "Outstanding"}
                    </div>
                    <div
                      className={`font-display text-2xl font-semibold tnum ${
                        action.financialImpactPaise > 0 ? "text-danger" : ""
                      }`}
                    >
                      {formatMoney(
                        action.financialImpactPaise > 0
                          ? action.financialImpactPaise
                          : remaining,
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wide text-muted">
                      Invoice value
                    </div>
                    <div className="font-display text-lg font-semibold tnum text-muted">
                      {formatMoney(i.amountPaise)}
                    </div>
                  </div>
                </div>

                {/* Rationale + message */}
                <div className="space-y-3 px-5 py-4">
                  <div className="rounded-lg border border-accent/20 bg-accent-soft/40 p-3 text-xs leading-relaxed">
                    <span className="font-semibold text-accent">Why: </span>
                    {action.rationale}
                  </div>
                  <div className="rounded-lg border border-border bg-background p-3 text-xs leading-relaxed text-foreground">
                    <div className="line-clamp-4 whitespace-pre-wrap">
                      {action.body}
                    </div>
                    <div className="mt-2 text-[11px] text-muted">
                      Grounded in {citations.length} policy source
                      {citations.length === 1 ? "" : "s"} ·{" "}
                      <Link
                        href={`/invoices/${i.id}`}
                        className="text-accent hover:underline"
                      >
                        open to edit
                      </Link>
                    </div>
                  </div>
                </div>
              </SpotlightCard>
            );
          })}

          {pending.length === 0 && (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-border p-12 text-center">
              <ShieldIcon className="h-8 w-8 text-muted" />
              <p className="mt-3 text-sm font-medium">Nothing to authorize</p>
              <p className="mt-1 max-w-sm text-xs text-muted">
                The agent is handling routine dunning on its own. Money and legal
                moves will surface here for your sign-off.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
