# Architecture

Recoup is an **AI accounts-receivable collections desk** built as a Lemma-shaped
*pod*: structured tables, a policy knowledge base, scoped AI agents, a workflow,
and an **authorization** gate, operated through a logged-in web app (the "desk").

This is the deeper map. For the product overview and run instructions, see the
[README](../README.md).

---

## 1. The work-movement model

```
input      Overdue invoice on a surface (accounting system / CSV / webhook)
   ↓
state      Persisted as an Invoice row; risk agent scores collectability + strategy
   ↓
action     Drafter proposes the next move, grounded in policy and sized in ₹
   ↓
approval   Money/legal moves wait in the Authorizations queue for a human
   ↓
outcome    Outreach sent / concession recorded; invoice advances on the board
```

Routine reminders are sent autonomously. **No money moves and no legal step
reaches a debtor without a human authorizing it.**

---

## 2. The Lemma-shaped abstraction layer

Every Lemma pod primitive is implemented behind a small interface in
`src/lib/lemma/`, so the real SDK can replace the *implementation* of each module
without changing any **call site** in `src/app/`.

| Pod primitive       | Module                     | Today's implementation |
|---------------------|----------------------------|------------------------|
| Tables              | `lemma/datastore.ts`       | Prisma + SQLite |
| Files (policy)      | `lemma/docstore.ts`        | Chunk → embed → cosine/keyword search |
| Embeddings provider | `lemma/embeddings.ts`      | Voyage `voyage-3`, or keyword fallback |
| Agents              | `lemma/agent.ts`           | Claude (Sonnet 4.6 / Opus 4.8) + heuristic fallback |
| Workflows           | `lemma/workflow.ts`        | `processInvoice()` pipeline |
| Surfaces            | `lemma/integrations.ts` · `lemma/telegram.ts` | Accounting ingest · `/api/reply` · two-way Telegram |
| Operations          | `lemma/operations.ts`      | Reusable side-effects (authorize, reply, payment) shared by actions + webhooks |
| Approvals + Desk    | `src/app/(app)/**`         | Server Components + Server Actions |

---

## 3. Request lifecycle (the core loop)

`src/lib/lemma/workflow.ts` → `processInvoice(invoiceId)`:

1. **Assess risk** — `agent.assessRisk()` returns a collectability score (0–100), a
   strategy (`nudge | firm | final | plan | settle | write_off | legal`), and a
   one-line read (Claude Sonnet 4.6, or heuristic if no key).
2. **Pick channel** — a gentle early nudge goes to WhatsApp when we have a number;
   firmer follow-ups and all internal notes go by email.
3. **Retrieve policy** — `docstore.search()` ranks playbook chunks by cosine
   similarity (or keyword overlap) to ground the move within authority limits.
4. **Draft** — `agent.draftOutreach()` writes the message/note grounded in policy,
   maps the strategy to an action `kind`, and sizes any concession in ₹.
5. **Review** — `agent.reviewAction()` decides if a human must authorize it.

The branch:

- **Not gated** (a plain reminder) → the agent sends it, logs an `Outreach` row,
  and the invoice moves to `in_progress`. Autonomous.
- **Gated** (plan / settlement / write-off / legal) → a `ProposedAction` is saved
  as `proposed`, the invoice moves to `escalated` ("Needs sign-off"), and it
  appears in the **Authorizations** queue until a human acts.

### The authorization gate is deterministic

In `reviewAction`, `requiresApproval = ACTION_META[kind].gated || financialImpact > 0`,
then OR-ed with the LLM's opinion. The model can only **add** friction — it can
never downgrade a money/legal action below approval. The gate is policy, not a
prediction.

---

## 4. Data model (`prisma/schema.prisma`)

```
Account ──< Invoice >── User (assignee)
              │
              ├──< Outreach        (email/WhatsApp thread, inbound + outbound)
              └──< ProposedAction  (agent's next move; gated by requiresApproval)

Policy ──< PolicyChunk             (playbook; embedding stored as JSON)
```

Money is stored as integer **paise** to avoid float drift. SQLite keeps the demo
self-contained; the DB choice is hidden behind `datastore.ts`/`docstore.ts`.

`Invoice.status`: `outstanding → analyzing → in_progress → promised → escalated →
recovered | written_off` (see `INVOICE_STATUSES` in `src/lib/ui.ts`).

---

## 5. Auth & routing

- **Login required** across the app. `src/proxy.ts` (Next 16's renamed middleware)
  guards every route except `/login`, `/api/auth`, and the webhook `/api/ingest`.
- Auth is a signed JWT in an httpOnly cookie (`jose`) + bcrypt password check.
- Edge-safe primitives live in `src/lib/auth-edge.ts` (token verify only) so the
  Edge middleware never imports Prisma; Node-only logic is in `src/lib/auth.ts`.

---

## 6. Graceful degradation

Demoable with **zero external keys**:

| Capability     | With key                          | Without key |
|----------------|-----------------------------------|-------------|
| AI agents      | Claude / Groq / any provider      | Deterministic heuristics |
| Policy search  | Voyage embeddings                 | Keyword overlap |

The sidebar status panel shows which mode is live.

---

## 7. File map

```
src/
  app/
    login/                  public login (server action + client form)
    (app)/                  authenticated desk (sidebar layout)
      page.tsx              recovery dashboard (metrics, aging, risk, queue)
      board/                collections board + "run recovery on all"
      authorizations/       human-in-the-loop money/legal sign-off queue
      invoices/[id]/        case view: facts + risk + thread + action editor
      simulate/             simulate an inbound overdue invoice
      playbook/             collections policy KB + add policy
      integrations/         Telegram + surfaces status & controls
    api/ingest/             accounting-system surface (webhook)
    api/reply/              inbound debtor-reply surface (webhook)
    api/telegram/           Telegram webhook (callbacks + commands)
    actions.ts              Server Actions (thin wrappers over lemma/operations)
  lib/
    lemma/                  the Lemma-shaped layer (see §2)
      operations.ts         reusable collection moves (shared by actions + webhooks)
      telegram.ts           two-way Telegram Bot API surface
    auth.ts / auth-edge.ts  session auth
    db.ts                   Prisma client singleton
    ui.ts                   money/status/risk/action presentation helpers
    icons.tsx               inline stroke icon set (no emoji)
prisma/
  schema.prisma             data model (+ ActivityLog audit, Setting kv)
  seed.ts                   demo user + 5-policy playbook + 11 invoices
```
