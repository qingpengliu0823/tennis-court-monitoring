import { chromium, type Browser } from "playwright";
import type { CourtAdapter, ScrapedSlot, ScrapeResult } from "./types";

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({ headless: true });
  }
  return browserInstance;
}

/**
 * Scrape Flow.onl booking pages (Royal Parks) for tennis court availability.
 *
 * Page structure (verified 2026-03-20):
 *   URL pattern: /location/{venue}/tennis/{YYYY-MM-DD}/by-time
 *   React SPA — needs Playwright for JS rendering.
 *
 *   Slot elements appear as flat siblings inside <main>:
 *     - Time: text like "07:00 - 08:00"
 *     - Duration: "60min"
 *     - Activity: "Tennis-60min"
 *     - Court: "Multiple" or "Tennis Court 5" or "Muga Court 1"
 *     - Availability: "1 space available" / "6 spaces available" / "Fully booked"
 *     - Bookable slots have <a> with href containing "/slot/HH:MM-HH:MM/"
 *
 *   Date nav: links like /location/{venue}/tennis/{YYYY-MM-DD}/by-time
 *
 * Venues (Royal Parks):
 *   hyde-park-courts, the-regents-park-courts, greenwich-park-courts
 */
const flowOnlAdapter: CourtAdapter = {
  name: "flow_onl",

  async scrape(courtId: string, bookingUrl: string, metadata?: Record<string, unknown>): Promise<ScrapeResult> {
    const start = Date.now();

    // Extract venue slug from bookingUrl: .../location/{venue}/...
    const venueMatch = bookingUrl.match(/location\/([^/]+)/);
    const venue = (metadata?.venue as string) || venueMatch?.[1] || "";
    if (!venue) {
      return { slots: [], adapter: "flow_onl", durationMs: Date.now() - start, error: "No venue found in URL" };
    }

    const browser = await getBrowser();
    const page = await browser.newPage();
    const slots: ScrapedSlot[] = [];

    try {
      // Scan 7 days forward
      const dates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(Date.now() + i * 86400000);
        dates.push(d.toISOString().split("T")[0]);
      }

      for (const date of dates) {
        const url = `https://sportsandleisureroyalparks.bookings.flow.onl/location/${venue}/tennis/${date}/by-time`;
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(2000);

        // Dismiss cookie consent if present
        const allowAll = page.locator('button:has-text("Allow All")');
        if (await allowAll.isVisible({ timeout: 1000 }).catch(() => false)) {
          await allowAll.click();
          await page.waitForTimeout(500);
        }

        const daySlots = await page.evaluate(() => {
          const results: Array<{
            startTime: string;
            endTime: string;
            spaces: number;
            court: string;
            available: boolean;
          }> = [];

          // Get the full text content of main and parse slot blocks
          const main = document.querySelector("main");
          if (!main) return results;

          // Find all elements that look like time slots (HH:MM - HH:MM pattern)
          const allElements = main.querySelectorAll("*");
          const timeElements: Element[] = [];

          allElements.forEach((el) => {
            const text = el.textContent?.trim() || "";
            // Match "HH:MM - HH:MM" but only leaf-ish elements (no deep nesting)
            if (/^\d{2}:\d{2} - \d{2}:\d{2}$/.test(text) && el.children.length === 0) {
              timeElements.push(el);
            }
          });

          for (const timeEl of timeElements) {
            const timeText = timeEl.textContent?.trim() || "";
            const timeMatch = timeText.match(/(\d{2}:\d{2}) - (\d{2}:\d{2})/);
            if (!timeMatch) continue;

            // Walk up to the slot card container and read sibling info
            // The slot card is typically 4-5 levels up from the time text
            let container: Element | null = timeEl;
            for (let i = 0; i < 8; i++) {
              container = container.parentElement;
              if (!container) break;
              const text = container.textContent || "";
              // A slot card contains: time + "min" + availability info
              if (text.includes("60min") && (text.includes("available") || text.includes("Fully booked"))) {
                break;
              }
            }

            if (!container) continue;
            const cardText = container.textContent?.replace(/\s+/g, " ") || "";

            // Extract availability
            const spacesMatch = cardText.match(/(\d+) spaces? available/);
            const fullyBooked = cardText.includes("Fully booked");
            const spaces = spacesMatch ? parseInt(spacesMatch[1]) : 0;

            // Extract court label — look for "Tennis Court N", "Muga Court N", or "Multiple"
            let court = "Multiple";
            const courtMatch = cardText.match(/(Tennis Court \d+|Muga Court \d+)/);
            if (courtMatch) {
              court = courtMatch[1];
            }

            results.push({
              startTime: timeMatch[1],
              endTime: timeMatch[2],
              spaces,
              court,
              available: !fullyBooked && spaces > 0,
            });
          }

          return results;
        });

        for (const s of daySlots) {
          slots.push({
            date,
            startTime: s.startTime,
            endTime: s.endTime,
            available: s.available,
            courtLabel: s.court,
            totalCourts: s.spaces,
          });
        }
      }

      return {
        slots,
        adapter: "flow_onl",
        durationMs: Date.now() - start,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        slots: [],
        adapter: "flow_onl",
        durationMs: Date.now() - start,
        error: message,
      };
    } finally {
      await page.close();
    }
  },
};

export { flowOnlAdapter };
