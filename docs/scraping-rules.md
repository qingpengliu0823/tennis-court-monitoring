# Scraping Rules by Court

This document specifies the scraping rules, DOM selectors, and data extraction logic for each tennis court. When a scraper breaks, check here first — the site's DOM likely changed.

Last verified: 2026-03-20

---

## localtenniscourts.com (Adapter: `localtenniscourts`)

**Covers:** Clissold Park, Highbury Fields, London Fields, Finsbury Park, Regent's Park, Hyde Park (~65 London venues total)

**Status:** Extracts aggregate court counts per time/date. Does NOT extract per-venue breakdown.

### Source URL

`https://www.localtenniscourts.com/london`

All 6 localtenniscourts venues share this single URL. The page shows a combined availability grid for all London venues.

### Page structure (verified 2026-03-20)

The page renders two `<table>` elements:

| Table | Contains | Key selector |
|-------|----------|--------------|
| 1st `<table>` | Header row only | `<th>` cells: `"Time"`, `"Fri 20"`, `"Sat 21"`, ... |
| 2nd `<table>` | Data rows in `<tbody>` | 17 rows (06:00–22:00), 9 cells each |

**Header cells** (1st table):
```
<thead> > <tr> > <th>Time</th> <th>Fri 20</th> <th>Sat 21</th> ...
```

**Data rows** (2nd table):
```html
<tbody data-slot="table-body">
  <tr>
    <td>06:00</td>                         <!-- cell 0: time -->
    <td>                                    <!-- cells 1-8: day columns -->
      <div class="flex flex-col items-center">
        <span class="font-semibold">4</span>       <!-- court count -->
        <span class="text-xs ...">courts</span>
      </div>
    </td>
    ...
  </tr>
</tbody>
```

- Unavailable slots show `<span class="font-semibold">-</span>`
- High availability shows `25+` (parsed as integer 25)

### Date parsing

Headers like `"Fri 20"` are converted to `YYYY-MM-DD`:
- Extract day number from header text
- Use current month; if resulting date is >14 days in the past, assume next month

### What is NOT extracted

- **Per-venue breakdown**: The table shows aggregate counts across all venues. Individual venue names, booking URLs, and per-venue availability are behind click popovers that we don't interact with.
- **Pricing**: Not shown in the grid.

### Per-venue deep links (for "Open booking page")

These are stored in `metadata.deepLink` on each Court record, not extracted by the scraper:

| Court | Deep link |
|-------|-----------|
| Clissold Park | `https://clubspark.lta.org.uk/ClissoldParkHackney/Booking/BookByDate` |
| Highbury Fields | `https://clubspark.lta.org.uk/HighburyFieldsLondon` |
| London Fields | `https://clubspark.lta.org.uk/LondonFieldsPark/Booking/BookByDate` |
| Finsbury Park | `https://clubspark.lta.org.uk/FinsburyPark/Booking/BookByDate` |
| Regent's Park | `https://clubspark.lta.org.uk/RegentsPark` |
| Hyde Park | `https://clubspark.lta.org.uk/HydePark` |

### Known fragile points

1. **Two-table assumption**: If the site restructures to a single table or uses divs, the scraper breaks.
2. **`.font-semibold` selector**: Used to find the court count number. Will break if the CSS class is renamed.
3. **Hardcoded 1.5s wait**: May fail on slow connections. Consider `waitForSelector` instead.
4. **No per-venue data**: A future improvement would be to click each cell to get the popover with individual venue availability and booking URLs.

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
