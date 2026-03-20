import { prisma } from "./prisma";
import { sendTelegramMessage } from "./telegram";
import type { ScrapedSlot } from "./scrapers/types";

interface MonitorWithCourt {
  id: string;
  name: string;
  courtId: string;
  cooldownMin: number;
  lastNotifiedAt: Date | null;
  notifyChannel: string;
  notifyTarget: string | null;
  court: { name: string; bookingUrl: string; metadata?: unknown };
}

export async function notifyNewSlots(
  monitor: MonitorWithCourt,
  newSlots: ScrapedSlot[]
): Promise<number> {
  if (newSlots.length === 0) return 0;

  // Check cooldown
  if (monitor.lastNotifiedAt) {
    const cooldownMs = monitor.cooldownMin * 60 * 1000;
    const elapsed = Date.now() - monitor.lastNotifiedAt.getTime();
    if (elapsed < cooldownMs) return 0;
  }

  const slotLines = newSlots.slice(0, 10).map(
    (s) => `  ${s.date} ${s.startTime}-${s.endTime}${s.courtLabel ? ` (${s.courtLabel})` : ""}`
  );

  const message = [
    `<b>🎾 ${monitor.court.name}</b>`,
    `New slots available!`,
    "",
    ...slotLines,
    newSlots.length > 10 ? `  ...and ${newSlots.length - 10} more` : "",
    "",
    `<a href="${(monitor.court.metadata as Record<string, unknown>)?.deepLink as string || monitor.court.bookingUrl}">Book now</a>`,
  ]
    .filter(Boolean)
    .join("\n");

  let delivered = false;
  if (monitor.notifyChannel === "telegram") {
    delivered = await sendTelegramMessage(message, monitor.notifyTarget ?? undefined);
  }

  // Create alert records
  const alertData = newSlots.slice(0, 20).map((s) => ({
    monitorId: monitor.id,
    slotDate: s.date,
    slotTime: s.startTime,
    courtLabel: s.courtLabel ?? null,
    message,
    channel: monitor.notifyChannel,
    delivered,
  }));

  await prisma.alert.createMany({ data: alertData });

  // Update monitor's lastNotifiedAt
  await prisma.monitor.update({
    where: { id: monitor.id },
    data: { lastNotifiedAt: new Date() },
  });

  return newSlots.length;
}
