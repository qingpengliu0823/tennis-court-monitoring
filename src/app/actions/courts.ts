"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getCourts() {
  return prisma.court.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { snapshots: true, monitors: true } },
    },
  });
}

export async function getCourt(slug: string) {
  return prisma.court.findUnique({
    where: { slug },
    include: {
      monitors: { orderBy: { createdAt: "desc" } },
      _count: { select: { snapshots: true } },
    },
  });
}

export async function getCourtSnapshots(courtId: string, limit = 500) {
  const latestScrape = await prisma.slotSnapshot.findFirst({
    where: { courtId },
    orderBy: { scrapedAt: "desc" },
    select: { scrapedAt: true },
  });

  if (!latestScrape) return [];

  return prisma.slotSnapshot.findMany({
    where: { courtId, scrapedAt: latestScrape.scrapedAt, available: true },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: limit,
  });
}

export async function toggleCourt(id: string, enabled: boolean) {
  await prisma.court.update({ where: { id }, data: { enabled } });
  revalidatePath("/courts");
}
