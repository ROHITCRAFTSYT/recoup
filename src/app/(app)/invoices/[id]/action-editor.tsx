"use client";

import { useState, useTransition } from "react";
import { sendActionAction, regenerateActionAction } from "@/app/actions";
import { actionMeta, toneClasses, formatMoney, channelLabel } from "@/lib/ui";
import { CheckIcon, RefreshIcon, AlertIcon } from "@/lib/icons";

type Citation = { policyId: string; title: string; snippet: string };

export default function ActionEditor({
  invoiceId,
  actionId,
  kind,
  channel,
  initialBody,
  citations,
  financialImpactPaise,
  requiresApproval,
  rationale,
  sent,
  authorityOk,
  requiredRoleLabel,
}: {
  invoiceId: string;
  actionId: string;
  kind: string;
  channel: string;
  initialBody: string;
  citations: Citation[];
  financialImpactPaise: number;
  requiresApproval: boolean;
  rationale: string;
  sent: boolean;
  authorityOk: boolean;
  requiredRoleLabel: string;
}) {
  const [body, setBody] = useState(initialBody);
  const [sending, startSend] = useTransition();
  const [regenerating, startRegen] = useTransition();
  const meta = actionMeta(kind);
  const isInternal = kind === "write_off" || kind === "escalate_legal";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {meta.label}
          {!sent && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                requiresApproval ? toneClasses(meta.tone) : "bg-surface-2 text-muted"
              }`}
            >
              {requiresApproval ? "needs sign-off" : "auto-send"}
            </span>
          )}
          {sent && (
            <span className="rounded-full bg-positive-soft px-2 py-0.5 text-[10px] font-semibold text-positive">
              authorized
            </span>
          )}
        </h3>
        {!sent && (
          <button
            onClick={() => startRegen(() => regenerateActionAction(invoiceId))}
            disabled={regenerating}
            className="flex items-center gap-1 text-xs font-medium text-accent hover:underline disabled:opacity-60"
          >
            <RefreshIcon className="h-3.5 w-3.5" />
            {regenerating ? "Redrafting…" : "Redraft"}
          </button>
        )}
      </div>

      {requiresApproval && financialImpactPaise > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger-soft/50 px-3 py-2">
          <AlertIcon className="h-4 w-4 flex-shrink-0 text-danger" />
          <span className="text-xs">
            <span className="font-display text-base font-semibold text-danger tnum">
              {formatMoney(financialImpactPaise)}
            </span>{" "}
            <span className="text-muted">
              {meta.tone === "danger" ? "written off" : "concession"} — authorization
              required
            </span>
          </span>
        </div>
      )}

      <div className="rounded-lg border border-accent/20 bg-accent-soft/40 p-2.5 text-[11px] leading-relaxed">
        <span className="font-semibold text-accent">Agent rationale: </span>
        {rationale}
      </div>

      <div>
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
          {isInternal ? "Internal note to manager" : `${channelLabel(channel)} message`}
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          readOnly={sent}
          rows={9}
          className="w-full resize-y rounded-lg border border-border bg-surface p-3 text-sm leading-relaxed outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 read-only:bg-surface-2 read-only:text-muted"
        />
      </div>

      {citations.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Grounded in {citations.length} policy source
            {citations.length > 1 ? "s" : ""}
          </p>
          <div className="flex flex-col gap-1.5">
            {citations.map((c, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-border bg-background p-2 text-[11px]"
              >
                <div className="font-medium text-foreground">{c.title}</div>
                <div className="mt-0.5 line-clamp-2 text-muted">{c.snippet}…</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!sent &&
        (requiresApproval && !authorityOk ? (
          <div className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-muted">
            <AlertIcon className="h-4 w-4" />
            Needs {requiredRoleLabel} authority — switch role in the sidebar
          </div>
        ) : (
          <button
            onClick={() =>
              startSend(() => sendActionAction({ invoiceId, actionId, body }))
            }
            disabled={sending || body.trim().length === 0}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-positive px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            <CheckIcon className="h-4 w-4" />
            {sending
              ? "Authorizing…"
              : requiresApproval
                ? `Authorize & ${isInternal ? "record" : "send"}`
                : `Send ${channelLabel(channel)}`}
          </button>
        ))}
    </div>
  );
}
