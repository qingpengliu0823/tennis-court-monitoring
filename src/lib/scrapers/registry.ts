import type { CourtAdapter } from "./types";
import { localTennisCourtsAdapter } from "./localtenniscourts";
import { microsoftBookingsAdapter } from "./microsoft-bookings";

const adapters: Record<string, CourtAdapter> = {
  localtenniscourts: localTennisCourtsAdapter,
  microsoft_bookings: microsoftBookingsAdapter,
};

export function getAdapter(bookingSystem: string): CourtAdapter | null {
  return adapters[bookingSystem] ?? null;
}

export function listAdapters(): string[] {
  return Object.keys(adapters);
}
