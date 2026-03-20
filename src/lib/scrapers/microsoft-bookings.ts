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
 * Scrape Microsoft Bookings for Garden Halls Tennis.
 *
 * Page structure (as of March 2026):
 * - Service types: <label> elements with radio inputs
 * - Calendar: parent <div aria-label="Monday, March 23, 2026. Available times">
 *   containing child <div> with the day number
 * - Time slots: <li> > <label> > <span class="WpLer">9:00</span>
 *
 * After selecting a service, the page auto-jumps to the first available date
 * and shows its time slots.
 */
const microsoftBookingsAdapter: CourtAdapter = {
  name: "microsoft_bookings",

  async scrape(courtId: string, bookingUrl: string, metadata?: Record<string, unknown>): Promise<ScrapeResult> {
    const start = Date.now();
    const serviceType = (metadata?.serviceType as string) || null;
    const slots: ScrapedSlot[] = [];

    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      await page.setExtraHTTPHeaders({ "Accept-Language": "en-GB,en;q=0.9" });
      await page.goto(bookingUrl, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(2000);

      // Step 1: Select service type by clicking the label
      if (serviceType) {
        const label = page.locator("label").filter({ hasText: serviceType });
        if (await label.count() > 0) {
          await label.first().click();
        }
      } else {
        await page.locator("label").first().click();
      }
      await page.waitForTimeout(2000);

      // Step 2: Find all dates with availability in the current month view
      // Date cells are parent divs with aria-label like "Monday, March 23, 2026. Available times"
      const availableDates = await page.evaluate(() => {
        const dateCells = document.querySelectorAll("div[aria-label*='202']");
        return Array.from(dateCells)
          .filter((el) => {
            const label = el.getAttribute("aria-label") || "";
            return label.includes("Available") || label.includes("selected");
          })
          .map((el) => el.getAttribute("aria-label") || "");
      });

      // Step 3: For each available date, click it and extract time slots
      for (const dateLabel of availableDates) {
        const date = parseMsDateLabel(dateLabel);
        if (!date) continue;

        // Click the date cell
        const dateCell = page.locator(`div[aria-label="${dateLabel}"]`);
        if (await dateCell.count() === 0) continue;
        await dateCell.first().click();
        await page.waitForTimeout(1500);

        // Extract time slots — they're <span> elements inside <label> inside <li>
        const times = await page.evaluate(() => {
          const labels = document.querySelectorAll("li label");
          return Array.from(labels)
            .map((el) => el.textContent?.trim() || "")
            .filter((t) => /\d{1,2}:\d{2}/.test(t));
        });

        for (const timeStr of times) {
          const startTime = parseTime(timeStr);
          if (!startTime) continue;
          const hour = parseInt(startTime.split(":")[0]);
          const endTime = `${String(hour + 1).padStart(2, "0")}:${startTime.split(":")[1]}`;

          slots.push({
            date,
            startTime,
            endTime,
            available: true,
            courtLabel: serviceType || undefined,
          });
        }
      }

      // If auto-jump already showed slots but we didn't find date cells
      // (e.g. only one date available), extract from current view
      if (slots.length === 0) {
        const fallback = await page.evaluate(() => {
          // Get the displayed date from page text
          const bodyText = document.body.innerText;
          const dateMatch = bodyText.match(/March\s+(\d{1,2})/);

          // Get time slots
          const labels = document.querySelectorAll("li label");
          const times = Array.from(labels)
            .map((el) => el.textContent?.trim() || "")
            .filter((t) => /\d{1,2}:\d{2}/.test(t));

          return { dateText: dateMatch ? dateMatch[0] : null, times };
        });

        if (fallback.dateText && fallback.times.length > 0) {
          const date = parseFallbackDate(fallback.dateText);
          if (date) {
            for (const timeStr of fallback.times) {
              const startTime = parseTime(timeStr);
              if (!startTime) continue;
              const hour = parseInt(startTime.split(":")[0]);
              const endTime = `${String(hour + 1).padStart(2, "0")}:${startTime.split(":")[1]}`;
              slots.push({ date, startTime, endTime, available: true, courtLabel: serviceType || undefined });
            }
          }
        }
      }

      return {
        slots,
        adapter: "microsoft_bookings",
        durationMs: Date.now() - start,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        slots: [],
        adapter: "microsoft_bookings",
        durationMs: Date.now() - start,
        error: message,
      };
    } finally {
      await page.close();
    }
  },
};

/** Parse "Monday, March 23, 2026. Available times" -> "2026-03-23" */
function parseMsDateLabel(label: string): string | null {
  const match = label.match(/(\w+)\s+(\d{1,2}),\s+(\d{4})/);
  if (!match) return null;

  const months: Record<string, string> = {
    January: "01", February: "02", March: "03", April: "04", May: "05", June: "06",
    July: "07", August: "08", September: "09", October: "10", November: "11", December: "12",
  };

  const month = months[match[1]];
  if (!month) return null;
  return `${match[3]}-${month}-${match[2].padStart(2, "0")}`;
}

/** Parse "March 23" -> "YYYY-MM-23" using current year */
function parseFallbackDate(text: string): string | null {
  const months: Record<string, string> = {
    January: "01", February: "02", March: "03", April: "04", May: "05", June: "06",
    July: "07", August: "08", September: "09", October: "10", November: "11", December: "12",
  };
  const match = text.match(/(\w+)\s+(\d{1,2})/);
  if (!match) return null;
  const month = months[match[1]];
  if (!month) return null;
  return `${new Date().getFullYear()}-${month}-${match[2].padStart(2, "0")}`;
}

function parseTime(timeStr: string): string | null {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;

  let hours = parseInt(match[1]);
  const minutes = match[2];
  const ampm = match[3]?.toUpperCase();

  if (ampm === "PM" && hours < 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;

  return `${String(hours).padStart(2, "0")}:${minutes}`;
}

export { microsoftBookingsAdapter };
