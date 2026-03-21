import type { CourtAdapter, ScrapedSlot, ScrapeResult } from "./types";

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface VenueSessionsResponse {
  TimeZone: string;
  EarliestStartTime: number;
  LatestEndTime: number;
  MinimumInterval: number;
  Resources: Array<{
    ID: string;
    Name: string;
    Lighting: number;
    Surface: number;
    Days: Array<{
      Date: string; // "2026-03-21T00:00:00"
      Sessions: Array<{
        Category: number; // 0 = available, 1000 = booked
        Name: string;
        StartTime: number; // minutes from midnight
        EndTime: number;
        Interval: number;
        Capacity?: number;
        Cost?: number;
        MemberPrice?: number;
        CourtCost?: number;
        LightingCost?: number;
      }>;
    }>;
  }>;
}

/**
 * ClubSpark/LTA adapter using the internal JSON API.
 *
 * API endpoint (verified 2026-03-21):
 *   GET /v0/VenueBooking/{venue}/GetVenueSessions
 *       ?resourceID=&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&roleId=
 *
 *   Returns structured JSON: Resources[] > Days[] > Sessions[]
 *   - Category 0 sessions = available for booking (includes Cost, MemberPrice)
 *   - Category 1000 sessions = already booked
 *   - No session at a time slot = court closed
 *
 *   Supports multi-day range in a single request (7 days in one call).
 *   No authentication required for public courts.
 *
 * metadata.venue: ClubSpark venue slug (e.g. "FinsburyPark")
 */
const clubsparkAdapter: CourtAdapter = {
  name: "clubspark",

  async scrape(courtId: string, bookingUrl: string, metadata?: Record<string, unknown>): Promise<ScrapeResult> {
    const start = Date.now();

    try {
      // Extract venue slug from metadata or bookingUrl
      const venue =
        (metadata?.venue as string) ||
        bookingUrl.match(/clubspark\.lta\.org\.uk\/([^/]+)\//)?.[1];

      if (!venue) {
        return {
          slots: [],
          adapter: "clubspark",
          durationMs: Date.now() - start,
          error: "Could not determine venue slug from metadata or bookingUrl",
        };
      }

      // Build 7-day date range
      const startDate = new Date().toISOString().split("T")[0];
      const endDate = new Date(Date.now() + 6 * 86400000).toISOString().split("T")[0];

      const url =
        `https://clubspark.lta.org.uk/v0/VenueBooking/${venue}/GetVenueSessions` +
        `?resourceID=&startDate=${startDate}&endDate=${endDate}&roleId=`;

      const resp = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });

      if (!resp.ok) {
        return {
          slots: [],
          adapter: "clubspark",
          durationMs: Date.now() - start,
          error: `API returned ${resp.status} ${resp.statusText}`,
        };
      }

      const data: VenueSessionsResponse = await resp.json();
      const slots: ScrapedSlot[] = [];

      for (const resource of data.Resources) {
        for (const day of resource.Days) {
          const date = day.Date.split("T")[0];

          for (const session of day.Sessions) {
            // Only map known categories
            if (session.Category !== 0 && session.Category !== 1000) continue;

            slots.push({
              date,
              startTime: minutesToTime(session.StartTime),
              endTime: minutesToTime(session.EndTime),
              available: session.Category === 0,
              courtLabel: resource.Name,
              rawData: {
                ...(session.Cost != null && session.Cost > 0 && { price: `£${session.Cost}` }),
                ...(session.MemberPrice != null && session.MemberPrice > 0 && { memberPrice: `£${session.MemberPrice}` }),
              },
            });
          }
        }
      }

      return {
        slots,
        adapter: "clubspark",
        durationMs: Date.now() - start,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        slots: [],
        adapter: "clubspark",
        durationMs: Date.now() - start,
        error: message,
      };
    }
  },
};

export { clubsparkAdapter };
