"use client";

import { useState, useTransition } from "react";
import { ingestAction } from "@/app/actions";
import { SparkIcon } from "@/lib/icons";

const DAY = 86_400_000;

const SAMPLE = {
  accountName: "Vantage Interiors Pvt Ltd",
  accountEmail: "accounts@vantageinteriors.in",
  contactName: "Neha Kulkarni",
  phone: "+91 98765 43210",
  segment: "SMB",
  invoiceNumber: "INV-2061",
  amountRupees: 145000,
  daysOverdue: 52,
};

const field =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

export default function SimulateForm() {
  const [form, setForm] = useState(SAMPLE);
  const [pending, start] = useTransition();

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    const due = new Date(Date.now() - form.daysOverdue * DAY);
    const issue = new Date(due.getTime() - 30 * DAY);
    start(() =>
      ingestAction({
        source: "manual",
        accountName: form.accountName,
        accountEmail: form.accountEmail,
        contactName: form.contactName,
        phone: form.phone || undefined,
        segment: form.segment,
        invoiceNumber: form.invoiceNumber,
        amountPaise: Math.round(form.amountRupees * 100),
        issueDate: issue.toISOString(),
        dueDate: due.toISOString(),
      }),
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Account name</span>
          <input
            value={form.accountName}
            onChange={(e) => update("accountName", e.target.value)}
            required
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Segment</span>
          <select
            value={form.segment}
            onChange={(e) => update("segment", e.target.value)}
            className={field}
          >
            <option>SMB</option>
            <option>Mid-Market</option>
            <option>Enterprise</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Contact name</span>
          <input
            value={form.contactName}
            onChange={(e) => update("contactName", e.target.value)}
            required
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Account email</span>
          <input
            type="email"
            value={form.accountEmail}
            onChange={(e) => update("accountEmail", e.target.value)}
            required
            className={field}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">
          WhatsApp number <span className="text-muted">(optional)</span>
        </span>
        <input
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          className={field}
        />
      </label>

      <div className="grid grid-cols-3 gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Invoice no.</span>
          <input
            value={form.invoiceNumber}
            onChange={(e) => update("invoiceNumber", e.target.value)}
            required
            className={`${field} tnum`}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Amount (₹)</span>
          <input
            type="number"
            min={1}
            value={form.amountRupees}
            onChange={(e) => update("amountRupees", Number(e.target.value))}
            required
            className={`${field} tnum`}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Days overdue</span>
          <input
            type="number"
            min={0}
            value={form.daysOverdue}
            onChange={(e) => update("daysOverdue", Number(e.target.value))}
            required
            className={`${field} tnum`}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="cta-shine flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg transition hover:opacity-90 disabled:opacity-60"
      >
        <SparkIcon className="h-4 w-4" />
        {pending
          ? "Ingesting & running recovery…"
          : "Add invoice → run recovery pipeline"}
      </button>
      <p className="text-xs text-muted">
        This simulates an overdue invoice arriving from your accounting system. The
        agent will risk-score it, retrieve policy, draft the next move, and either
        send a routine reminder or route a money/legal action for your sign-off.
      </p>
    </form>
  );
}
