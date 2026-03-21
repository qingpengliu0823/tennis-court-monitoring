# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Tennis Court Monitoring

Real-time availability monitor for 84+ London tennis courts across 6 booking platforms. Scrapes booking sites, detects new openings, and sends Telegram alerts.

## Stack

- **Framework:** Next.js 16, React 19, TypeScript
- **Database:** PostgreSQL via Prisma 7.5 (with `@prisma/adapter-pg`)
- **Scraping:** Playwright (headless Chromium) for JS-heavy SPAs; direct API for ClubSpark
- **UI:** Tailwind CSS 4, shadcn/ui, Leaflet maps
- **Notifications:** Telegram Bot API
- **Scheduling:** node-cron + `/api/cron` endpoint

## Commands

```
npm run dev            # Dev server on port 3456
npm run db:seed        # Insert new courts from scripts/seed-courts.ts (safe to re-run, skips existing)
npm run db:migrate     # Run Prisma migrations
npm run db:studio      # Prisma Studio GUI
npm run test:scrape    # Test a scraper: --adapter <name> or --court <slug>
npm run test:telegram  # Test Telegram bot
```

## Architecture

### Booking System Adapters (`src/lib/scrapers/`)

Each adapter implements `CourtAdapter` from `types.ts` and is registered in `registry.ts`.

| Adapter | File | Method | Courts |
|---------|------|--------|--------|
| `clubspark` | `clubspark.ts` | JSON API (no browser) | ~60 parks across London |
| `better` | `better.ts` | Playwright (React SPA) | Islington Tennis Centre |
| `flow_onl` | `flow-onl.ts` | Playwright (React SPA) | Hyde Park, Regent's Park, Greenwich Park |
| `camden_active` | `camden-active.ts` | Playwright (ASP.NET) | Lincoln's Inn Fields, Waterlow, Kilburn Grange |
| `microsoft_bookings` | `microsoft-bookings.ts` | Playwright | Garden Halls |
| `localtenniscourts` | `localtenniscourts.ts` | Playwright | (available, no courts assigned) |

To add a new adapter: create `src/lib/scrapers/{name}.ts`, implement `CourtAdapter`, register in `registry.ts`.

### Adding Courts

1. Add entry to `scripts/seed-courts.ts` — follow existing format:
   ```ts
   {
     name: "Park Name Tennis",
     slug: "park-name",          // unique, kebab-case
     bookingSystem: "clubspark", // must match a registered adapter
     bookingUrl: "https://...",
     location: "Address, London POSTCODE",
     metadata: {
       lat: 51.xxxx, lng: -0.xxxx,
       venue: "VenueSlug",
       deepLink: "https://...",
       courts: N, surface: "Hard", floodlit: true,
       pricing: { peak: "£X", offPeak: "£Y" },
     },
   }
   ```
2. Run `npm run db:seed` — inserts new entries, skips existing (idempotent by slug)
3. Update `docs/courts-to-monitor.md` with the new entry

### Data Flow

```
Scraper adapter → ScrapedSlot[] → diffSlots() → new slots → notifier → Telegram alert
                                → storeSnapshot() → SlotSnapshot table
```

- `runScheduler()` in `src/lib/scheduler.ts` processes all due monitors
- `diffSlots()` in `src/lib/diff.ts` compares against latest snapshot
- Notifications go through `src/lib/notifier.ts` with per-monitor cooldown

### Key Files

| Path | Purpose |
|------|---------|
| `src/app/actions/courts.ts` | Server actions: getCourts, getCourt, toggleCourt |
| `src/app/actions/scrape.ts` | Server actions: scrapeNow, runMonitorNow, getDashboardStats |
| `src/app/actions/monitors.ts` | Server actions: CRUD for monitors |
| `src/lib/scheduler.ts` | Main scheduling loop, groups scrapes by court |
| `src/lib/diff.ts` | Slot diffing and snapshot storage |
| `src/lib/prisma.ts` | Singleton Prisma client |
| `scripts/seed-courts.ts` | Court definitions (source of truth for adding courts) |
| `docs/courts-to-monitor.md` | 85 courts with booking systems, URLs, status |
| `docs/scraping-rules.md` | DOM structure docs for each adapter |

### Database Models (Prisma)

- **Court** — venue metadata, booking system, enabled flag
- **SlotSnapshot** — point-in-time availability (append-only)
- **Monitor** — user-defined filters (days, time range, date range, interval)
- **Alert** — notification history
- **ScrapeLog** — scrape audit trail

### Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard: stats, recent alerts, last scrape |
| `/courts` | Split-panel explorer: court list + Leaflet map |
| `/courts/[slug]` | Court detail: metadata, availability grid, monitors |
| `/monitors` | Active monitors with run/toggle controls |
| `/monitors/new` | Create monitor form |
| `/alerts` | Paginated alert history |
| `/logs` | Paginated scrape log history |

### Environment Variables

```
DATABASE_URL=postgresql://...     # Prisma connection
TELEGRAM_BOT_TOKEN=               # Telegram Bot API token
TELEGRAM_CHAT_ID=                 # Default Telegram chat ID
```
