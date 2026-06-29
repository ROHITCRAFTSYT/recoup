// Telegram surface — a real two-way channel, behind the same "swap for Lemma
// later" interface as the other integrations.
//
//   • Outbound: when a money/legal action needs authorization, the manager gets
//     a Telegram ping with the ₹ at stake and inline Approve / Decline buttons.
//   • Inbound: the manager can authorize from their phone ("approve INV-1952"
//     or the inline button), and debtors can reply — the agent ingests it.
//
// Everything degrades gracefully: with no TELEGRAM_BOT_TOKEN the functions
// no-op and the UI shows "not connected" with setup steps.

const API = "https://api.telegram.org";

export function telegramEnabled(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export function managerChatId(): string | null {
  return process.env.TELEGRAM_MANAGER_CHAT_ID || null;
}

export function telegramConfigured(): boolean {
  return telegramEnabled() && Boolean(managerChatId());
}

type TgResult<T = unknown> = { ok: boolean; result?: T; error?: string };

async function call<T = unknown>(method: string, body: unknown): Promise<TgResult<T>> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "Telegram not configured" };
  try {
    const res = await fetch(`${API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // never let a slow Telegram call hang a server action
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
    return { ok: json.ok, result: json.result, error: json.description };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "request failed" };
  }
}

export type InlineButton = { text: string; callback_data?: string; url?: string };

export async function sendMessage(
  chatId: string,
  text: string,
  buttons?: InlineButton[][],
): Promise<TgResult> {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
}

/** Notify the manager chat (the human in the loop). */
export async function notifyManager(
  text: string,
  buttons?: InlineButton[][],
): Promise<TgResult> {
  const chat = managerChatId();
  if (!chat) return { ok: false, error: "No manager chat configured" };
  return sendMessage(chat, text, buttons);
}

export async function getMe(): Promise<TgResult<{ username?: string; first_name?: string }>> {
  return call("getMe", {});
}

export async function getUpdates(offset: number): Promise<TgResult<TgUpdate[]>> {
  return call<TgUpdate[]>("getUpdates", { offset, timeout: 0, allowed_updates: ["message", "callback_query"] });
}

export async function answerCallback(callbackQueryId: string, text: string): Promise<TgResult> {
  return call("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}

// Minimal shapes of the Telegram update payload we care about.
export type TgUpdate = {
  update_id: number;
  message?: {
    chat: { id: number };
    from?: { first_name?: string; username?: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    data?: string;
    from?: { first_name?: string };
    message?: { chat: { id: number } };
  };
};

/** Inline keyboard for an authorization request. */
export function authorizationButtons(invoiceNumber: string, caseUrl?: string): InlineButton[][] {
  const row: InlineButton[] = [
    { text: "✅ Authorize", callback_data: `approve:${invoiceNumber}` },
    { text: "✋ Decline", callback_data: `decline:${invoiceNumber}` },
  ];
  return caseUrl ? [row, [{ text: "Open case", url: caseUrl }]] : [row];
}
