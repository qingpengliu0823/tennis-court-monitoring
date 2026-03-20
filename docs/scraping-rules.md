# Scraping Rules by Court

This document specifies the scraping rules, DOM selectors, and data extraction logic for each tennis court. When a scraper breaks, check here first — the site's DOM likely changed.

Last verified: 2026-03-20

| Adapter | Status | Courts |
|---------|--------|--------|
| `microsoft_bookings` | Working | Garden Halls |
| `better` | Working | Islington Tennis Centre |
| `clubspark` | Working | 9 enabled, 4 disabled (login required) |

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

## ClubSpark/LTA Courts (Adapter: `clubspark`)

**Covers:** Finsbury Park, Clissold Park, Hackney Downs, London Fields, Geraldine Mary Harmsworth, Spring Hill, Elthorne, Southwark Park, Clapham Common (9 enabled). Paddington Rec, Rosemary Gardens, Archbishop's Park, Kennington Park disabled (require login).

**Status:** Fully working. Scans 7 days forward, extracts all time slots with availability, pricing, and court labels.

### Source URL

Booking page: `https://clubspark.lta.org.uk/{venue}/Booking/BookByDate`

Per-day navigation via hash fragment: `#?date=YYYY-MM-DD&role=guest`

### Page structure (verified 2026-03-20)

Client-rendered — JavaScript reads hash fragment and loads the booking grid. Requires Playwright.

**Booking grid:**
```html
<div class="carousel">
  <ul>
    <li class="visible">
      <div class="resource-wrap">
        <div class="resource" data-resource-name="Court 1" data-resource-id="...">
          <div class="resource-header">
            <h3>Court 1</h3>
            <div class="resource-info" title="Court 1 - Full, Outdoor, Incandescent Lighting, Hard">
              <span>Full, Outdoor, Incandescent Lighting, Hard</span>
            </div>
          </div>
          <div class="sessions-container">
            <!-- .resource-session elements here -->
          </div>
        </div>
      </div>
    </li>
  </ul>
</div>
```

**Time slots (`.resource-session`):**
```html
<div class="resource-session"
     data-availability="true"
     data-start-time="540"       <!-- minutes from midnight (540 = 09:00) -->
     data-end-time="600"         <!-- 600 = 10:00 -->
     data-session-cost="7"       <!-- price in £ -->
     data-session-member-cost="0"
     data-capacity="1"
     data-resource-interval="60">
  <div class="resource-interval">
    <div class="unavailable">
      <span>Unavailable</span>    <!-- shown to anonymous users even when available -->
    </div>
  </div>
</div>
```

- `data-availability="true"` = available for booking, `"false"` = booked
- `data-start-time` / `data-end-time`: minutes from midnight (e.g. 420 = 07:00, 780 = 13:00)
- `data-session-cost`: price in £ (integer or decimal)
- Multi-hour slots: some slots span 2+ hours (e.g. start=1200, end=1320 = 20:00-22:00)

**Booked slots** show `.full-session` with `.session-name` "Booked".
**Available slots** show `.unavailable` with text "Unavailable" (misleading — this is for anonymous users who can't book inline, but `data-availability="true"` is the source of truth).

### Data extraction

The adapter uses a string-based `page.evaluate()` (not a function callback) to avoid tsx/esbuild `__name` serialization issues. It reads all `.resource-session` elements and extracts:
- Court name from ancestor `.resource[data-resource-name]`
- Court info from `.resource-info[title]`
- Availability, times, and pricing from data attributes

### Venue-specific notes

- **Some venues require ClubSpark login** (redirect to auth.clubspark.uk). These are disabled in the database. Affected: Paddington Recreation Ground, Rosemary Gardens, Tennis In Lambeth (Archbishop's Park + Kennington Park).
- **Millfields Park** — ClubSpark URL returns 404. Removed from monitoring.
- **Archbishop's Park and Kennington Park** share the same ClubSpark org (Tennis In Lambeth).

### Metadata

```json
{
  "venue": "FinsburyPark",
  "deepLink": "https://clubspark.lta.org.uk/FinsburyPark/Booking/BookByDate",
  "courts": 8,
  "surface": "Hard",
  "floodlit": true,
  "pricing": { "offPeak": "£4", "peak": "£7" }
}
```

### Known fragile points

1. **Hash fragment navigation**: Date is set via `#?date=YYYY-MM-DD&role=guest`. If ClubSpark changes to query params or a different SPA routing scheme, navigation breaks.
2. **Data attributes**: All extraction relies on `data-availability`, `data-start-time`, `data-end-time`, `data-session-cost`. If ClubSpark renames these attributes, the adapter breaks silently (returns 0 slots, no error).
3. **Minutes-from-midnight encoding**: Start/end times are in minutes (e.g. 540 = 09:00). If the format changes to HH:MM strings, the time conversion logic breaks.
4. **2s hardcoded wait**: May fail on slow connections. The adapter also waits for `.resource-session` selector with a 10s timeout as a fallback.
5. **Login-required venues**: No authentication support. Venues that require login return 0 slots without an error (the page redirects to sign-in, so `.resource-session` selector times out silently).
6. **7 sequential page loads**: One per day = ~20s total. Could be parallelized but risks rate limiting from ClubSpark.

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
