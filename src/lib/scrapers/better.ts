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
 * Scrape Better (GLL) booking pages for tennis court availability.
 *
 * Page structure (verified 2026-03-20):
 *   URL pattern: /location/{venue}/{activity}/{date}/by-time
 *   React SPA — needs Playwright for JS rendering.
 *
 *   Slot cards: walk up from <a href="...\/slot\/HH:MM-HH:MM\/..."> to find
 *   parent container with full text:
 *     "07:00 - 08:00 60min Tennis Court (Floodlit) Multiple £14.85 3 spaces available Book"
 *
 *   Date nav: <a href=".../{date}/by-time"> with text like "Sat21"
 *
 * metadata.activity: e.g. "tennis-court-outdoor" (required)
 * metadata.venue: e.g. "islington-tennis-centre" (extracted from bookingUrl if not set)
 */
const betterAdapter: CourtAdapter = {
  name: "better",

  async scrape(courtId: string, bookingUrl: string, metadata?: Record<string, unknown>): Promise<ScrapeResult> {
    const start = Date.now();
    const activity = (metadata?.activity as string) || "tennis-court-outdoor";

    // Extract venue slug from bookingUrl: .../location/{venue}/...
    const venueMatch = bookingUrl.match(/location\/([^/]+)/);
    const venue = (metadata?.venue as string) || venueMatch?.[1] || "";
    if (!venue) {
      return { slots: [], adapter: "better", durationMs: Date.now() - start, error: "No venue found in URL" };
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
        const url = `https://bookings.better.org.uk/location/${venue}/${activity}/${date}/by-time`;
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(2000);

        const daySlots = await page.evaluate((currentDate: string) => {
          const results: Array<{
            startTime: string;
            endTime: string;
            spaces: number;
            court: string;
            price: string;
          }> = [];

          const slotLinks = document.querySelectorAll('a[href*="/slot/"]');
          slotLinks.forEach((a) => {
            const href = a.getAttribute("href") || "";
            const timeMatch = href.match(/slot\/(\d{2}:\d{2})-(\d{2}:\d{2})/);
            if (!timeMatch) return;

            // Walk up to find the card container with full text
            let container: HTMLElement | null = a as HTMLElement;
            for (let i = 0; i < 10; i++) {
              container = container.parentElement;
              if (!container) break;
              const text = container.textContent || "";
              if (text.includes(":00 -") && text.includes("min")) break;
            }

            // Use innerText (respects CSS layout, adds whitespace between elements)
            const text = container?.innerText?.replace(/\s+/g, " ") || "";
            const spacesMatch = text.match(/(\d+) spaces? available/);
            const priceMatch = text.match(/£([\d.]+)/);
            const courtMatch = text.match(/Tennis Court \(([^)]+)\)/);

            results.push({
              startTime: timeMatch[1],
              endTime: timeMatch[2],
              spaces: spacesMatch ? parseInt(spacesMatch[1]) : 0,
              court: courtMatch ? courtMatch[1] : "Tennis Court",
              price: priceMatch ? `£${priceMatch[1]}` : "",
            });
          });

          return results;
        }, date);

        for (const s of daySlots) {
          slots.push({
            date,
            startTime: s.startTime,
            endTime: s.endTime,
            available: s.spaces > 0,
            courtLabel: s.court,
            totalCourts: s.spaces,
            rawData: { price: s.price },
          });
        }
      }

      return {
        slots,
        adapter: "better",
        durationMs: Date.now() - start,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        slots: [],
        adapter: "better",
        durationMs: Date.now() - start,
        error: message,
      };
    } finally {
      await page.close();
    }
  },
};

export { betterAdapter };
