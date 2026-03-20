import { chromium, type Browser } from "playwright";
import type { CourtAdapter, ScrapedSlot, ScrapeResult } from "./types";

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({ headless: true });
  }
  return browserInstance;
}

// Evaluate script run inside the browser context (string to avoid tsx __name issues)
const EXTRACT_GRID_SCRIPT = `
(function() {
  var results = [];

  // Get the start hour from the first time label in the col
  var firstCol = document.querySelector('.col');
  var startHour = 8; // default
  if (firstCol) {
    var text = firstCol.innerText || '';
    var hourMatch = text.match(/(\\d{2}):\\d{2}/);
    if (hourMatch) startHour = parseInt(hourMatch[1]);
  }

  // Get available slots from booking links (have exact date + time)
  var links = document.querySelectorAll('a.facility-book');
  for (var i = 0; i < links.length; i++) {
    var href = links[i].getAttribute('href') || '';
    var dateMatch = href.match(/fdDate=(\\d{2})\\/(\\d{2})\\/(\\d{4})/);
    var timeMatch = href.match(/fdTime=(\\d+)/);
    if (dateMatch && timeMatch) {
      var day = dateMatch[1];
      var month = dateMatch[2];
      var year = dateMatch[3];
      var hour = parseInt(timeMatch[1]);
      results.push({
        date: year + '-' + month + '-' + day,
        hour: hour,
        available: true,
      });
    }
  }

  // Get all slots (booked + available) from the timetable grid
  var timetableDays = document.querySelectorAll('.timetable-day');
  for (var d = 0; d < timetableDays.length; d++) {
    var lis = timetableDays[d].querySelectorAll('li');
    for (var j = 0; j < lis.length; j++) {
      var top = parseInt(lis[j].style.top) || 0;
      var hour = Math.floor(top / 60) + startHour;
      var isBook = !!lis[j].querySelector('a.facility-book');
      if (!isBook) {
        // This is a booked slot - calculate date from column index
        var dateObj = new Date();
        dateObj.setDate(dateObj.getDate() + d);
        var y = dateObj.getFullYear();
        var m = String(dateObj.getMonth() + 1).padStart(2, '0');
        var dd = String(dateObj.getDate()).padStart(2, '0');
        results.push({
          date: y + '-' + m + '-' + dd,
          hour: hour,
          available: false,
        });
      }
    }
  }

  return results;
})()
`;

/**
 * Scrape Camden Active booking pages for tennis court availability.
 *
 * Page structure (verified 2026-03-20):
 *   Venue page: camdenactive.camden.gov.uk/sports/{venue}/
 *   Court page: camdenactive.camden.gov.uk/courses/detail/{id}/{slug}/
 *
 *   Each court has its own page showing 7 days of availability.
 *   Grid: div.row-timetable > div.col (one col with time labels + all 7 day columns)
 *   Day columns: div.timetable-day > ul > li
 *   Slots: li with style="top:{N*60}px; height:60px;"
 *     - Available: contains <a class="facility-book" href="/courses/book.aspx?fdCourseEventId={id}&fdDate=DD/MM/YYYY&fdTime={hour}">
 *     - Booked: contains <span>Booked</span>
 *   Time: hour = top/60 + startHour (startHour from first time label, usually 8)
 *
 * metadata.courtPages: array of { id, slug } for each court at the venue
 */
const camdenActiveAdapter: CourtAdapter = {
  name: "camden_active",

  async scrape(courtId: string, bookingUrl: string, metadata?: Record<string, unknown>): Promise<ScrapeResult> {
    const start = Date.now();
    const browser = await getBrowser();
    const slots: ScrapedSlot[] = [];

    const courtPages = (metadata?.courtPages as Array<{ id: number; slug: string }>) || [];
    if (courtPages.length === 0) {
      return {
        slots: [],
        adapter: "camden_active",
        durationMs: Date.now() - start,
        error: "No courtPages in metadata",
      };
    }

    try {
      for (const court of courtPages) {
        const page = await browser.newPage();
        try {
          const url = `https://camdenactive.camden.gov.uk/courses/detail/${court.id}/${court.slug}/`;
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
          await page.waitForTimeout(5000);

          // Wait for the timetable to render
          await page.waitForSelector(".timetable-day", { timeout: 10000 }).catch(() => null);

          const rawSlots = await page.evaluate(EXTRACT_GRID_SCRIPT) as Array<{
            date: string;
            hour: number;
            available: boolean;
          }>;

          // Derive court label from slug (e.g. "lincoln-s-inn-fields-tennis-court-1" → "Court 1")
          const courtMatch = court.slug.match(/court-(\d+)/);
          const courtLabel = courtMatch ? `Court ${courtMatch[1]}` : court.slug;

          for (const s of rawSlots) {
            const startTime = `${String(s.hour).padStart(2, "0")}:00`;
            const endTime = `${String(s.hour + 1).padStart(2, "0")}:00`;
            slots.push({
              date: s.date,
              startTime,
              endTime,
              available: s.available,
              courtLabel,
            });
          }
        } finally {
          await page.close();
        }
      }

      // Deduplicate (available slots appear in both link extraction and grid walk)
      const seen = new Set<string>();
      const deduped: ScrapedSlot[] = [];
      for (const s of slots) {
        const key = `${s.date}-${s.startTime}-${s.courtLabel}-${s.available}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(s);
        }
      }

      return {
        slots: deduped,
        adapter: "camden_active",
        durationMs: Date.now() - start,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        slots: [],
        adapter: "camden_active",
        durationMs: Date.now() - start,
        error: message,
      };
    }
  },
};

export { camdenActiveAdapter };
