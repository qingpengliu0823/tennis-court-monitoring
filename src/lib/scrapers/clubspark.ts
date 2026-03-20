import { chromium, type Browser } from "playwright";
import type { CourtAdapter, ScrapedSlot, ScrapeResult } from "./types";

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({ headless: true });
  }
  return browserInstance;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Evaluate script run inside the browser context (string to avoid tsx __name issues)
const EXTRACT_SLOTS_SCRIPT = `
(function() {
  var results = [];
  var sessions = document.querySelectorAll(".resource-session");
  for (var i = 0; i < sessions.length; i++) {
    var s = sessions[i];
    var available = s.getAttribute("data-availability") === "true";
    var startMin = parseInt(s.getAttribute("data-start-time") || "0");
    var endMin = parseInt(s.getAttribute("data-end-time") || "0");
    var cost = s.getAttribute("data-session-cost");
    var memberCost = s.getAttribute("data-session-member-cost");

    var resource = s.closest(".resource");
    var courtName = resource ? resource.getAttribute("data-resource-name") || "Unknown" : "Unknown";
    var infoEl = resource ? resource.querySelector(".resource-info") : null;
    var courtInfo = infoEl ? infoEl.getAttribute("title") : null;

    function pad(n) { return n < 10 ? "0" + n : "" + n; }
    results.push({
      courtLabel: courtName,
      startTime: pad(Math.floor(startMin / 60)) + ":" + pad(startMin % 60),
      endTime: pad(Math.floor(endMin / 60)) + ":" + pad(endMin % 60),
      available: available,
      cost: cost,
      memberCost: memberCost,
      courtInfo: courtInfo
    });
  }
  return results;
})()
`;

/**
 * Scrape ClubSpark/LTA booking pages for tennis court availability.
 *
 * Page structure (verified 2026-03-20):
 *   URL pattern: {venue}/Booking/BookByDate#?date=YYYY-MM-DD&role=guest
 *   Client-rendered — JS reads hash fragment to load the booking grid via AJAX.
 *
 *   Booking grid: .carousel > ul > li > .resource-wrap > .resource
 *     .resource has data-resource-name="Court 1", data-resource-id
 *     .resource-info[title] = "Court 1 - Full, Outdoor, Incandescent Lighting, Hard"
 *
 *   Time slots: .resource-session inside each .resource
 *     data-availability="true"/"false"
 *     data-start-time, data-end-time (minutes from midnight, e.g. 420 = 07:00)
 *     data-session-cost (price in £, e.g. "7")
 *     data-session-member-cost (member price)
 *     data-capacity (number of bookable slots)
 *     data-resource-interval (slot duration in minutes)
 *
 * metadata.venue: ClubSpark venue slug (extracted from bookingUrl if not set)
 * metadata.deepLink: URL for users to book (defaults to bookingUrl)
 */
const clubsparkAdapter: CourtAdapter = {
  name: "clubspark",

  async scrape(courtId: string, bookingUrl: string, metadata?: Record<string, unknown>): Promise<ScrapeResult> {
    const start = Date.now();
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
        // ClubSpark uses hash fragment for date navigation
        const url = `${bookingUrl}#?date=${date}&role=guest`;
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(2000);

        // Wait for booking grid to render
        await page.waitForSelector(".resource-session", { timeout: 10000 }).catch(() => null);

        const daySlots = await page.evaluate(EXTRACT_SLOTS_SCRIPT) as Array<{
          courtLabel: string;
          startTime: string;
          endTime: string;
          available: boolean;
          cost: string | null;
          memberCost: string | null;
          courtInfo: string | null;
        }>;

        for (const s of daySlots) {
          slots.push({
            date,
            startTime: s.startTime,
            endTime: s.endTime,
            available: s.available,
            courtLabel: s.courtLabel,
            rawData: {
              ...(s.cost != null && { price: `£${s.cost}` }),
              ...(s.memberCost != null && { memberPrice: `£${s.memberCost}` }),
              ...(s.courtInfo && { courtInfo: s.courtInfo }),
            },
          });
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
    } finally {
      await page.close();
    }
  },
};

export { clubsparkAdapter };
