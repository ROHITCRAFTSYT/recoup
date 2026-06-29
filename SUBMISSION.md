# Recoup — Submission

**Track:** Gappy.AI National AI Hackathon (powered by the Lemma SDK)
**Type:** Bring-your-own-idea (allowed by the rules); closest to official statement
**#5 "AI Sales / Founder Follow-up CRM"** — applied to *money owed*.
**Live demo login:** `demo@recoup.app` / `demo1234`

---

## 1. One-liner

**Recoup is an autonomous accounts-receivable collections desk where the agent does
the chasing and a human holds the money** — routine dunning runs on its own, but
every settlement, payment plan, write-off, or legal escalation stops for human
authorization, role-gated and grounded in your collections policy.

## 2. The problem

Indian MSMEs have trillions of rupees locked up in overdue invoices. Chasing them is
slow, emotional, and inconsistent — and the decisions that actually matter (offering
a discount, writing a balance off, going legal) carry real financial and legal
weight. A pure chatbot can't be trusted with that; pure automation is reckless.

## 3. The solution & the core insight

The product *is* the line between what an agent can do alone and what needs a human.

```
Overdue invoice → Risk score + strategy → Policy-grounded draft → Authorization review
                                                                        │
                          ┌─────────────────────────────────────────────┴───────────┐
                   AUTONOMOUS                                       HUMAN-IN-THE-LOOP
              routine reminder sent                       settlement / plan / write-off / legal
              (email or WhatsApp)                         waits in the queue, with the ₹ at stake,
                                                          role-gated, until a human signs off
```

- **The gate is deterministic, not model-decided.** Any money/legal move is gated in
  code; the LLM can only *add* friction, never remove it.
- **Offers are policy-bounded.** Discount caps, plan length, and escalation
  thresholds come from the playbook via RAG — the agent can't exceed authority.
- **Authority tiers.** Collectors send reminders; managers approve plans/settlements;
  only Finance Head signs off write-offs and legal. Enforced in the UI.
- **It's a closed loop.** Debtor replies (email/WhatsApp/Telegram) re-run the agent:
  a promise-to-pay becomes a payment plan, a dispute pauses the cadence.
- **Human-in-the-loop in your pocket.** Authorization requests ping Telegram with
  inline Approve/Decline — you can sign off a ₹-settlement from your phone.
- **Full audit trail.** Every score, send, proposal, authorization, reply, and
  payment is logged with who, what, and ₹.

## 4. Two-minute demo — screen-recording shot list

> Have a Groq key set (live AI) and optionally Telegram connected. Reset with
> `npm run db:seed` for a clean book.

1. **Login → Dashboard** (5s). "This is a collections desk. ₹18.9L outstanding,
   AI-projected recovery, money awaiting authorization, and aging." Point at the
   aging bars and the highest-risk cases.
2. **Collections board → Run recovery** (15s). "I drop the whole overdue book on the
   agent." Watch cards get a collectability score and a strategy. "Low-overdue ones
   it just handles — a reminder goes out on WhatsApp or email, autonomously."
3. **Authorizations** (25s). "But here's the point — anything that moves money stops.
   A settlement worth ₹52,500, a write-off, a legal escalation. Each shows the ₹ at
   stake, the agent's reasoning, the policy it cited, and the **authority tier**
   required." Switch the sidebar role to **Collector** → Authorize buttons lock with
   "Needs Manager / Finance Head". Switch back to **Finance Head**.
4. **Telegram** (20s, optional). On the board, run recovery on a fresh invoice →
   "my phone just got the authorization request." Tap **Authorize** (or reply
   `approve INV-1952`) → on the **Integrations** page hit **Sync** → "signed off from
   my phone; the desk executed and logged it as me."
5. **Closed loop** (25s). Open a hostile/legal case → **Simulate a debtor reply**:
   "sorry, cash is tight — can we split it?" → "the agent re-reads, re-scores, and
   flips from legal escalation to a payment plan." Show the **activity timeline**.
6. **Analytics** (15s). "Recovery rate, DSO, how autonomous the agent is, and how
   much was conceded only with sign-off." 
7. **Close** (10s). "The agent does the work. The human holds the money. That's the
   Lemma thesis — approvals, not autonomy."

## 5. How it maps to the judging criteria

| Criterion | How Recoup answers it |
|---|---|
| **Problem clarity** | A specific user (SMB collections owner) and a real, high-stakes, multi-channel workflow with money, state, and login. |
| **Product judgment** | The autonomous/gated split is the core decision; offers are policy-bounded; the gate is deterministic and role-tiered. |
| **Execution** | Single `npm` flow; works with or without any API key; live Groq AI + real Telegram, verified end-to-end; finance-grade UI. |
| **Lemma SDK use** | Runs on a **live Lemma pod** — provisions a `recoup_invoices` table and mirrors invoices via the Lemma **datastore REST API**, read back in the UI (verified against pod `gappy`, `src/lib/lemma/lemma-rest.ts`). The full architecture maps 1:1 onto Lemma primitives; agents/workflow/approval use the REST/local path because the npm `lemma-sdk` is browser-only. Details: `docs/LEMMA_INTEGRATION.md`. |

## 6. Lemma-shaped architecture

| Lemma primitive | Recoup | File |
|---|---|---|
| Tables | Accounts, invoices, outreach, proposed actions | `src/lib/lemma/datastore.ts` |
| Files (knowledge) | Collections playbook → chunked + embedded (RAG) | `src/lib/lemma/docstore.ts` |
| Agents (scoped) | Risk analyst · drafter · authorization reviewer | `src/lib/lemma/agent.ts` |
| Workflows | `processInvoice()` pipeline | `src/lib/lemma/workflow.ts` |
| Approvals | Role-gated money/legal sign-off queue | `src/app/(app)/authorizations` |
| Surfaces | Accounting webhook · email/WhatsApp replies · two-way Telegram | `integrations.ts` · `telegram.ts` |
| Operations | Reusable side-effects shared by actions + webhooks | `src/lib/lemma/operations.ts` |

## 7. Tech

Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind v4 · Prisma/SQLite
(money as integer paise, ₹ Indian grouping) · provider-agnostic AI (Groq/Claude/
OpenAI/Gemini/OpenRouter/Ollama, deterministic heuristic fallback) · Voyage
embeddings (optional) · Telegram Bot API · JWT auth. Claude-aesthetic UI: warm
ivory/clay palette, editorial serif, inline SVG icons, zero emoji.

## 8. Run it

```bash
npm install
cp .env.example .env        # AUTH_SECRET (+ optional GROQ_API_KEY / TELEGRAM_*)
npx prisma migrate dev
npm run db:seed
npm run dev                 # http://localhost:3000
```

See **[README.md](README.md)** and **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**
for the full writeup.
