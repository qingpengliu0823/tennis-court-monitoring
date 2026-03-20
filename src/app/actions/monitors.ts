"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getMonitors() {
  return prisma.monitor.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      court: { select: { name: true, slug: true } },
      _count: { select: { alerts: true } },
    },
  });
}

export async function createMonitor(data: {
  name: string;
  courtId: string;
  serviceType?: string;
  daysOfWeek: number[];
  timeFrom?: string;
  timeTo?: string;
  dateFrom?: string;
  dateTo?: string;
  checkIntervalMin?: number;
  cooldownMin?: number;
}) {
  await prisma.monitor.create({
    data: {
      name: data.name,
      courtId: data.courtId,
      serviceType: data.serviceType || null,
      daysOfWeek: data.daysOfWeek,
      timeFrom: data.timeFrom || null,
      timeTo: data.timeTo || null,
      dateFrom: data.dateFrom || null,
      dateTo: data.dateTo || null,
      checkIntervalMin: data.checkIntervalMin || 30,
      cooldownMin: data.cooldownMin || 60,
    },
  });
  revalidatePath("/monitors");
}

export async function getMonitor(id: string) {
  return prisma.monitor.findUnique({
    where: { id },
    include: { court: { select: { id: true, name: true, slug: true, metadata: true } } },
  });
}

export async function updateMonitor(
  id: string,
  data: {
    name: string;
    courtId: string;
    serviceType?: string;
    daysOfWeek: number[];
    timeFrom?: string;
    timeTo?: string;
    dateFrom?: string;
    dateTo?: string;
    checkIntervalMin?: number;
    cooldownMin?: number;
  }
) {
  await prisma.monitor.update({
    where: { id },
    data: {
      name: data.name,
      courtId: data.courtId,
      serviceType: data.serviceType || null,
      daysOfWeek: data.daysOfWeek,
      timeFrom: data.timeFrom || null,
      timeTo: data.timeTo || null,
      dateFrom: data.dateFrom || null,
      dateTo: data.dateTo || null,
      checkIntervalMin: data.checkIntervalMin || 30,
      cooldownMin: data.cooldownMin || 60,
    },
  });
  revalidatePath("/monitors");
}

export async function toggleMonitor(id: string, enabled: boolean) {
  await prisma.monitor.update({ where: { id }, data: { enabled } });
  revalidatePath("/monitors");
}

export async function deleteMonitor(id: string) {
  await prisma.monitor.delete({ where: { id } });
  revalidatePath("/monitors");
}
