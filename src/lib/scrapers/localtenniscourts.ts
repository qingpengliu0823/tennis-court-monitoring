import { chromium, type Browser } from "playwright";
import type { CourtAdapter, ScrapedSlot, ScrapeResult } from "./types";

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({ headless: true });
  }
  return browserInstance;
}

interface VenueSpace {
  venue_id: number;
  name: string;
  total_spaces: number;
  scraped_at: string;
  freshness: string;
  booking_url: string;
}

interface DayData {
  day: string;
  total_spaces: number;
  spaces: VenueSpace[];
}

interface RowData {
  hour: number;
  fromTime: string;
  [key: string]: unknown;
}

interface TableData {
  columns: unknown[];
  rows: RowData[];
}

/**
 * Extract availability data from the localtenniscourts.com SSR-embedded JSON.
 * The page uses TanStack Router hydration — data is in script tags as serialized JSON.
 */
const localTennisCourtsAdapter: CourtAdapter = {
  name: "localtenniscourts",

  async scrape(courtId: string, bookingUrl: string, metadata?: Record<string, unknown>): Promise<ScrapeResult> {
    const start = Date.now();
    const targetVenueId = metadata?.venueId as number | undefined;
    const slots: ScrapedSlot[] = [];

    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      await page.goto(bookingUrl, { waitUntil: "networkidle", timeout: 30000 });

      // Extract the embedded availability data from the page
      const data = await page.evaluate(() => {
        // Look for script tags containing tableData
        const scripts = document.querySelectorAll("script");
        for (const script of scripts) {
          const text = script.textContent || "";
          if (text.includes("tableData") && text.includes("rows")) {
            // Try to extract the JSON data from TanStack hydration format
            // The data is serialized in a complex format, so we parse it carefully
            const tableMatch = text.match(/"tableData"\s*:\s*(\{[\s\S]*?"rows"\s*:\s*\[[\s\S]*?\]\s*\})/);
            if (tableMatch) {
              try {
                return JSON.parse(tableMatch[1]);
              } catch {
                // Continue to next approach
              }
            }
          }
        }

        // Fallback: try to get data from the DOM structure
        return null;
      });

      if (!data?.rows) {
        // Fallback: scrape the DOM directly for availability info
        const domSlots = await page.evaluate((venueId: number | undefined) => {
          const results: Array<{
            date: string;
            startTime: string;
            endTime: string;
            available: boolean;
            courtLabel: string;
            totalCourts: number;
            venueName: string;
            bookingUrl: string;
          }> = [];

          // Look for availability table rows
          const rows = document.querySelectorAll("tr, [data-row], [class*='row']");
          rows.forEach((row) => {
            const text = row.textContent || "";
            // Parse if it contains time-like patterns
            if (/\d{2}:\d{2}/.test(text)) {
              // Extract what we can from the row
              const timeMatch = text.match(/(\d{2}:\d{2})/);
              if (timeMatch) {
                results.push({
                  date: "",
                  startTime: timeMatch[1],
                  endTime: "",
                  available: true,
                  courtLabel: "",
                  totalCourts: 0,
                  venueName: "",
                  bookingUrl: "",
                });
              }
            }
          });

          return results;
        }, targetVenueId);

        if (domSlots.length > 0) {
          slots.push(
            ...domSlots.map((s) => ({
              date: s.date,
              startTime: s.startTime,
              endTime: s.endTime,
              available: s.available,
              courtLabel: s.courtLabel || undefined,
              totalCourts: s.totalCourts || undefined,
            }))
          );
        }
      } else {
        // Parse the structured JSON data
        const tableData = data as TableData;
        for (const row of tableData.rows) {
          const fromTime = row.fromTime;
          const hour = row.hour;
          const endTime = `${String(hour + 1).padStart(2, "0")}:00`;

          // Iterate over day columns (keys like "day2003", "day2103", etc.)
          for (const [key, value] of Object.entries(row)) {
            if (!key.startsWith("day") || typeof value !== "object" || !value) continue;

            const dayData = value as DayData;
            if (!dayData.spaces || !dayData.day) continue;

            // Parse "20 Mar" format to YYYY-MM-DD
            const date = parseDayString(dayData.day);
            if (!date) continue;

            // If targeting a specific venue, filter
            const venues = targetVenueId
              ? dayData.spaces.filter((s) => s.venue_id === targetVenueId)
              : dayData.spaces;

            for (const venue of venues) {
              if (venue.total_spaces > 0) {
                slots.push({
                  date,
                  startTime: fromTime,
                  endTime,
                  available: true,
                  courtLabel: venue.name,
                  totalCourts: venue.total_spaces,
                  rawData: {
                    venueId: venue.venue_id,
                    freshness: venue.freshness,
                    bookingUrl: venue.booking_url,
                    scrapedAt: venue.scraped_at,
                  },
                });
              }
            }
          }
        }
      }

      return {
        slots,
        adapter: "localtenniscourts",
        durationMs: Date.now() - start,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        slots: [],
        adapter: "localtenniscourts",
        durationMs: Date.now() - start,
        error: message,
      };
    } finally {
      await page.close();
    }
  },
};

function parseDayString(dayStr: string): string | null {
  // Parse "20 Mar" or "20 March" to YYYY-MM-DD
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };

  const match = dayStr.match(/(\d{1,2})\s+(\w{3})/);
  if (!match) return null;

  const day = match[1].padStart(2, "0");
  const monthStr = match[2];
  const month = months[monthStr];
  if (!month) return null;

  const year = new Date().getFullYear();
  return `${year}-${month}-${day}`;
}

export { localTennisCourtsAdapter };
