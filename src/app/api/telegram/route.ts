import { NextResponse } from "next/server";
import {
  handleTelegramText,
  handleTelegramCallback,
} from "@/lib/lemma/operations";
import { sendMessage, answerCallback, type TgUpdate } from "@/lib/lemma/telegram";

// POST /api/telegram — Telegram webhook (production mode). For local demos use
// the "Sync Telegram" button instead (getUpdates polling). Set the webhook with:
//   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<APP_URL>/api/telegram&secret_token=<SECRET>
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== secret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    if (update.callback_query?.data) {
      const reply = await handleTelegramCallback(
        update.callback_query.data,
        update.callback_query.from?.first_name,
      );
      await answerCallback(update.callback_query.id, reply);
      if (update.callback_query.message?.chat.id) {
        await sendMessage(String(update.callback_query.message.chat.id), reply);
      }
    } else if (update.message?.text) {
      const reply = await handleTelegramText(
        update.message.text,
        update.message.from?.first_name,
      );
      await sendMessage(String(update.message.chat.id), reply);
    }
  } catch {
    // Never fail a webhook — Telegram retries on non-200.
  }

  return NextResponse.json({ ok: true });
}
