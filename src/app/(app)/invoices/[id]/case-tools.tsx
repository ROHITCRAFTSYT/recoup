"use client";

import { useState, useTransition } from "react";
import { simulateReplyAction, recordPaymentAction } from "@/app/actions";
import { ChatIcon, BanknoteIcon } from "@/lib/icons";

export function SimulateReply({ invoiceId }: { invoiceId: string }) {
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState("email");
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <ChatIcon className="h-4 w-4 text-muted" />
        Simulate a debtor reply
      </h3>
      <p className="text-[11px] text-muted">
        Posts an inbound message and re-runs the agent — try “we can pay next
        week, can we split it?” or “we dispute this invoice”.
      </p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Type a reply as the debtor…"
        className="w-full resize-y rounded-lg border border-border bg-surface p-2.5 text-sm outline-none focus:border-accent"
      />
      <div className="flex items-center gap-2">
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-accent"
        >
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="telegram">Telegram</option>
        </select>
        <button
          onClick={() =>
            start(async () => {
              await simulateReplyAction({ invoiceId, body, channel });
              setBody("");
            })
          }
          disabled={pending || body.trim().length === 0}
          className="rounded-lg bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Re-running agent…" : "Log reply & re-run"}
        </button>
      </div>
    </div>
  );
}

export function RecordPayment({ invoiceId }: { invoiceId: string }) {
  const [amount, setAmount] = useState<number | "">("");
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <BanknoteIcon className="h-4 w-4 text-muted" />
        Record a payment
      </h3>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center rounded-lg border border-border bg-surface px-2.5">
          <span className="text-sm text-muted">₹</span>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value === "" ? "" : Number(e.target.value))
            }
            placeholder="Amount received"
            className="w-full bg-transparent px-1.5 py-1.5 text-sm outline-none tnum"
          />
        </div>
        <button
          onClick={() =>
            start(async () => {
              if (amount && amount > 0) await recordPaymentAction(invoiceId, amount);
              setAmount("");
            })
          }
          disabled={pending || !amount || amount <= 0}
          className="rounded-lg border border-positive/40 bg-positive-soft px-3.5 py-1.5 text-xs font-semibold text-positive transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Recording…" : "Record"}
        </button>
      </div>
      <p className="text-[11px] text-muted">
        Partial payments are tracked; paying the full balance marks it recovered.
      </p>
    </div>
  );
}
