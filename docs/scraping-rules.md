# Scraping Rules by Court

This document specifies the scraping rules, DOM selectors, and data extraction logic for each tennis court. When a scraper breaks, check here first — the site's DOM likely changed.

Last verified: 2026-03-20

---

## localtenniscourts.com (Adapter: `localtenniscourts`)

**Status:** No courts currently using this adapter. Kept for reference — can be re-enabled for any of the ~65 London venues on localtenniscourts.com.

See git history (commit `a8401a1`) for full documentation of the two-table DOM structure and per-venue deep links.

---

## Garden Halls Tennis (Adapter: `microsoft_bookings`)

**Covers:** Garden Halls Tennis, Cartwright Gardens, London WC1H 9EN

**Status:** Fully working. Selects service type, reads calendar, extracts available time slots.

### Source URL

`https://outlook.office365.com/owa/calendar/GardenHallsTennis@upp-ltd.com/bookings/`

Note: The old URL `@arden.ac.uk` returns "Bad Request". The correct domain is `@upp-ltd.com`.

### Service types

Selected via `<label>` click (not `<input>` — the label overlay intercepts pointer events):

| Service | Duration | Price | Radio `aria-label` |
|---------|----------|-------|--------------------|
| Garden Halls Resident | 1 hour | Free | `"Garden Halls Resident"` |
| Student | 1 hour | £5/hr | `"Student"` |
| WC1 Resident | 1 hour | £5/hr | `"WC1 Resident"` |
| Visitor | 1 hour | £10/hr | `"Visitor"` |

Stored in Court `metadata.serviceTypes` and selected per-Monitor via `monitor.serviceType`.

### Page flow

1. Page loads → shows 4 service type labels + calendar + empty time slot area
2. Click a `<label>` → page auto-selects service AND auto-jumps to first available date, showing its time slots
3. Click a different date → time slots update

### DOM structure (verified 2026-03-20)

**Service type labels:**
```html
<ul>
  <li>
    <input type="radio" id="service_2" aria-label="Student" name="selectedService" />
    <label for="service_2">
      <span class="rDV0b">1 hour</span>    <!-- this span intercepts clicks -->
      ...
    </label>
  </li>
</ul>
```
**Important:** Must click `<label>`, NOT `<input>`. The label's child `<span>` intercepts pointer events on the radio.

**Calendar date cells:**
```html
<div aria-label="Monday, March 23, 2026. Available times" class="zXGqW ...">
  <div class="mqwJx ...">23</div>    <!-- day number -->
</div>
```
- Parent `<div>` has `aria-label` with full date and availability status
- Available: `"... Available times"` or `"... selected"`
- Unavailable: `"... No available times"`
- Selector: `div[aria-label*="202"]` then filter by text content

**Time slots:**
```html
<li>
  <label>
    <span class="WpLer">9:00</span>
  </label>
</li>
```
- Selector: `li label` then extract text matching `/\d{1,2}:\d{2}/`
- Times may be in 12-hour format with AM/PM or 24-hour; adapter handles both

### Date parsing

From `aria-label`: `"Monday, March 23, 2026. Available times"` → `2026-03-23`

Regex: `/(\w+)\s+(\d{1,2}),\s+(\d{4})/` extracts month name, day, year.

### Fallback extraction

