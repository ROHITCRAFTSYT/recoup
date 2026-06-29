// Agents — the AI brains of the collections desk, behind one small interface.
//
// Three scoped agents mirror the work: a risk analyst, a drafter, and an
// authorization reviewer. Provider-agnostic: they run on whichever LLM you
// configure (the Lemma brief says "any key/model you want"):
//   • Groq      — free + fast (default when GROQ_API_KEY is set)
//   • Anthropic — Claude Sonnet 4.6 (fast) / Opus 4.8 (review, adaptive thinking)
//   • OpenAI / Gemini / OpenRouter / Ollama / any OpenAI-compatible endpoint
// If NO provider is configured, every agent degrades to a deterministic
// heuristic so the product still demos end-to-end without a key.

import Anthropic from "@anthropic-ai/sdk";
import type { RetrievedChunk } from "./docstore";
import {
  ACTION_META,
  actionMeta,
  riskTier,
  type ActionKind,
} from "@/lib/ui";

type Tier = "fast" | "quality";

type Provider =
  | { kind: "anthropic"; apiKey: string }
  | { kind: "openai"; label: string; apiKey: string; baseUrl: string; model: string }
  | { kind: "none" };

const ANTHROPIC_FAST = "claude-sonnet-4-6";
const ANTHROPIC_QUALITY = "claude-opus-4-8";

