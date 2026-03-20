import type { CourtAdapter } from "./types";
import { localTennisCourtsAdapter } from "./localtenniscourts";
import { microsoftBookingsAdapter } from "./microsoft-bookings";
import { betterAdapter } from "./better";
import { clubsparkAdapter } from "./clubspark";
import { camdenActiveAdapter } from "./camden-active";

const adapters: Record<string, CourtAdapter> = {
  localtenniscourts: localTennisCourtsAdapter,
  microsoft_bookings: microsoftBookingsAdapter,
  better: betterAdapter,
  clubspark: clubsparkAdapter,
  camden_active: camdenActiveAdapter,
};

export function getAdapter(bookingSystem: string): CourtAdapter | null {
  return adapters[bookingSystem] ?? null;
}

export function listAdapters(): string[] {
  return Object.keys(adapters);
}
