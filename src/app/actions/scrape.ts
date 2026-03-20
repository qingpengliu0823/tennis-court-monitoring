"use server";

import { prisma } from "@/lib/prisma";
import { getAdapter } from "@/lib/scrapers/registry";
import { diffSlots, storeSnapshot } from "@/lib/diff";
import { notifyNewSlots } from "@/lib/notifier";
import { revalidatePath } from "next/cache";

/**
 * Run the full scrape→diff→notify pipeline for a single monitor.
 */
export async function runMonitorNow(monitorId: string) {
  const monitor = await prisma.monitor.findUnique({
    where: { id: monitorId },
    include: { court: true },
  });
  if (!monitor) return { error: "Monitor not found" };

  const court = monitor.court;
  const adapter = getAdapter(court.bookingSystem);
  if (!adapter) return { error: `No adapter for ${court.bookingSystem}` };

  const metadata = {
    ...((court.metadata as Record<string, unknown>) ?? {}),
    ...(monitor.serviceType ? { serviceType: monitor.serviceType } : {}),
  };

  const result = await adapter.scrape(court.id, court.bookingUrl, metadata);

  await prisma.scrapeLog.create({
    data: {
      courtId: court.id,
      adapter: adapter.name,
      status: result.error ? "error" : "success",
      slotsFound: result.slots.length,
      durationMs: result.durationMs,
      error: result.error ?? null,
    },
  });

  if (result.error) {
    revalidatePath("/monitors");
    return { error: result.error, slotsFound: 0, newSlots: 0, alertsSent: 0, durationMs: result.durationMs };
  }

  const newSlots = await diffSlots(court.id, result.slots);
  await storeSnapshot(court.id, result.slots);

  // Filter function for monitor criteria
  const matchesMonitor = (slot: { date: string; startTime: string }) => {
    if (monitor.daysOfWeek.length > 0) {
      const day = new Date(slot.date + "T12:00:00").getDay();
      if (!monitor.daysOfWeek.includes(day)) return false;
    }
    if (monitor.timeFrom && slot.startTime < monitor.timeFrom) return false;
    if (monitor.timeTo && slot.startTime >= monitor.timeTo) return false;
    if (monitor.dateFrom && slot.date < monitor.dateFrom) return false;
    if (monitor.dateTo && slot.date > monitor.dateTo) return false;
    return true;
  };

  // All currently available slots matching this monitor's criteria
  const allMatchingAvailable = result.slots
    .filter((s) => s.available && matchesMonitor(s))
    .map((s) => ({ date: s.date, startTime: s.startTime, endTime: s.endTime, courtLabel: s.courtLabel }));

  // New slots matching criteria — used for alerting only
  const newMatchingSlots = newSlots.filter(matchesMonitor);

  let alertsSent = 0;
  if (newMatchingSlots.length > 0) {
    alertsSent = await notifyNewSlots(
      { ...monitor, court: { name: court.name, bookingUrl: court.bookingUrl, metadata: court.metadata } },
      newMatchingSlots
    );
  }

  await prisma.monitor.update({
    where: { id: monitorId },
    data: { lastCheckedAt: new Date() },
  });

  revalidatePath("/monitors");
  return {
    slotsFound: result.slots.length,
    newSlots: newSlots.length,
    matchingSlots: allMatchingAvailable.length,
    alertsSent,
    durationMs: result.durationMs,
    availableSlots: allMatchingAvailable,
  };
}

export async function scrapeNow(courtId: string) {
  const court = await prisma.court.findUnique({ where: { id: courtId } });
  if (!court) return { error: "Court not found" };

  const adapter = getAdapter(court.bookingSystem);
  if (!adapter) return { error: `No adapter for ${court.bookingSystem}` };

  const result = await adapter.scrape(
    courtId,
    court.bookingUrl,
    (court.metadata as Record<string, unknown>) ?? undefined
  );

  await prisma.scrapeLog.create({
    data: {
      courtId,
      adapter: adapter.name,
      status: result.error ? "error" : "success",
      slotsFound: result.slots.length,
      durationMs: result.durationMs,
      error: result.error ?? null,
    },
  });

  if (!result.error && result.slots.length > 0) {
    const newSlots = await diffSlots(courtId, result.slots);
    await storeSnapshot(courtId, result.slots);

    revalidatePath(`/courts`);
    return {
      slotsFound: result.slots.length,
      newSlots: newSlots.length,
      durationMs: result.durationMs,
    };
  }

  revalidatePath(`/courts`);
  return {
    slotsFound: result.slots.length,
    newSlots: 0,
    durationMs: result.durationMs,
    error: result.error,
  };
}

export async function getAlerts(limit = 50) {
  return prisma.alert.findMany({
    orderBy: { sentAt: "desc" },
    take: limit,
    include: {
      monitor: {
        select: { name: true, court: { select: { name: true } } },
      },
    },
  });
}

export async function getScrapeLogs(limit = 50) {
  return prisma.scrapeLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      court: { select: { name: true } },
    },
  });
}

export async function getDashboardStats() {
  const [courts, monitors, alertsToday, lastScrape] = await Promise.all([
    prisma.court.count({ where: { enabled: true } }),
    prisma.monitor.count({ where: { enabled: true } }),
    prisma.alert.count({
      where: {
        sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
    prisma.scrapeLog.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, status: true },
    }),
  ]);

  return { courts, monitors, alertsToday, lastScrape };
}
