import "dotenv/config";
import { sendTelegramMessage } from "../src/lib/telegram";

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env first");
    process.exit(1);
  }

  console.log("Sending test message...");
  const ok = await sendTelegramMessage(
    "<b>🎾 Tennis Court Monitor</b>\n\nTest message — notifications are working!"
  );

  console.log(ok ? "Sent successfully!" : "Failed to send.");
}

main().catch(console.error);
