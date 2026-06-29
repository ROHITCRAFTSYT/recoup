# Wiring the real Lemma SDK into Recoup

**Status:** Recoup **is integrated with a live Lemma pod** for its datastore —
`src/lib/lemma/lemma-rest.ts` provisions a `recoup_invoices` table and mirrors
invoices via the Lemma **datastore REST API**, read back on the Integrations page
(verified against pod `gappy`). This doc covers (a) what's wired now and (b) the
drop-in path for the remaining primitives (agents, workflow, approval gate), which
still use the local "Lemma-shaped" path because the npm `lemma-sdk` is browser-only.

> **Update:** Recoup now uses the **official `lemma-sdk` npm package** for real —
> in the browser, the surface it was built for. The SDK Explorer's **Browser SDK**
> tab loads it lazily (`src/lib/lemma/sdk/browser.ts`), seeds a Bearer testing
> token, constructs the genuine `LemmaClient`, and reads the live pod with
> `client.pods.get`, `client.tables.list`, and `client.records.list`. It is gated
> behind `NEXT_PUBLIC_LEMMA_TOKEN` (opt-in, since the token is client-visible).
>
> On the **server**, where the npm SDK can't import (it statically pulls in
> `supertokens-web-js`), a small typed REST `LemmaClient` in `src/lib/lemma/sdk/`
> mirrors the same surface and keeps the token server-side behind the
> `/api/lemma/*` proxy routes. The legacy REST helpers in `lemma-rest.ts` delegate
> to it internally.

## What's wired today

### SDK layer (`src/lib/lemma/sdk/`)

- **`LemmaClient`** — typed, retry-aware REST client for the Lemma datastore API.
  - `client.pod.info()` — pod metadata + live auth check.
  - `client.datastore.tables.list/get/ensure/delete` — table management.
  - `client.datastore.records.list/get/create/update/delete/upsert` — record CRUD.
  - `client.health()` — lightweight latency + connectivity check.
- **React hooks** (`sdk/react.tsx`) — client-side polling via proxy API routes:
  - `useLemmaClient()` — access the configured `LemmaClient`.
  - `useLiveRecords(tableName, opts)` — auto-refreshing records (8 s poll).
  - `usePodHealth()` — connection state + pod name badge.
  - `LemmaProvider` — context wrapper (mirrors `lemma-sdk/react`).
- **API routes** — authenticated proxy so the browser never sees the token:
  - `GET /api/lemma/live` — live pod data (tables, records).
  - `GET /api/lemma/health` — health check with latency.

### Legacy REST integration (`lemma-rest.ts`)

The original helpers are preserved for backward compatibility, but every call now
routes through `LemmaClient` internally:

- `POST /pods/{id}/datastore/tables` — creates `recoup_invoices` (idempotent).
- `POST|PATCH /…/tables/recoup_invoices/records` — mirror invoices into the pod
  (write-through on "simulate invoice"; bulk via the **Sync** button on Integrations).
- `GET /…/records` — the Integrations page reads records back live from the pod.
- **Approval gate in the pod:** a `recoup_authorizations` table holds every gated
  money/legal proposal as a `pending` record; authorizing/declining in the app
  `PATCH`es the record to `authorized`/`declined` with the decider's name. Verified
  end-to-end (`INV-1881` → `authorized/Asha Verma`). The native conversation-approval
  primitive (`/conversations/{id}/approvals/{id}/decision`) is agent-raised only, so
  with no Lemma agent in the pod we route the gate through the datastore instead.
- Auth: `Authorization: Bearer <LEMMA_TOKEN>`, pod from `LEMMA_POD_ID`. The token
  today is a short-lived session JWT (~1h) — swap a long-lived service token for
  persistence (`lemma auth login` on Mac/Linux/WSL; the CLI's auth is broken on
  Windows via a `termios` import).

## Why the npm SDK is browser-only (and how we use it anyway)

`lemma-sdk` (v0.5.2, published 2026-06-24) is a **client / session SDK**:

