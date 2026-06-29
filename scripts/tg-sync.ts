// Poll Telegram for taps/commands and act on them (mirrors syncTelegramAction).
// Run with: npx tsx scripts/tg-sync.ts
import { prisma } from "../src/lib/db";
import { getSetting, setSetting } from "../src/lib/lemma/datastore";
import { handleTelegramText, handleTelegramCallback } from "../src/lib/lemma/operations";
import { getUpdates, answerCallback, sendMessage } from "../src/lib/lemma/telegram";

async function main() {
  const offsetStr = await getSetting("tg_offset");
  const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
  const upd = await getUpdates(offset);
  if (!upd.ok) {
    console.log("Sync failed:", upd.error);
    return;
  }
  const updates = upd.result ?? [];
  let last = offset;
  for (const u of updates) {
    last = u.update_id + 1;
    if (u.callback_query?.data) {
      const reply = await handleTelegramCallback(u.callback_query.data, u.callback_query.from?.first_name);
      await answerCallback(u.callback_query.id, reply);
      if (u.callback_query.message?.chat.id) await sendMessage(String(u.callback_query.message.chat.id), reply);
      console.log("button:", u.callback_query.data, "→", reply);
    } else if (u.message?.text) {
      const reply = await handleTelegramText(u.message.text, u.message.from?.first_name);
      await sendMessage(String(u.message.chat.id), reply);
      console.log("text:", u.message.text, "→", reply);
    }
  }
  if (last !== offset) await setSetting("tg_offset", String(last));
  console.log(`Processed ${updates.length} update(s).`);
}

main().finally(() => prisma.$disconnect());
