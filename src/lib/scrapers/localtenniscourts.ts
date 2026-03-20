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
 * Scrape localtenniscourts.com availability grid.
 *
 * Page structure (as of March 2026):
 *   - First <table>: header row only (Time, Fri 20, Sat 21, ...)
 *   - Second <table>: <tbody> with 17 rows (06:00–22:00), 9 cells each
 *     Cell 0 = time (HH:MM), cells 1–8 = day columns
 *     Each day cell contains <span class="font-semibold">N</span> (court count) or "-"
 */
const localTennisCourtsAdapter: CourtAdapter = {
  name: "localtenniscourts",

  async scrape(courtId: string, bookingUrl: string): Promise<ScrapeResult> {
    const start = Date.now();
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      await page.goto(bookingUrl, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(1500);

      const extracted = await page.evaluate(() => {
        const tables = document.querySelectorAll("table");
        if (tables.length < 2) return { error: "Expected 2 tables, found " + tables.length, headers: [], rows: [] };

        // Headers from first table
        const headerCells = tables[0].querySelectorAll("th");
        const headers = Array.from(headerCells).map((th) => th.textContent?.trim() || "");

        // Data rows from second table's tbody
        const tbody = tables[1].querySelector("tbody");
        if (!tbody) return { error: "No tbody in second table", headers, rows: [] };

        const trs = tbody.querySelectorAll("tr");
        const rows: Array<{ time: string; cells: Array<{ count: number; text: string }> }> = [];

        trs.forEach((tr) => {
          const tds = tr.querySelectorAll("td");
          if (tds.length === 0) return;

          const time = tds[0].textContent?.trim() || "";
          const cells: Array<{ count: number; text: string }> = [];

          for (let i = 1; i < tds.length; i++) {
            const semibold = tds[i].querySelector(".font-semibold");
            const text = semibold?.textContent?.trim() || tds[i].textContent?.trim() || "";
            let count = 0;
            if (text !== "-" && text !== "") {
              // Handle "25+" as 25
              count = parseInt(text.replace("+", ""), 10) || 0;
            }
            cells.push({ count, text });
          }

          rows.push({ time, cells });
        });

        return { error: null, headers, rows };
      });

      if (extracted.error) {
        return {
          slots: [],
          adapter: "localtenniscourts",
          durationMs: Date.now() - start,
          error: extracted.error,
        };
      }

      // Parse headers to dates: "Fri 20" -> YYYY-MM-DD
      // Headers[0] = "Time", Headers[1..] = "Day DD"
      const dateHeaders = extracted.headers.slice(1).map((h) => parseHeaderToDate(h));

      const slots: ScrapedSlot[] = [];
      for (const row of extracted.rows) {
        const startTime = row.time; // "06:00"
        const hour = parseInt(startTime.split(":")[0], 10);
        const endTime = `${String(hour + 1).padStart(2, "0")}:00`;

        row.cells.forEach((cell, i) => {
          const date = dateHeaders[i];
          if (!date) return;

          if (cell.count > 0) {
            slots.push({
              date,
              startTime,
              endTime,
              available: true,
              courtLabel: `${cell.text} courts`,
              totalCourts: cell.count,
            });
          }
        });
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

/**
 * Parse column header like "Fri 20" or "Mon 23" into YYYY-MM-DD.
 * Assumes dates are in the current/next month relative to today.
 */
function parseHeaderToDate(header: string): string | null {
  const match = header.match(/\w+\s+(\d{1,2})/);
  if (!match) return null;

  const dayOfMonth = parseInt(match[1], 10);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  // Try current month first; if the day is far in the past, use next month
  let candidate = new Date(year, month, dayOfMonth);
  const diffDays = (candidate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < -14) {
    candidate = new Date(year, month + 1, dayOfMonth);
  }

  const y = candidate.getFullYear();
  const m = String(candidate.getMonth() + 1).padStart(2, "0");
  const d = String(candidate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export { localTennisCourtsAdapter };
