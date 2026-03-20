const TELEGRAM_API = "https://api.telegram.org";

export async function sendTelegramMessage(
  text: string,
  chatId?: string
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const target = chatId || process.env.TELEGRAM_CHAT_ID;

  if (!token || !target) {
    console.warn("Telegram not configured: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
    return false;
  }

  const url = `${TELEGRAM_API}/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: target,
      text,
      parse_mode: "HTML",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Telegram send failed:", err);
    return false;
  }

  return true;
}
