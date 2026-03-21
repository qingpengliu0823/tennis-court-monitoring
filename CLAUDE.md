@AGENTS.md

# Claude Code Instructions

- After adding courts to `seed-courts.ts`, always run `npm run db:seed` to insert them
- After significant changes, update `AGENTS.md` and `docs/courts-to-monitor.md`
- When writing scrapers, document DOM structure in `docs/scraping-rules.md`
- Use `npm run test:scrape -- --court <slug>` to verify a scraper works before committing
- Court venue slugs must be verified against actual ClubSpark/Flow.onl URLs — don't guess
