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
 * Scrape Microsoft Bookings (Outlook SPA) for Garden Halls Tennis.
 * This is a JS-heavy SPA that requires full browser rendering.
 */
const microsoftBookingsAdapter: CourtAdapter = {
  name: "microsoft_bookings",

  async scrape(courtId: string, bookingUrl: string): Promise<ScrapeResult> {
    const start = Date.now();
    const slots: ScrapedSlot[] = [];

    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      // Set realistic user agent
      await page.setExtraHTTPHeaders({
        "Accept-Language": "en-GB,en;q=0.9",
      });

      // Try to intercept API calls for lighter data extraction
      const apiResponses: unknown[] = [];
      page.on("response", async (response) => {
        const url = response.url();
        if (
          url.includes("bookingBusinesses") ||
          url.includes("getStaffAvailability") ||
          url.includes("bookingServices")
        ) {
          try {
            const json = await response.json();
            apiResponses.push(json);
          } catch {
            // Not JSON, skip
          }
        }
      });

      await page.goto(bookingUrl, { waitUntil: "networkidle", timeout: 45000 });

      // Wait for the booking calendar to render
      await page.waitForTimeout(3000);

      // Try to extract from intercepted API responses first
      if (apiResponses.length > 0) {
        // Parse API responses for availability
        for (const apiData of apiResponses) {
          const parsed = parseApiResponse(apiData);
          slots.push(...parsed);
        }
      }

      if (slots.length === 0) {
        // Fallback: scrape the DOM
        const domSlots = await page.evaluate(() => {
          const results: Array<{
            date: string;
            time: string;
            label: string;
          }> = [];

          // Microsoft Bookings renders time slots as clickable elements
          const slotElements = document.querySelectorAll(
            '[role="button"][aria-label*=":"], [class*="timeSlot"], [class*="slot"], [data-automation-id*="slot"]'
          );

          slotElements.forEach((el) => {
            const label = el.getAttribute("aria-label") || el.textContent || "";
            const timeMatch = label.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
            if (timeMatch) {
              results.push({
                date: "",
                time: timeMatch[1],
                label: label.trim(),
              });
            }
          });

          return results;
        });

        // Try to get the currently selected date
        const currentDate = await page.evaluate(() => {
          const dateEl = document.querySelector(
            '[aria-label*="selected"], [class*="selectedDate"], [class*="currentDate"]'
          );
          return dateEl?.textContent?.trim() || "";
        });

        const parsedDate = parseBookingDate(currentDate);

        for (const ds of domSlots) {
          const time = parseTime(ds.time);
          if (time) {
            const endHour = parseInt(time.split(":")[0]) + 1;
            slots.push({
              date: ds.date || parsedDate || new Date().toISOString().split("T")[0],
              startTime: time,
              endTime: `${String(endHour).padStart(2, "0")}:${time.split(":")[1]}`,
              available: true,
              courtLabel: ds.label || undefined,
            });
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

function parseApiResponse(data: unknown): ScrapedSlot[] {
  const slots: ScrapedSlot[] = [];
  if (!data || typeof data !== "object") return slots;

  // Microsoft Graph API availability response format
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.value)) {
    for (const item of obj.value) {
      const i = item as Record<string, unknown>;
      if (i.startDateTime && i.endDateTime) {
        const start = new Date(i.startDateTime as string);
        const end = new Date(i.endDateTime as string);
        slots.push({
          date: start.toISOString().split("T")[0],
          startTime: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
          endTime: `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`,
          available: true,
        });
      }
    }
  }

  return slots;
}

function parseTime(timeStr: string): string | null {
  // Convert "9:00 AM" or "14:00" to "HH:MM"
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;

  let hours = parseInt(match[1]);
  const minutes = match[2];
  const ampm = match[3]?.toUpperCase();

  if (ampm === "PM" && hours < 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;

  return `${String(hours).padStart(2, "0")}:${minutes}`;
}

function parseBookingDate(dateStr: string): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  } catch {
    // Ignore
  }
  return null;
}

export { microsoftBookingsAdapter };
