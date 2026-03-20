import { prisma } from "./prisma";
import type { ScrapedSlot } from "./scrapers/types";

/**
 * Compare new scraped slots against the latest stored snapshot for a court.
 * Returns slots that are newly available (not in the previous snapshot).
 */
export async function diffSlots(
  courtId: string,
  newSlots: ScrapedSlot[]
): Promise<ScrapedSlot[]> {
  // Get the most recent scrape timestamp for this court
  const latestSnapshot = await prisma.slotSnapshot.findFirst({
    where: { courtId },
    orderBy: { scrapedAt: "desc" },
    select: { scrapedAt: true },
  });

  if (!latestSnapshot) {
    // First scrape — all slots are "new"
    return newSlots.filter((s) => s.available);
  }

  // Get all available slots from the latest scrape batch
  const previousSlots = await prisma.slotSnapshot.findMany({
    where: {
      courtId,
      scrapedAt: latestSnapshot.scrapedAt,
      available: true,
    },
    select: { date: true, startTime: true, courtLabel: true },
  });

  const previousKeys = new Set(
    previousSlots.map((s) => `${s.date}|${s.startTime}|${s.courtLabel ?? ""}`)
  );

  return newSlots.filter(
    (s) =>
      s.available &&
      !previousKeys.has(`${s.date}|${s.startTime}|${s.courtLabel ?? ""}`)
  );
}

/**
 * Store a batch of scraped slots as a new snapshot.
 */
export async function storeSnapshot(
  courtId: string,
  slots: ScrapedSlot[]
): Promise<void> {
  const now = new Date();
  const data = slots.map((s) => ({
    courtId,
    scrapedAt: now,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    available: s.available,
    courtLabel: s.courtLabel ?? null,
    totalCourts: s.totalCourts ?? null,
    rawData: s.rawData ?? null,
  }));

  await prisma.slotSnapshot.createMany({ data });
}