const OPENAI_COMPAT: Record<string, { baseUrl: string; defaultModel: string }> = {
  groq: { baseUrl: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile" },
  openai: { baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini" },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
  },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", defaultModel: "meta-llama/llama-3.3-70b-instruct" },
  ollama: { baseUrl: "http://localhost:11434/v1", defaultModel: "llama3.1" },
};

function resolveProvider(): Provider {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();

  if (process.env.AI_BASE_URL && process.env.AI_API_KEY) {
    return {
      kind: "openai",
      label: explicit || "custom",
      apiKey: process.env.AI_API_KEY,
      baseUrl: process.env.AI_BASE_URL.replace(/\/$/, ""),
      model: process.env.AI_MODEL || "llama-3.3-70b-versatile",
    };
  }

  const candidates: { label: string; key?: string }[] = [
    { label: "groq", key: process.env.GROQ_API_KEY },
    { label: "openai", key: process.env.OPENAI_API_KEY },
    { label: "gemini", key: process.env.GEMINI_API_KEY },
    { label: "openrouter", key: process.env.OPENROUTER_API_KEY },
  ];
  const ordered = explicit
    ? [...candidates.filter((c) => c.label === explicit), ...candidates.filter((c) => c.label !== explicit)]
    : candidates;
  for (const c of ordered) {
    if (c.key && OPENAI_COMPAT[c.label]) {
      return {
        kind: "openai",
        label: c.label,
        apiKey: c.key,
        baseUrl: OPENAI_COMPAT[c.label].baseUrl,
        model: process.env.AI_MODEL || OPENAI_COMPAT[c.label].defaultModel,
      };
    }
  }

  if (explicit === "ollama") {
    return {
      kind: "openai",
      label: "ollama",
      apiKey: "ollama",
      baseUrl: OPENAI_COMPAT.ollama.baseUrl,
      model: process.env.AI_MODEL || OPENAI_COMPAT.ollama.defaultModel,
    };
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return { kind: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY };
  }

  return { kind: "none" };
}

export function aiEnabled(): boolean {
  return resolveProvider().kind !== "none";
}

/** Short label for the sidebar status, e.g. "groq" or "claude". */
export function aiLabel(): string | null {
  const p = resolveProvider();
  if (p.kind === "anthropic") return "claude";
  if (p.kind === "openai") return p.label;
  return null;
}

let anthropic: Anthropic | null = null;

/** Call the configured model and parse a JSON object out of the response text. */
async function runJSON<T>(opts: {
  tier: Tier;
  system: string;
  user: string;
  maxTokens?: number;
  thinking?: boolean;
}): Promise<T> {
  const p = resolveProvider();
  let text = "";

  if (p.kind === "anthropic") {
    if (!anthropic) anthropic = new Anthropic({ apiKey: p.apiKey });
    const res = await anthropic.messages.create({
      model: opts.tier === "quality" ? ANTHROPIC_QUALITY : ANTHROPIC_FAST,
      max_tokens: opts.maxTokens ?? 1024,
      system: opts.system,
      ...(opts.thinking ? { thinking: { type: "adaptive" as const } } : {}),
      messages: [{ role: "user", content: opts.user }],
    });
    text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  } else if (p.kind === "openai") {
    const res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p.apiKey}`,
      },
      body: JSON.stringify({
        model: p.model,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: 0.3,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`${p.label} request failed (${res.status}): ${detail.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    text = json.choices?.[0]?.message?.content ?? "";
  } else {
    throw new Error("No AI provider configured");
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`Agent did not return JSON: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text.slice(start, end + 1)) as T;
}

// Shared shape passed to the agents.
export type CaseContext = {
  number: string;
  amountPaise: number;
  remainingPaise: number;
  daysOverdue: number;
  accountName: string;
  contactName: string;
  segment: string;
  channel: "email" | "whatsapp";
  attempts: number; // prior outbound reminders
  lastReply: string | null; // most recent inbound message, if any
  notes: string | null;
};

const rupees = (paise: number) => Math.round(paise / 100).toLocaleString("en-IN");

// ---------------------------------------------------------------------------
// 1. Risk analyst — scores collectability and picks a strategy
// ---------------------------------------------------------------------------

export const STRATEGIES = [
  "nudge", // gentle early reminder
  "firm", // firmer follow-up
  "final", // final notice before escalation
  "plan", // offer installment plan (debtor wants to pay)
  "settle", // offer a settlement discount to close
  "write_off", // recommend writing off as uncollectable
  "legal", // escalate to legal / recovery agency
] as const;
export type Strategy = (typeof STRATEGIES)[number];

export type RiskResult = {
  riskScore: number; // 0–100 collectability
  strategy: Strategy;
  summary: string;
};

export async function assessRisk(ctx: CaseContext): Promise<RiskResult> {
  if (!aiEnabled()) return heuristicRisk(ctx);

  const system = `You are an accounts-receivable collections risk analyst for an Indian B2B SaaS company.
Given an overdue invoice, score how likely the debtor is to pay and choose the next strategy.
Return ONLY a JSON object with these exact fields:
- "riskScore": integer 0-100 (collectability — HIGHER means MORE likely to pay)
- "strategy": one of ${JSON.stringify(STRATEGIES)}
- "summary": one sentence (max 22 words) on the state of this case
Strategy guidance: early/low-overdue → "nudge"; mid → "firm"; pre-escalation → "final";
if the debtor signalled willingness to pay → "plan"; long-overdue but salvageable → "settle";
hostile/very long-overdue large balance → "legal"; clearly uncollectable → "write_off".
No prose, no markdown — just the JSON object.`;

  const user = `Invoice ${ctx.number} · amount ₹${rupees(ctx.amountPaise)} · outstanding ₹${rupees(ctx.remainingPaise)}
Days overdue: ${ctx.daysOverdue}
Debtor: ${ctx.accountName} (${ctx.segment}), contact ${ctx.contactName}
Reminders already sent: ${ctx.attempts}
Most recent reply from debtor: ${ctx.lastReply ?? "(none)"}
Internal notes: ${ctx.notes ?? "(none)"}`;

  try {
    const r = await runJSON<RiskResult>({ tier: "fast", system, user });
    const score = Math.max(0, Math.min(100, Math.round(Number(r.riskScore))));
    return {
      riskScore: Number.isFinite(score) ? score : heuristicRisk(ctx).riskScore,
      strategy: (STRATEGIES as readonly string[]).includes(r.strategy)
        ? r.strategy
        : heuristicRisk(ctx).strategy,
      summary: r.summary?.trim() || heuristicRisk(ctx).summary,
    };
  } catch {
    return heuristicRisk(ctx);
  }
}

// ---------------------------------------------------------------------------
// 2. Drafter — writes the outreach grounded in policy, and sizes any concession
// ---------------------------------------------------------------------------

const STRATEGY_TO_KIND: Record<Strategy, ActionKind> = {
  nudge: "reminder",
  firm: "reminder",
  final: "reminder",
  plan: "payment_plan",
  settle: "settlement",
  write_off: "write_off",
  legal: "escalate_legal",
};

export type DraftResult = {
  kind: ActionKind;
  channel: "email" | "whatsapp";
  body: string;
  financialImpactPaise: number;
  rationale: string;
  citations: { policyId: string; title: string; snippet: string }[];
};

export async function draftOutreach(
  ctx: CaseContext,
  strategy: Strategy,
  chunks: RetrievedChunk[],
): Promise<DraftResult> {
  const kind = STRATEGY_TO_KIND[strategy];
  const citations = chunks.map((c) => ({
    policyId: c.policyId,
    title: c.title,
    snippet: c.content.slice(0, 180),
  }));

  if (!aiEnabled()) {
    return heuristicDraft(ctx, strategy, kind, chunks, citations);
  }

  const context = chunks.length
    ? chunks.map((c, i) => `[Policy ${i + 1}: ${c.title}]\n${c.content}`).join("\n\n")
    : "(no relevant policy found — stay conservative)";

  const tone = {
    nudge: "warm, brief, assume an oversight",
    firm: "polite but firm; make the ask unmistakable",
    final: "serious final-notice tone; state consequences plainly but professionally",
    plan: "collaborative; propose splitting the balance into manageable installments",
    settle: "constructive; offer a one-time discount to settle, but never below policy limits",
    write_off: "an INTERNAL note to a manager recommending write-off (not a message to the debtor)",
    legal: "an INTERNAL note to a manager recommending legal/agency escalation (not a message to the debtor)",
  }[strategy];

  const wantsDiscount = strategy === "settle";

  const system = `You are a collections specialist for an Indian B2B SaaS company. Write the next ${kind === "reminder" ? "reminder to the debtor" : ACTION_META[kind].label.toLowerCase()}.
Tone: ${tone}.
Ground everything in the POLICY context — never offer terms beyond what policy allows.
Address the contact by first name. Reference the invoice number, amount outstanding, and days overdue. Keep it concise (under 130 words). Use Indian Rupee (₹).
Return ONLY a JSON object:
{ "body": "<the message or internal note>", "rationale": "<one sentence: why this move, citing policy>"${wantsDiscount ? ', "discountPercent": <integer 0-30 within policy>' : ""} }`;

  const user = `Invoice ${ctx.number} · amount ₹${rupees(ctx.amountPaise)} · outstanding ₹${rupees(ctx.remainingPaise)} · ${ctx.daysOverdue} days overdue
Debtor: ${ctx.accountName} (${ctx.segment}); contact first name: ${ctx.contactName.split(" ")[0]}
Channel: ${ctx.channel}
Reminders already sent: ${ctx.attempts}

POLICY context:
${context}`;

  try {
    const r = await runJSON<{ body: string; rationale: string; discountPercent?: number }>({
      tier: "fast",
      system,
      user,
      maxTokens: 700,
    });
    const pct = wantsDiscount
      ? Math.max(0, Math.min(30, Math.round(Number(r.discountPercent) || 15)))
      : 0;
    const financialImpactPaise =
      kind === "settlement"
        ? Math.round((ctx.remainingPaise * pct) / 100)
        : kind === "write_off"
          ? ctx.remainingPaise
          : 0;
    return {
      kind,
      channel: ctx.channel,
      body: r.body?.trim() || heuristicDraft(ctx, strategy, kind, chunks, citations).body,
      financialImpactPaise,
      rationale: r.rationale?.trim() || "Recommended by collections strategy.",
      citations,
    };
  } catch {
    return heuristicDraft(ctx, strategy, kind, chunks, citations);
  }
}

// ---------------------------------------------------------------------------
// 3. Authorization reviewer — decides if a human must sign off
// ---------------------------------------------------------------------------
//
// The gate is intentionally NOT left to model whim: any money-moving or legal
// action is gated deterministically. The LLM can only ADD friction (flag a
// borderline reminder), never remove it. It supplies the human-readable reason.

export type ReviewResult = { requiresApproval: boolean; reason: string };

export async function reviewAction(
  ctx: CaseContext,
  draft: DraftResult,
): Promise<ReviewResult> {
  const meta = actionMeta(draft.kind);
  const deterministicGate = meta.gated || draft.financialImpactPaise > 0;

  if (!aiEnabled()) {
    return {
      requiresApproval: deterministicGate,
      reason: deterministicGate
        ? heuristicReason(draft)
        : "Routine reminder — no concession; safe to send autonomously.",
    };
  }

  const system = `You review a collections agent's proposed action before it is taken.
Decide whether a human manager must authorize it. ALWAYS require authorization for any
discount, write-off, payment plan, or legal escalation. You may also require it for a
reminder if the wording is risky. Return ONLY:
{ "requiresApproval": boolean, "reason": "<one sentence>" }`;

  const user = `Proposed action: ${meta.label}
Financial impact (₹ at stake): ₹${rupees(draft.financialImpactPaise)}
Invoice ${ctx.number} · outstanding ₹${rupees(ctx.remainingPaise)} · ${ctx.daysOverdue} days overdue
Message/note:
${draft.body}`;

  try {
    const r = await runJSON<ReviewResult>({
      tier: "quality",
      system,
      user,
      thinking: true,
      maxTokens: 1200,
    });
    return {
      // never let the model downgrade a money/legal gate
      requiresApproval: deterministicGate || Boolean(r.requiresApproval),
      reason: r.reason?.trim() || heuristicReason(draft),
    };
  } catch {
    return {
      requiresApproval: deterministicGate,
      reason: deterministicGate ? heuristicReason(draft) : "Routine reminder.",
    };
  }
}

// ---------------------------------------------------------------------------
// Heuristic fallbacks (no API key) — keep the whole pipeline demoable offline
// ---------------------------------------------------------------------------

function heuristicRisk(ctx: CaseContext): RiskResult {
  let score = 72;
  score -= Math.min(45, Math.floor(ctx.daysOverdue / 2));
  if (ctx.amountPaise > 50_00_000) score -= 12;
  if (ctx.attempts >= 3) score -= 10;
  // Hostility takes precedence — a "we are not paying, talk to our lawyer"
  // reply must never be read as willingness to pay.
  const hostile =
    !!ctx.lastReply &&
    /(dispute|not pay|won'?t pay|will not pay|lawyer|legal|sue|never|refuse|stop emailing)/i.test(
      ctx.lastReply,
    );
  const repliedPositively =
    !hostile &&
    !!ctx.lastReply &&
    /(will (pay|clear)|can pay|happy to pay|clear (it|this)|next week|arrange|installment|split|settle|tomorrow|sorry for the delay)/i.test(
      ctx.lastReply,
    );
  if (repliedPositively) score += 22;
  if (hostile) score -= 28;
  score = Math.max(5, Math.min(95, score));

  const d = ctx.daysOverdue;
  let strategy: Strategy;
  if (repliedPositively) strategy = "plan";
  else if (hostile && d > 75) strategy = "legal";
  else if (d <= 15) strategy = "nudge";
  else if (d <= 40) strategy = "firm";
  else if (d <= 70) strategy = "final";
  else if (d <= 110) strategy = score < 30 ? "settle" : "final";
  else strategy = score < 20 ? "legal" : "settle";

  const summary =
    strategy === "plan"
      ? `${ctx.contactName.split(" ")[0]} signalled willingness to pay — propose an installment plan.`
      : strategy === "legal"
        ? `₹${rupees(ctx.remainingPaise)} outstanding ${d} days; low collectability — recommend escalation.`
        : strategy === "settle"
          ? `Aging ${d} days; salvageable with a settlement discount within policy.`
          : `₹${rupees(ctx.remainingPaise)} outstanding ${d} days overdue — send a ${strategy} reminder.`;

  return { riskScore: score, strategy, summary };
}

function heuristicDraft(
  ctx: CaseContext,
  strategy: Strategy,
  kind: ActionKind,
  chunks: RetrievedChunk[],
  citations: { policyId: string; title: string; snippet: string }[],
): DraftResult {
  const first = ctx.contactName.split(" ")[0] || "there";
  const amt = `₹${rupees(ctx.remainingPaise)}`;
  let body: string;
  let financialImpactPaise = 0;

  switch (kind) {
    case "payment_plan":
      body = `Hi ${first},\n\nThanks for getting back to us on invoice ${ctx.number} (${amt} outstanding, ${ctx.daysOverdue} days overdue). To make this easier, we can split the balance into three equal monthly installments. If that works, reply "yes" and we'll set it up.\n\nBest,\nRecoup Collections`;
      break;
    case "settlement": {
      const pct = 15;
      financialImpactPaise = Math.round((ctx.remainingPaise * pct) / 100);
      body = `Hi ${first},\n\nInvoice ${ctx.number} has been outstanding for ${ctx.daysOverdue} days (${amt}). To close this out, we can offer a one-time ${pct}% settlement discount if paid within 7 days. Let us know and we'll send the revised total.\n\nBest,\nRecoup Collections`;
      break;
    }
    case "write_off":
      financialImpactPaise = ctx.remainingPaise;
      body = `Internal note — recommend writing off invoice ${ctx.number} (${amt}, ${ctx.daysOverdue} days overdue). Repeated outreach (${ctx.attempts} attempts) has gone unanswered and collectability is low. Requesting authorization to close as uncollectable.`;
      break;
    case "escalate_legal":
      body = `Internal note — recommend escalating invoice ${ctx.number} (${amt}, ${ctx.daysOverdue} days overdue) to legal / a recovery agency. Standard dunning has been exhausted. Requesting authorization before any formal demand is issued.`;
      break;
    default: {
      const lead =
        strategy === "final"
          ? `This is a final notice on invoice ${ctx.number}.`
          : strategy === "firm"
            ? `Following up again on invoice ${ctx.number}.`
            : `Quick reminder on invoice ${ctx.number}.`;
      body = `Hi ${first},\n\n${lead} ${amt} is now ${ctx.daysOverdue} days past due. ${
        strategy === "final"
          ? "Please arrange payment within 3 business days to avoid further action."
          : "Could you let us know when we can expect payment?"
      }${chunks[0] ? `\n\nPer our terms: ${chunks[0].content.slice(0, 140)}…` : ""}\n\nBest,\nRecoup Collections`;
    }
  }

  return {
    kind,
    channel: ctx.channel,
    body,
    financialImpactPaise,
    rationale:
      kind === "reminder"
        ? `${strategy} reminder is the appropriate step at ${ctx.daysOverdue} days overdue.`
        : `${actionMeta(kind).label} recommended given aging and collectability${chunks[0] ? `, per "${chunks[0].title}".` : "."}`,
    citations,
  };
}

function heuristicReason(draft: DraftResult): string {
  const meta = actionMeta(draft.kind);
  if (draft.financialImpactPaise > 0) {
    return `${meta.label} puts ₹${rupees(draft.financialImpactPaise)} at stake — requires manager authorization.`;
  }
  return `${meta.label} carries legal/financial consequence — requires manager authorization.`;
}

// keep riskTier importable from agents for callers that only import this module
export { riskTier };
