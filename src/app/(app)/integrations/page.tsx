import { aiEnabled, aiLabel } from "@/lib/lemma/agent";
import { embeddingsEnabled } from "@/lib/lemma/embeddings";
import {
  telegramEnabled,
  telegramConfigured,
  managerChatId,
  getMe,
} from "@/lib/lemma/telegram";
import { lemmaConfigured, lemmaPodInfo } from "@/lib/lemma/lemma-rest";
import { SparkIcon, BookIcon, SendIcon, MailIcon, ChatIcon, PlugIcon } from "@/lib/icons";
import TelegramControls from "./telegram-controls";
import LemmaSync from "./lemma-sync";
import LiveLemmaPanel from "./live-lemma-panel";
import LemmaSdkStatus from "./lemma-sdk-status";

export const dynamic = "force-dynamic";

function StatusDot({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        on ? "bg-positive-soft text-positive" : "bg-surface-2 text-muted"
      }`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: on ? "var(--positive)" : "var(--muted)" }}
      />
      {label}
    </span>
  );
}

function Card({
  Icon,
  title,
  desc,
  status,
  children,
}: {
  Icon: (p: { className?: string }) => React.ReactNode;
  title: string;
  desc: string;
  status: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="mt-0.5 max-w-md text-xs text-muted">{desc}</p>
          </div>
        </div>
        {status}
      </div>
      {children}
    </div>
  );
}

export default async function IntegrationsPage() {
  const aiOn = aiEnabled();
  const provider = aiLabel();
  const embeddings = embeddingsEnabled();
  const tgOn = telegramEnabled();
  const tgConfigured = telegramConfigured();
  const me = tgOn ? await getMe() : { ok: false };
  const botName = me.ok ? (me as { result?: { username?: string } }).result?.username : null;

  // Live Lemma pod state (real platform, read over REST via SDK).
  const lemmaOn = lemmaConfigured();
  const pod = lemmaOn ? await lemmaPodInfo() : { ok: false, data: undefined as undefined | { name: string } };

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-border bg-surface px-8 py-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Integrations
        </h1>
        <p className="mt-0.5 text-xs text-muted">
          The surfaces work flows in and out of — agents, policy retrieval, and
          messaging channels.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {/* Lemma SDK — live panel with auto-refresh */}
          {lemmaOn && pod.ok ? (
            <LiveLemmaPanel tableName="recoup_invoices" />
          ) : (
            <Card
              Icon={PlugIcon}
              title="Lemma pod (live)"
              desc="Recoup mirrors invoices AND its human approval gate into a real Lemma pod via the Lemma datastore REST API — proposals become pending records, decisions write back, and it all reads back here. Genuine use of the Lemma platform."
              status={
                <StatusDot
                  on={lemmaOn && pod.ok}
                  label={
                    !lemmaOn
                      ? "not configured"
                      : pod.ok
                        ? `pod: ${pod.data?.name ?? "connected"}`
                        : "token expired"
                  }
                />
              }
            >
              <div className="mt-4 rounded-lg border border-border bg-background p-3 text-xs leading-relaxed text-muted">
                Set <span className="font-mono">LEMMA_POD_ID</span> and{" "}
                <span className="font-mono">LEMMA_TOKEN</span> in{" "}
                <span className="font-mono">.env</span> (from{" "}
                <span className="font-mono">https://lemma.work</span>) to mirror
                invoices into a live pod. See{" "}
                <span className="font-mono">docs/LEMMA_INTEGRATION.md</span>.
              </div>
            </Card>
          )}

          {/* Lemma SDK status detail */}
          {lemmaOn && pod.ok && (
            <Card
              Icon={PlugIcon}
              title="Lemma SDK status"
              desc="Connection health, latency, and pod metadata polled via the SDK-powered API route."
              status={
                <StatusDot
                  on={lemmaOn && pod.ok}
                  label={pod.ok ? "SDK active" : "offline"}
                />
              }
            >
              <div className="mt-4">
                <LemmaSdkStatus />
              </div>
              <div className="mt-3">
                <LemmaSync />
              </div>
            </Card>
          )}

          {/* Telegram */}
          <Card
            Icon={SendIcon}
            title="Telegram"
            desc="Get pinged the instant a money or legal action needs sign-off — and authorize from your phone. Debtors can reply here too; the agent adapts."
            status={
              <StatusDot
                on={tgConfigured}
                label={
                  tgConfigured
                    ? botName
                      ? `@${botName}`
                      : "connected"
                    : tgOn
                      ? "chat not set"
                      : "not connected"
                }
              />
            }
          >
            {tgConfigured ? (
              <TelegramControls configured />
            ) : (
              <div className="mt-4 rounded-lg border border-border bg-background p-3 text-xs leading-relaxed text-muted">
                <p className="font-medium text-foreground">Connect in 3 steps:</p>
                <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                  <li>
                    Message <span className="font-mono">@BotFather</span> on Telegram
                    → <span className="font-mono">/newbot</span> → copy the token.
                  </li>
                  <li>
                    Set <span className="font-mono">TELEGRAM_BOT_TOKEN</span> and{" "}
                    <span className="font-mono">TELEGRAM_MANAGER_CHAT_ID</span> in{" "}
                    <span className="font-mono">.env</span> (DM the bot, then read
                    your chat id from{" "}
                    <span className="font-mono">/getUpdates</span>).
                  </li>
                  <li>Restart, then hit "Send test message".</li>
                </ol>
                <p className="mt-2">
                  Bot token detected: {tgOn ? "yes" : "no"} · Manager chat:{" "}
                  {managerChatId() ? "set" : "not set"}
                </p>
                <TelegramControls configured={false} />
              </div>
            )}
          </Card>

          {/* AI agents */}
          <Card
            Icon={SparkIcon}
            title="AI agents"
            desc="The risk analyst, drafter, and authorization reviewer. Provider-agnostic — Groq, Claude, OpenAI, Gemini, or a local model."
            status={
              <StatusDot on={aiOn} label={aiOn ? `live · ${provider}` : "heuristic"} />
            }
          />

          {/* Policy retrieval */}
          <Card
            Icon={BookIcon}
            title="Policy retrieval"
            desc="Grounds every offer in your collections playbook so the agent never exceeds your authority limits."
            status={
              <StatusDot
                on={embeddings}
                label={embeddings ? "semantic" : "keyword"}
              />
            }
          />

          {/* Inbound surfaces */}
          <Card
            Icon={MailIcon}
            title="Inbound surfaces"
            desc="Webhooks that feed the desk — your accounting system posts overdue invoices, and email/WhatsApp providers post debtor replies."
            status={<StatusDot on label="live" />}
          >
            <div className="mt-4 space-y-2 font-mono text-[11px] text-muted">
              <div className="rounded-lg border border-border bg-background p-2.5">
                <span className="text-positive">POST</span> /api/ingest — new overdue
                invoice
              </div>
              <div className="rounded-lg border border-border bg-background p-2.5">
                <span className="text-positive">POST</span> /api/reply — inbound debtor
                reply
              </div>
              <div className="rounded-lg border border-border bg-background p-2.5">
                <span className="text-positive">POST</span> /api/telegram — Telegram
                webhook
              </div>
              <div className="rounded-lg border border-border bg-background p-2.5">
                <span className="text-accent">GET</span> /api/lemma/live — live pod
                data (SDK-powered)
              </div>
              <div className="rounded-lg border border-border bg-background p-2.5">
                <span className="text-accent">GET</span> /api/lemma/health — pod health
                check (SDK-powered)
              </div>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
              <ChatIcon className="h-3.5 w-3.5" /> Channels in use: Email · WhatsApp ·
              Telegram
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