If no date cells with "Available" are found (e.g. page auto-jumped and didn't render clickable dates), the adapter falls back to:
1. Read body text for pattern `March\s+(\d{1,2})`
2. Read `li label` text for time slots
3. Combine into slots

### Known fragile points

1. **`aria-label` text format**: Any wording change (e.g. "Available times" → "Times available") breaks date discovery.
2. **`.WpLer` class**: Used only in fallback; primary extraction uses `li label` text.
3. **Hardcoded waits** (2s after load, 1s after service click, 1.5s after date click): May fail on slow connections.
4. **Single month only**: Currently only scrapes the visible month. Does not click "Next month" to scan further ahead.
5. **English month names**: Hardcoded month name → number mapping. The `Accept-Language: en-GB` header should ensure English, but not guaranteed.

---

## Islington Tennis Centre (Adapter: `better`)

**Covers:** Islington Tennis Centre, Market Road, London N7 9PL

**Status:** Fully working. Scans 7 days forward, extracts all time slots with availability and pricing.

### Source URL

Activities page: `https://bookings.better.org.uk/location/islington-tennis-centre/tennis-activities`

Per-day availability (what the scraper hits): `https://bookings.better.org.uk/location/{venue}/{activity}/{YYYY-MM-DD}/by-time`

### Activities

| Activity slug | Description |
|---------------|-------------|
| `tennis-court-outdoor` | Outdoor courts (default, configured in metadata) |
| `tennis-court-indoor` | Indoor courts |
| `tennis-sessions` | Group sessions |

Configured via `metadata.activity` on the Court record.

### Page structure (verified 2026-03-20)

React SPA — requires Playwright for JS rendering. The scraper navigates to each date's `/by-time` URL directly (no clicking through a calendar).

**Slot cards:**
```
Parent container (walk up from <a> until text has ":00 -" and "min"):
  "07:00 - 08:00 60min Tennis Court (Floodlit) Multiple £14.85 0 spaces available Book"

  <a href="/location/.../slot/07:00-08:00/921c8fb8">
    <button><span>Book</span></button>
  </a>
```

- Time extracted from `<a>` href: `/slot/(\d{2}:\d{2})-(\d{2}:\d{2})/`
- Spaces: `innerText` parsed with `/(\d+) spaces? available/`
- Price: `/£([\d.]+)/`
- Court type: `/Tennis Court \(([^)]+)\)/`

**Important:** Must use `innerText` (not `textContent`) to parse the card — `textContent` concatenates child elements without spaces, breaking the regex (e.g. `£14.850 spaces` instead of `£14.85 0 spaces`).

**Date navigation:**
```html
<a href="/location/.../tennis-court-outdoor/2026-03-21/by-time">Sat21</a>
```

The scraper doesn't use these — it constructs URLs directly for 7 days forward.

### Metadata

```json
{
  "activity": "tennis-court-outdoor",
  "venue": "islington-tennis-centre",
  "deepLink": "https://bookings.better.org.uk/location/islington-tennis-centre/tennis-court-outdoor",
  "activities": ["tennis-court-outdoor", "tennis-court-indoor"]
}
```

### Known fragile points

1. **Container walk-up logic**: Finds the card by walking up from `<a>` until text contains `:00 -` and `min`. If the card layout changes, this breaks.
2. **React SPA load time**: 2s hardcoded wait per page. May need tuning.
3. **7 sequential page loads**: One per day = slow (~30s total). Could be parallelized but risks rate limiting.
4. **Price in text**: If Better changes pricing format (e.g. "From £14.85"), the regex may partially match.

---

## Adding a new court

1. **Identify the booking system**: Is it ClubSpark, Better, Microsoft Bookings, or something else?
2. **Check if an existing adapter covers it**: Most London parks are on localtenniscourts.com already.
3. **If new adapter needed**:
   - Create `src/lib/scrapers/<name>.ts` implementing `CourtAdapter`
   - Register it in `src/lib/scrapers/registry.ts`
   - Document the DOM structure in this file
4. **Add the court to the database**: Update `scripts/seed-courts.ts` with:
   - `bookingSystem`: adapter name
   - `bookingUrl`: URL the scraper navigates to
   - `metadata.deepLink`: direct booking URL for users
   - Any adapter-specific metadata (e.g. `venueId`, `serviceTypes`)

---

## Debugging a broken scraper

1. Run `npx tsx scripts/test-scrape.ts --adapter <name>` to see raw output
2. Check `/logs` page in the dashboard for error messages
3. Open the booking URL manually in a browser and compare DOM structure against this doc
4. Common causes:
   - CSS class renamed → update selector
   - DOM restructured → update table/element traversal logic
   - URL changed → update `bookingUrl` in database
   - New CAPTCHA or bot detection → may need different approach
