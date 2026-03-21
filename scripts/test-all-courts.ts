import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

interface ScrapeResult {
  slots: Array<{
    date: string;
    startTime: string;
    endTime: string;
    available: boolean;
    courtLabel?: string;
    totalCourts?: number;
    rawData?: Record<string, unknown>;
  }>;
  adapter: string;
  durationMs: number;
  error?: string;
}

interface CourtTestResult {
  slug: string;
  name: string;
  adapter: string;
  metadataErrors: string[];
  scrapeResult?: ScrapeResult;
  validationErrors: string[];
  status: "pass" | "fail" | "warn";
}

// ── Phase 1: Metadata validation ─────────────────────────────────────

function validateMetadata(
  court: { slug: string; bookingSystem: string; bookingUrl: string; metadata: Record<string, unknown> | null }
): string[] {
  const errors: string[] = [];
  const meta = court.metadata ?? {};

  switch (court.bookingSystem) {
    case "clubspark": {
      const venue = (meta.venue as string) || court.bookingUrl.match(/clubspark\.lta\.org\.uk\/([^/]+)\//)?.[1];
      if (!venue) errors.push("missing venue slug in metadata and bookingUrl");
      break;
    }
    case "better": {
      const activity = meta.activity as string | undefined;
      if (!activity) {
        errors.push("missing metadata.activity (e.g. 'tennis-court-outdoor')");
      }
      const activities = meta.activities as string[] | undefined;
      if (activities && activity && !activities.includes(activity)) {
        errors.push(`activity '${activity}' not in activities list [${activities.join(", ")}]`);
      }
      break;
    }
    case "camden_active": {
      const courtPages = meta.courtPages as Array<{ id: unknown; slug: unknown }> | undefined;
      if (!Array.isArray(courtPages) || courtPages.length === 0) {
        errors.push("missing or empty metadata.courtPages array");
      } else {
        for (const cp of courtPages) {
          if (typeof cp.id !== "number") errors.push(`courtPage missing numeric id: ${JSON.stringify(cp)}`);
          if (typeof cp.slug !== "string") errors.push(`courtPage missing string slug: ${JSON.stringify(cp)}`);
        }
      }
      break;
    }
    case "microsoft_bookings": {
      const serviceTypes = meta.serviceTypes as Array<{ name: string }> | undefined;
      if (!Array.isArray(serviceTypes) || serviceTypes.length === 0) {
        errors.push("missing or empty metadata.serviceTypes array");
      }
      break;
    }
    case "flow_onl": {
      const venue = (meta.venue as string) || court.bookingUrl.match(/location\/([^/]+)/)?.[1];
      if (!venue) errors.push("cannot extract venue slug from metadata or bookingUrl");
      break;
    }
  }

  return errors;
}

// ── Phase 2: Scrape output validation ────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

const PLAYWRIGHT_ADAPTERS = new Set(["better", "camden_active", "microsoft_bookings", "flow_onl"]);

function validateScrapeResult(result: ScrapeResult, bookingSystem: string): string[] {
  const errors: string[] = [];

  if (result.error) {
    errors.push(`scrape error: ${result.error}`);
  }

  if (result.slots.length === 0) {
    errors.push("no slots returned");
    return errors;
  }

  const availableCount = result.slots.filter((s) => s.available).length;
  if (availableCount === 0) {
    errors.push("no available slots (all booked or closed)");
  }

  // Validate slot format (sample first 50 for performance)
  const sample = result.slots.slice(0, 50);
  for (const slot of sample) {
    if (!DATE_RE.test(slot.date)) {
      errors.push(`invalid date format: '${slot.date}'`);
      break;
    }
    if (!TIME_RE.test(slot.startTime) || !TIME_RE.test(slot.endTime)) {
      errors.push(`invalid time format: '${slot.startTime}'-'${slot.endTime}'`);
      break;
    }
    if (slot.startTime >= slot.endTime) {
      errors.push(`startTime >= endTime: '${slot.startTime}' >= '${slot.endTime}'`);
      break;
    }
  }

  // ClubSpark-specific: detect skeleton data (login-required courts return "Resource 1")
  if (bookingSystem === "clubspark") {
    const labels = new Set(result.slots.map((s) => s.courtLabel).filter(Boolean));
    if (labels.size === 1 && labels.has("Resource 1")) {
      errors.push("skeleton data only ('Resource 1') — likely login-required");
    }
  }

  // Playwright courts are inherently slower (multiple page loads)
  const timeLimit = PLAYWRIGHT_ADAPTERS.has(bookingSystem) ? 120_000 : 30_000;
  if (result.durationMs > timeLimit) {
    errors.push(`slow scrape: ${(result.durationMs / 1000).toFixed(1)}s (limit: ${timeLimit / 1000}s)`);
  }

  return errors;
}

// ── Concurrency helper ───────────────────────────────────────────────

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { getAdapter } = await import("../src/lib/scrapers/registry.js");

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const courts = await prisma.court.findMany({
    where: { enabled: true },
    orderBy: { bookingSystem: "asc" },
  });

  console.log(`\n=== Court Monitoring Health Check ===`);
  console.log(`Found ${courts.length} enabled courts\n`);

  const results: CourtTestResult[] = [];

  // ── Phase 1: Metadata validation ─────────────────────────────────
  console.log("--- Phase 1: Metadata Validation ---\n");

  let metaPass = 0;
  let metaFail = 0;

  for (const court of courts) {
    const meta = court.metadata as Record<string, unknown> | null;
    const errors = validateMetadata({
      slug: court.slug,
      bookingSystem: court.bookingSystem,
      bookingUrl: court.bookingUrl,
      metadata: meta,
    });

    if (errors.length === 0) {
      metaPass++;
    } else {
      metaFail++;
      console.log(`  ✗ ${court.slug} (${court.bookingSystem}): ${errors.join("; ")}`);
    }

    results.push({
      slug: court.slug,
      name: court.name,
      adapter: court.bookingSystem,
      metadataErrors: errors,
      validationErrors: [],
      status: "pass",
    });
  }

  console.log(`\n  ${metaPass} passed, ${metaFail} failed\n`);

  // ── Phase 2: Live scrape ─────────────────────────────────────────
  console.log("--- Phase 2: Live Scrape ---\n");

  // Group by adapter type for efficient batching
  const clubsparkCourts = courts.filter((c) => c.bookingSystem === "clubspark");
  const playwrightCourts = courts.filter((c) => c.bookingSystem !== "clubspark");

  const resultMap = new Map<string, CourtTestResult>(results.map((r) => [r.slug, r]));

  async function scrapeCourt(court: typeof courts[number]) {
    const scrapeAdapter = getAdapter(court.bookingSystem);
    if (!scrapeAdapter) {
      return { slug: court.slug, error: `no adapter for ${court.bookingSystem}` };
    }

    const scrapeResult = await scrapeAdapter.scrape(
      court.id,
      court.bookingUrl,
      (court.metadata as Record<string, unknown>) ?? undefined
    );

    const testResult = resultMap.get(court.slug)!;
    testResult.scrapeResult = scrapeResult;
    testResult.validationErrors = validateScrapeResult(scrapeResult, court.bookingSystem);

    // Determine status
    if (testResult.validationErrors.length > 0 || testResult.metadataErrors.length > 0) {
      testResult.status = "fail";
    }

    // Print progress
    const slots = scrapeResult.slots.length;
    const avail = scrapeResult.slots.filter((s) => s.available).length;
    const time = scrapeResult.durationMs < 1000
      ? `${scrapeResult.durationMs}ms`
      : `${(scrapeResult.durationMs / 1000).toFixed(1)}s`;
    const icon = testResult.status === "pass" ? "✓" : "✗";
    const errorSuffix = testResult.validationErrors.length > 0
      ? ` — ${testResult.validationErrors[0]}`
      : "";

    console.log(
      `  ${icon} ${court.slug.padEnd(40)} ${court.bookingSystem.padEnd(14)} ${String(slots).padStart(5)} slots  ${String(avail).padStart(5)} avail  ${time.padStart(8)}${errorSuffix}`
    );

    return { slug: court.slug };
  }

  // Run ClubSpark courts in parallel (API-based, fast)
  if (clubsparkCourts.length > 0) {
    console.log(`  [ClubSpark API — ${clubsparkCourts.length} courts in parallel]`);
    await runWithConcurrency(clubsparkCourts, clubsparkCourts.length, scrapeCourt);
    console.log();
  }

  // Run Playwright courts with limited concurrency
  if (playwrightCourts.length > 0) {
    console.log(`  [Playwright — ${playwrightCourts.length} courts, concurrency 3]`);
    await runWithConcurrency(playwrightCourts, 3, scrapeCourt);
    console.log();
  }

  // ── Phase 3: Summary ─────────────────────────────────────────────
  console.log("--- Summary ---\n");

  const passed = results.filter((r) => r.status === "pass");
  const failed = results.filter((r) => r.status === "fail");

  if (failed.length > 0) {
    console.log("  Failed courts:");
    for (const r of failed) {
      const allErrors = [...r.metadataErrors, ...r.validationErrors];
      console.log(`    ✗ ${r.slug} (${r.adapter}): ${allErrors.join("; ")}`);
    }
    console.log();
  }

  console.log(`  ${passed.length}/${results.length} passed, ${failed.length} failed\n`);

  // ── Phase 4: Write report to docs/test-results.md ────────────────
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const reportPath = resolve(__dirname, "../docs/test-results.md");
  const now = new Date();
  const timestamp = now.toISOString().replace("T", " ").slice(0, 19);

  let newEntry = `## ${timestamp}\n\n`;
  newEntry += `**${passed.length}/${results.length} passed, ${failed.length} failed**\n\n`;

  if (failed.length > 0) {
    newEntry += "| Court | Adapter | Slots | Error |\n";
    newEntry += "|-------|---------|------:|-------|\n";
    for (const r of failed) {
      const allErrors = [...r.metadataErrors, ...r.validationErrors];
      const slots = r.scrapeResult?.slots.length ?? 0;
      newEntry += `| ${r.name} (\`${r.slug}\`) | ${r.adapter} | ${slots} | ${allErrors.join("; ")} |\n`;
    }
    newEntry += "\n";
  } else {
    newEntry += "All courts passed.\n\n";
  }

  newEntry += "---\n\n";

  // Read existing report or create header
  let existing = "";
  if (existsSync(reportPath)) {
    existing = readFileSync(reportPath, "utf-8");
  }

  if (!existing.startsWith("# Court Monitoring Test Results")) {
    existing = "# Court Monitoring Test Results\n\nTest history from `npm run test:all`. Most recent results first.\n\n---\n\n";
  }

  // Insert new entry after the header (after first "---")
  const headerEnd = existing.indexOf("---\n\n");
  if (headerEnd !== -1) {
    const header = existing.slice(0, headerEnd + 5);
    const rest = existing.slice(headerEnd + 5);
    writeFileSync(reportPath, header + newEntry + rest, "utf-8");
  } else {
    writeFileSync(reportPath, existing + newEntry, "utf-8");
  }

  console.log(`  Report written to docs/test-results.md\n`);

  await prisma.$disconnect();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