- It authenticates with **supertokens browser sessions** and ships **React hooks**
  (`lemma-sdk/react`) as its main surface. Its `client.js` → `auth.js` chain has a
  **static** `import … from "supertokens-web-js/recipe/session"`, which fails to
  resolve in a Node/server ESM runtime — so the package **cannot be imported
  server-side**. Our app is server-rendered (Server Components + Server Actions over
  Prisma), the opposite shape.
- Every real call is **pod-scoped and authenticated**. For agent/dev use the SDK
  supports a **Bearer "testing token"** (`setTestingToken`, read from `localStorage`),
  which is exactly the path our browser showcase uses; production uses a SuperTokens
  cookie session via `lemma auth login`.

**What we ship:** the genuine npm `LemmaClient` runs **in the browser** (SDK Explorer
→ Browser SDK, `src/lib/lemma/sdk/browser.ts`), and a server-side REST twin keeps the
token server-side everywhere else. Below is how each `src/lib/lemma/` module maps to
the full SDK for the remaining primitives (agents, workflow, approval gate).

## 1. Provision (one-time, your account)

```bash
uv tool install lemma-terminal          # the CLI
lemma auth login                         # browser OAuth — only you can do this
lemma pod create recoup --with-starter   # creates the pod
# define tables: accounts, invoices, outreach, proposed_actions
# define agents: risk-analyst, drafter, authorization-reviewer
# define a workflow: process-invoice  (+ an approval gate on money/legal actions)
# connect surfaces: email / whatsapp / telegram integrations
```

Then in `.env`:

```bash
LEMMA_POD_ID="<pod-id>"
LEMMA_API_URL="https://api.lemma.work"
NEXT_PUBLIC_LEMMA_POD_ID="<pod-id>"   # for the client hooks
```

```bash
npm install lemma-sdk @tanstack/react-query
```

## 2. Module-by-module mapping

The call sites in `src/app/**` never change — only the bodies of these modules.

| Module (today) | Lemma SDK replacement |
|---|---|
| `lemma/datastore.ts` (Prisma CRUD) | `client.records.list/get/create/update("invoices" \| "accounts" \| "outreach" \| "proposed_actions")` |
| `lemma/docstore.ts` (chunk+embed playbook) | `client.files` / `client.resources` + Lemma retrieval |
| `lemma/agent.ts` (direct Groq/Claude calls) | `client.agents.run("risk-analyst", input)` / `client.conversations` |
| `lemma/workflow.ts` (`processInvoice`) | `client.workflows.run("process-invoice", { invoiceId })` |
| Authorizations queue | Lemma **approval gate** on the workflow + `client.desks` |
| `lemma/integrations.ts` / `telegram.ts` | `client.integrations` (email / WhatsApp / Telegram surfaces) |

## 3. Client wiring (the SDK's intended surface)

```tsx
// src/app/lemma-provider.tsx  ("use client")
import { LemmaProvider } from "lemma-sdk/react";
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LemmaProvider config={{ podId: process.env.NEXT_PUBLIC_LEMMA_POD_ID! }}>
      {children}
    </LemmaProvider>
  );
}
```

```tsx
// A live collections board — real Lemma records over a WebSocket, no polling
"use client";
import { useLiveRecords } from "lemma-sdk/react";
export function LiveBoard({ client }: { client: LemmaClient }) {
  const { records } = useLiveRecords({ client, tableName: "invoices" });
  // render columns by status — updates merge in place as the agent works
}
```

Or drop a real Lemma agent straight into the case view with the web component:

```html
<lemma-agent-task agent="risk-analyst" input='{"invoiceId":"..."}' auto-run></lemma-agent-task>
```

## 4. Server-side option

If you want the Server Actions to call Lemma directly (rather than client hooks),
use Lemma's REST API with a **service token** from your pod settings (machine auth,
not a browser session) and `fetch(\`${LEMMA_API_URL}/pods/${podId}/records/...\`)`.
Confirm machine-token support in your pod's API settings first.

## 5. The payoff

Once wired, the live datastore (`client.datastore.watchChanges` /
`useLiveRecords`) turns the board into a **real-time** surface, and the agents /
workflow / approval gate run inside Lemma — exactly the "pod" the architecture was
shaped around. The UI and the `input → state → action → approval → outcome` flow
stay identical.
