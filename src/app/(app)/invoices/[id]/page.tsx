import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getInvoice,
  listActivityForInvoice,
  getActingRole,
} from "@/lib/lemma/datastore";
import {
  formatMoney,
  daysOverdue,
  statusBadge,
  statusLabel,
  riskTier,
  riskBadge,
  riskLabel,
  riskBarColor,
  channelLabel,
  canAuthorize,
  requiredRole,
  roleLabel,
} from "@/lib/ui";
import { ArrowLeftIcon, MailIcon, ChatIcon, ActivityIcon } from "@/lib/icons";
import ActionEditor from "./action-editor";
import {
  RunWorkflowButton,
  StatusSelect,
  MarkPaidButton,
} from "./invoice-controls";
import { SimulateReply, RecordPayment } from "./case-tools";

function timeAgo(d: Date): string {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export const dynamic = "force-dynamic";

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-0.5 text-sm font-medium tnum ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  const [activity, actingRole] = await Promise.all([
    listActivityForInvoice(id),
    getActingRole(),
  ]);

  const remaining = invoice.amountPaise - invoice.paidPaise;
  const days = daysOverdue(invoice.dueDate);
  const analyzed = invoice.riskScore != null;
  const tier = analyzed ? riskTier(invoice.riskScore as number) : null;
  const action = invoice.actions[0] ?? null;
  const citations = action
    ? (JSON.parse(action.citations) as {
        policyId: string;
        title: string;
        snippet: string;
      }[])
    : [];

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-6 py-3.5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link
            href="/board"
            className="flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm text-muted transition hover:bg-black/[.04]"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Board
          </Link>
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-semibold">
              {invoice.account.name}
            </h1>
            <p className="truncate text-xs text-muted tnum">
              {invoice.number} · {invoice.account.segment} ·{" "}
              {invoice.account.email}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(invoice.status)}`}
          >
            {statusLabel(invoice.status)}
          </span>
          <StatusSelect invoiceId={invoice.id} status={invoice.status} />
          <MarkPaidButton invoiceId={invoice.id} />
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[1fr_420px]">
        {/* Left: the case */}
        <div className="flex flex-col gap-4">
          {/* Invoice facts */}
          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted">
                  Outstanding
                </div>
                <div
                  className={`font-display text-3xl font-semibold tnum ${days > 60 ? "text-danger" : ""}`}
                >
                  {formatMoney(remaining)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wide text-muted">
                  {days} days overdue
                </div>
                <div className="mt-0.5 text-sm text-muted tnum">
                  of {formatMoney(invoice.amountPaise)}
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
              <Fact label="Issued" value={fmtDate(invoice.issueDate)} />
              <Fact label="Due" value={fmtDate(invoice.dueDate)} />
              <Fact label="Contact" value={invoice.account.contactName} />
              <Fact
                label="Phone"
                value={invoice.account.phone ?? "—"}
              />
            </div>
          </div>

          {/* Risk read */}
          {analyzed && (
            <div className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Collectability</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${riskBadge(tier!)}`}
                >
                  {riskLabel(tier!)}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="font-display text-2xl font-semibold tnum">
                  {invoice.riskScore}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${invoice.riskScore}%`,
                      background: riskBarColor(tier!),
                    }}
                  />
                </div>
              </div>
              {invoice.summary && (
                <p className="mt-3 text-sm leading-relaxed text-foreground">
                  {invoice.summary}
                </p>
              )}
              {invoice.strategy && (
                <div className="mt-2 text-xs text-muted">
                  Recommended strategy:{" "}
                  <span className="font-medium capitalize text-foreground">
                    {invoice.strategy}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Outreach thread */}
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold">Outreach</h2>
            {invoice.outreach.length === 0 ? (
              <p className="text-sm text-muted">
                No outreach yet. Run the recovery pipeline to propose the first
                move.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {invoice.outreach.map((o) => {
                  const out = o.direction === "outbound";
                  return (
                    <div
                      key={o.id}
                      className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        out
                          ? "self-end rounded-tr-sm bg-accent text-accent-fg"
                          : "self-start rounded-tl-sm bg-surface-2 text-foreground"
                      }`}
                    >
                      <div
                        className={`mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide ${out ? "text-white/70" : "text-muted"}`}
                      >
                        {o.channel === "whatsapp" ? (
                          <ChatIcon className="h-3 w-3" />
                        ) : (
                          <MailIcon className="h-3 w-3" />
                        )}
                        {o.author} · {channelLabel(o.channel)}
                      </div>
                      <div className="whitespace-pre-wrap">{o.body}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Audit trail */}
          {activity.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <ActivityIcon className="h-4 w-4 text-muted" />
                Activity
              </h2>
              <ol className="relative ml-1 border-l border-border">
                {activity.map((a) => (
                  <li key={a.id} className="mb-3 ml-4 last:mb-0">
                    <span className="absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full bg-accent" />
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs text-foreground">{a.message}</span>
                      <span className="flex-shrink-0 text-[10px] text-muted">
                        {timeAgo(a.createdAt)}
                      </span>
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-muted">
                      {a.actor}
                      {a.amountPaise ? ` · ${formatMoney(a.amountPaise)}` : ""}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Right: agent panel */}
        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-1 text-sm font-semibold">Recovery agent</h2>
            <p className="mb-3 text-xs leading-relaxed text-muted">
              Risk-scores the case, retrieves policy, drafts the next move, and
              decides whether it needs your sign-off.
            </p>
            <RunWorkflowButton invoiceId={invoice.id} analyzed={analyzed} />
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5">
            {action ? (
              <ActionEditor
                invoiceId={invoice.id}
                actionId={action.id}
                kind={action.kind}
                channel={action.channel}
                initialBody={action.body}
                citations={citations}
                financialImpactPaise={action.financialImpactPaise}
                requiresApproval={action.requiresApproval}
                rationale={action.rationale}
                sent={action.status === "sent"}
                authorityOk={canAuthorize(actingRole, action.kind)}
                requiredRoleLabel={roleLabel(requiredRole(action.kind))}
              />
            ) : (
              <p className="text-sm text-muted">
                No proposed action yet — run the recovery pipeline to generate the
                next move.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5">
            <SimulateReply invoiceId={invoice.id} />
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5">
            <RecordPayment invoiceId={invoice.id} />
          </div>
        </aside>
      </div>
    </div>
  );
}
