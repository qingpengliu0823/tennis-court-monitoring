import "dotenv/config";

/**
 * One-time script to patch existing DB rows with lat/lng coordinates.
 * Reads current metadata, merges in coordinates, writes back.
 */
async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  const { PrismaPg } = await import("@prisma/adapter-pg");

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const coords: Record<string, { lat: number; lng: number }> = {
    "garden-halls":             { lat: 51.5268, lng: -0.1275 },
    "islington-tennis-centre":  { lat: 51.5513, lng: -0.1152 },
    "finsbury-park":            { lat: 51.5637, lng: -0.1052 },
    "paddington-recreation-ground": { lat: 51.5281, lng: -0.1828 },
    "rosemary-gardens":         { lat: 51.5396, lng: -0.0876 },
    "clissold-park":            { lat: 51.5612, lng: -0.0823 },
    "hackney-downs":            { lat: 51.5545, lng: -0.0574 },
    "london-fields":            { lat: 51.5413, lng: -0.0596 },
    "geraldine-mary-harmsworth": { lat: 51.4978, lng: -0.1026 },
    "archbishops-park":         { lat: 51.4984, lng: -0.1149 },
    "kennington-park":          { lat: 51.4856, lng: -0.1077 },
    "spring-hill":              { lat: 51.5505, lng: -0.0530 },
    "elthorne-tennis":          { lat: 51.5770, lng: -0.1289 },
    "southwark-park":           { lat: 51.4929, lng: -0.0565 },
    "clapham-common":           { lat: 51.4600, lng: -0.1580 },
    "bethnal-green-gardens":    { lat: 51.5280, lng: -0.0625 },
    "king-edward-memorial":     { lat: 51.5087, lng: -0.0467 },
    "st-johns-park":            { lat: 51.5166, lng: -0.0270 },
    "lincolns-inn-fields":      { lat: 51.5154, lng: -0.1176 },
    "waterlow-park":            { lat: 51.5674, lng: -0.1449 },
    "kilburn-grange-park":      { lat: 51.5446, lng: -0.1959 },
    "highbury-fields":          { lat: 51.5510, lng: -0.0980 },
  };

  const courts = await prisma.court.findMany();
  let updated = 0;

  for (const court of courts) {
    const c = coords[court.slug];
    if (!c) {
      console.log(`  No coords for ${court.slug}, skipping`);
      continue;
    }

    const existing = (court.metadata as Record<string, unknown>) || {};
    if (existing.lat != null && existing.lng != null) {
      console.log(`  ${court.slug} already has coords, skipping`);
      continue;
    }

    await prisma.court.update({
      where: { id: court.id },
      data: { metadata: { ...existing, ...c } },
    });
    console.log(`  Updated ${court.slug} → ${c.lat}, ${c.lng}`);
    updated++;
  }

  console.log(`Done! Updated ${updated} courts.`);
  await prisma.$disconnect();
}

main().catch(console.error);
