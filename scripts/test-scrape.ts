import "dotenv/config";

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { getAdapter, listAdapters } = await import("../src/lib/scrapers/registry.js");

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const args = process.argv.slice(2);
  const adapterFlag = args.indexOf("--adapter");
  const slugFlag = args.indexOf("--court");

  if (adapterFlag === -1 && slugFlag === -1) {
    console.log("Usage:");
    console.log("  npx tsx scripts/test-scrape.ts --adapter localtenniscourts");
    console.log("  npx tsx scripts/test-scrape.ts --court clissold-park");
    console.log(`\nAvailable adapters: ${listAdapters().join(", ")}`);
    await prisma.$disconnect();
    process.exit(0);
  }

  if (slugFlag !== -1) {
    const slug = args[slugFlag + 1];
    const court = await prisma.court.findUnique({ where: { slug } });
    if (!court) {
      console.error(`Court not found: ${slug}`);
      await prisma.$disconnect();
      process.exit(1);
    }

    const scrapeAdapter = getAdapter(court.bookingSystem);
    if (!scrapeAdapter) {
      console.error(`No adapter for: ${court.bookingSystem}`);
      await prisma.$disconnect();
      process.exit(1);
    }

    console.log(`Scraping ${court.name} using ${scrapeAdapter.name}...`);
    const result = await scrapeAdapter.scrape(
      court.id,
      court.bookingUrl,
      (court.metadata as Record<string, unknown>) ?? undefined
    );
    printResult(result);
  } else {
    const adapterName = args[adapterFlag + 1];
    const scrapeAdapter = getAdapter(adapterName);
    if (!scrapeAdapter) {
      console.error(`Unknown adapter: ${adapterName}`);
      console.log(`Available: ${listAdapters().join(", ")}`);
      await prisma.$disconnect();
      process.exit(1);
    }

    const urls: Record<string, string> = {
      localtenniscourts: "https://www.localtenniscourts.com/london",
      microsoft_bookings: "https://outlook.office365.com/owa/calendar/GardenHallsTennis@arden.ac.uk/bookings/",
    };

    console.log(`Scraping with ${scrapeAdapter.name}...`);
    const result = await scrapeAdapter.scrape("test", urls[adapterName] || "", {});
    printResult(result);
  }

  await prisma.$disconnect();
}

function printResult(result: { slots: unknown[]; adapter: string; durationMs: number; error?: string }) {
  console.log(`\nAdapter: ${result.adapter}`);
  console.log(`Duration: ${result.durationMs}ms`);
  if (result.error) {
    console.log(`Error: ${result.error}`);
  }
  console.log(`Slots found: ${result.slots.length}`);
  if (result.slots.length > 0) {
    console.log("\nFirst 20 slots:");
    for (const slot of result.slots.slice(0, 20)) {
      const s = slot as Record<string, unknown>;
      console.log(
        `  ${s.date} ${s.startTime}-${s.endTime} ${s.courtLabel || ""} (${s.totalCourts || "?"} courts)`
      );
    }
    if (result.slots.length > 20) {
      console.log(`  ... and ${result.slots.length - 20} more`);
    }
  }
}

main().catch(console.error);
