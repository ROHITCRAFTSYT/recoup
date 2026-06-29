// Presentation helpers shared across the Recoup UI. Pure TS (no JSX) so it can
// be imported from both server and client components. Icons are resolved in the
// components from the `kind`/`channel` keys below.

// ---- Money -----------------------------------------------------------------
// Amounts are stored as integer paise to avoid floating-point drift. The Indian
// locale renders the lakh/crore grouping (₹1,20,000) that judges will expect.

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Format integer paise as ₹ with Indian grouping, e.g. 1250000 → "₹12,500". */
export function formatMoney(paise: number): string {
  return INR.format(Math.round(paise) / 100);
}

/** Compact form for dense metrics, e.g. 4500000 → "₹45,000", 120000000 → "₹12.0L". */
export function formatMoneyCompact(paise: number): string {
  const rupees = Math.round(paise) / 100;
  if (rupees >= 1_00_00_000) return `₹${(rupees / 1_00_00_000).toFixed(2)}Cr`;
  if (rupees >= 1_00_000) return `₹${(rupees / 1_00_000).toFixed(1)}L`;
  return INR.format(rupees);
}

// ---- Invoice lifecycle -----------------------------------------------------

export const INVOICE_STATUSES = [
  "outstanding", // overdue, no action taken yet
  "analyzing", // the agent pipeline is running (transient)
  "in_progress", // agent is autonomously dunning (reminders sent)
  "promised", // debtor committed to pay / plan active
  "escalated", // a money/legal action is awaiting human authorization
  "recovered", // paid in full (or settled)
  "written_off", // closed as uncollectable
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const STATUS_COLUMNS = [
  { key: "outstanding", label: "Outstanding" },
  { key: "in_progress", label: "In progress" },
  { key: "escalated", label: "Needs sign-off" },
  { key: "promised", label: "Promised" },
  { key: "recovered", label: "Recovered" },
  { key: "written_off", label: "Written off" },
] as const;

export function statusBadge(status: string): string {
  switch (status) {
    case "outstanding":
      return "bg-surface-2 text-muted";
    case "analyzing":
      return "bg-accent-soft text-accent";
    case "in_progress":
      return "bg-accent-soft text-accent";
    case "promised":
      return "bg-warning-soft text-warning";
    case "escalated":
      return "bg-danger-soft text-danger";
    case "recovered":
      return "bg-positive-soft text-positive";
    case "written_off":
      return "bg-surface-2 text-muted line-through decoration-1";
    default:
      return "bg-surface-2 text-muted";
  }
}

export function statusLabel(status: string): string {
  return (
    STATUS_COLUMNS.find((c) => c.key === status)?.label ??
    status.replace(/_/g, " ")
  );
}

// ---- Risk ------------------------------------------------------------------
// The collectability score (0–100): higher = more likely to pay on a nudge.

export type RiskTier = "low" | "medium" | "high";

export function riskTier(score: number): RiskTier {
  if (score >= 66) return "low"; // likely to pay — low collection risk
  if (score >= 33) return "medium";
  return "high"; // unlikely to pay — high risk
}

export function riskBadge(tier: RiskTier): string {
  switch (tier) {
    case "low":
      return "bg-positive-soft text-positive";
    case "medium":
      return "bg-warning-soft text-warning";
    case "high":
      return "bg-danger-soft text-danger";
  }
}

export function riskLabel(tier: RiskTier): string {
  return tier === "low"
    ? "Low risk"
    : tier === "medium"
      ? "Medium risk"
      : "High risk";
}

/** Bar color for the collectability meter. */
export function riskBarColor(tier: RiskTier): string {
  return tier === "low"
    ? "var(--positive)"
    : tier === "medium"
      ? "var(--warning)"
      : "var(--danger)";
}

// ---- Aging -----------------------------------------------------------------

export function daysOverdue(dueDate: Date, now = new Date()): number {
  const ms = now.getTime() - new Date(dueDate).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export const AGING_BUCKETS = [
  { key: "0-30", label: "0–30 days", min: 0, max: 30 },
  { key: "31-60", label: "31–60 days", min: 31, max: 60 },
  { key: "61-90", label: "61–90 days", min: 61, max: 90 },
  { key: "90+", label: "90+ days", min: 91, max: Infinity },
] as const;

export function agingBucket(days: number): string {
  return AGING_BUCKETS.find((b) => days >= b.min && days <= b.max)?.key ?? "90+";
}

// ---- Channels --------------------------------------------------------------

export const CHANNELS = ["email", "whatsapp"] as const;
export type Channel = (typeof CHANNELS)[number];

export function channelLabel(channel: string): string {
  return channel === "whatsapp" ? "WhatsApp" : "Email";
}

// ---- Proposed actions ------------------------------------------------------
// The agent's next move. Money-moving / legal actions always need a human.

export const ACTION_KINDS = [
  "reminder",
  "payment_plan",
  "settlement",
  "write_off",
  "escalate_legal",
] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

type ActionMeta = {
  label: string;
  // tone drives the accent used in the UI
  tone: "neutral" | "warning" | "danger";
  // true unless it's a routine reminder — money & legal always gate
  gated: boolean;
  blurb: string;
};

export const ACTION_META: Record<ActionKind, ActionMeta> = {
  reminder: {
    label: "Payment reminder",
    tone: "neutral",
    gated: false,
    blurb: "A dunning message. No concession — sent autonomously.",
  },
  payment_plan: {
    label: "Payment plan",
    tone: "warning",
    gated: true,
    blurb: "Splits the balance into installments. Needs authorization.",
  },
  settlement: {
    label: "Settlement offer",
    tone: "warning",
    gated: true,
    blurb: "Offers a discount to close the balance. Needs authorization.",
  },
  write_off: {
    label: "Write-off",
    tone: "danger",
    gated: true,
    blurb: "Closes the invoice as uncollectable. Needs authorization.",
  },
  escalate_legal: {
    label: "Legal escalation",
    tone: "danger",
    gated: true,
    blurb: "Hands the account to legal / a recovery agency. Needs authorization.",
  },
};

export function actionMeta(kind: string): ActionMeta {
  return ACTION_META[(kind as ActionKind)] ?? ACTION_META.reminder;
}

// ---- Authority tiers -------------------------------------------------------
// Who is allowed to authorize what. Grounded in the playbook: collectors send
// reminders; managers approve plans/settlements; only Finance Head signs off
// write-offs and legal escalation.

export const ROLES = ["collector", "manager", "finance_head"] as const;
export type Role = (typeof ROLES)[number];

export function roleLabel(role: string): string {
  return role === "finance_head"
    ? "Finance Head"
    : role === "manager"
      ? "Manager"
      : "Collector";
}

export function roleRank(role: string): number {
  return role === "finance_head" ? 3 : role === "manager" ? 2 : 1;
}

/** The minimum role required to authorize a given action kind. */
export function requiredRole(kind: string): Role {
  switch (kind) {
    case "write_off":
    case "escalate_legal":
      return "finance_head";
    case "payment_plan":
    case "settlement":
      return "manager";
    default:
      return "collector";
  }
}

/** Can someone acting as `actingRole` authorize this action kind? */
export function canAuthorize(actingRole: string, kind: string): boolean {
  return roleRank(actingRole) >= roleRank(requiredRole(kind));
}

export function toneClasses(tone: "neutral" | "warning" | "danger"): string {
  switch (tone) {
    case "danger":
      return "bg-danger-soft text-danger";
    case "warning":
      return "bg-warning-soft text-warning";
    default:
      return "bg-surface-2 text-muted";
  }
}
