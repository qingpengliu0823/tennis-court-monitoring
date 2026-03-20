import { prisma } from "./prisma";
import { getAdapter } from "./scrapers/registry";
import { diffSlots, storeSnapshot } from "./diff";
import { notifyNewSlots } from "./notifier";

const MAX_CONCURRENT = 2;
let running = false;

/**
 * Filter new slots to only those matching a monitor's criteria.
 */
function filterSlotsForMonitor(
  slots: { date: string; startTime: string; endTime: string; available: boolean; courtLabel?: string; totalCourts?: number; rawData?: Record<string, unknown> }[],
  monitor: { daysOfWeek: number[]; timeFrom: string | null; timeTo: string | null; dateFrom: string | null; dateTo: string | null }
) {
  return slots.filter((slot) => {
    // Day of week filter
    if (monitor.daysOfWeek.length > 0) {
      const slotDate = new Date(slot.date + "T12:00:00");
      const day = slotDate.getDay();
      if (!monitor.daysOfWeek.includes(day)) return false;
    }

    // Time range filter
    if (monitor.timeFrom && slot.startTime < monitor.timeFrom) return false;
    if (monitor.timeTo && slot.startTime >= monitor.timeTo) return false;

    // Date range filter
    if (monitor.dateFrom && slot.date < monitor.dateFrom) return false;
    if (monitor.dateTo && slot.date > monitor.dateTo) return false;

    return true;
  });
}

/**
 * Run the scrape → diff → notify pipeline for all due monitors.
 */
export async function runScheduler(): Promise<{
  monitorsChecked: number;
  alertsSent: number;
  errors: string[];
}> {
  if (running) {
    return { monitorsChecked: 0, alertsSent: 0, errors: ["Scheduler already running"] };
  }
  running = true;

  const result = { monitorsChecked: 0, alertsSent: 0, errors: [] as string[] };

  try {
    // Find monitors that are due for checking
    const now = new Date();
    const monitors = await prisma.monitor.findMany({
      where: {
        enabled: true,
        court: { enabled: true },
      },
      include: { court: true },
    });

    const dueMonitors = monitors.filter((m) => {
      if (!m.lastCheckedAt) return true;
      const elapsed = now.getTime() - m.lastCheckedAt.getTime();
      return elapsed >= m.checkIntervalMin * 60 * 1000;
    });

    // Group monitors by court to avoid duplicate scrapes
    const courtMonitors = new Map<string, typeof dueMonitors>();
    for (const m of dueMonitors) {
      const existing = courtMonitors.get(m.courtId) || [];
      existing.push(m);
      courtMonitors.set(m.courtId, existing);
    }

    // Process courts with concurrency limit
    const courtIds = Array.from(courtMonitors.keys());
    for (let i = 0; i < courtIds.length; i += MAX_CONCURRENT) {
      const batch = courtIds.slice(i, i + MAX_CONCURRENT);
      await Promise.allSettled(
        batch.map(async (courtId) => {
          const courtMonitorsList = courtMonitors.get(courtId)!;
          const court = courtMonitorsList[0].court;

          const adapter = getAdapter(court.bookingSystem);
          if (!adapter) {
            result.errors.push(`No adapter for ${court.bookingSystem} (${court.name})`);
            return;
          }

          const scrapeStart = Date.now();
          const scrapeResult = await adapter.scrape(
            courtId,
            court.bookingUrl,
            (court.metadata as Record<string, unknown>) ?? undefined
          );

          // Log the scrape
          await prisma.scrapeLog.create({
            data: {
              courtId,
              adapter: adapter.name,
              status: scrapeResult.error ? "error" : "success",
              slotsFound: scrapeResult.slots.length,
              durationMs: Date.now() - scrapeStart,
              error: scrapeResult.error ?? null,
            },
          });

          if (scrapeResult.error) {
            result.errors.push(`${court.name}: ${scrapeResult.error}`);
            return;
          }

          // Diff against previous snapshot
          const newSlots = await diffSlots(courtId, scrapeResult.slots);

          // Store new snapshot
          await storeSnapshot(courtId, scrapeResult.slots);

          // Process each monitor for this court
          for (const monitor of courtMonitorsList) {
            result.monitorsChecked++;

            // Filter slots matching this monitor's criteria
            const matchingSlots = filterSlotsForMonitor(newSlots, monitor);

            if (matchingSlots.length > 0) {
              const sent = await notifyNewSlots(
                { ...monitor, court: { name: court.name, bookingUrl: court.bookingUrl } },
                matchingSlots
              );
              result.alertsSent += sent;
            }

            // Update lastCheckedAt
            await prisma.monitor.update({
              where: { id: monitor.id },
              data: { lastCheckedAt: new Date() },
            });
          }
        })
      );
    }
  } finally {
    running = false;
  }

  return result;
}
