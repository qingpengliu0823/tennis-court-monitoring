import "dotenv/config";

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  const { PrismaPg } = await import("@prisma/adapter-pg");

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const courts = [
    {
      name: "Garden Halls Tennis",
      slug: "garden-halls",
      bookingSystem: "microsoft_bookings",
      bookingUrl: "https://outlook.office365.com/owa/calendar/GardenHallsTennis@upp-ltd.com/bookings/",
      location: "Garden Halls, Cartwright Gardens, London WC1H 9EN",
      metadata: {
        serviceTypes: [
          { name: "Garden Halls Resident", duration: "1 hour", price: "Free" },
          { name: "Student", duration: "1 hour", price: "£5/hr" },
          { name: "WC1 Resident", duration: "1 hour", price: "£5/hr" },
          { name: "Visitor", duration: "1 hour", price: "£10/hr" },
        ],
      },
    },
    {
      name: "Islington Tennis Centre",
      slug: "islington-tennis-centre",
      bookingSystem: "better",
      bookingUrl: "https://bookings.better.org.uk/location/islington-tennis-centre/tennis-activities",
      location: "Market Road, London N7 9PL",
      metadata: {
        activity: "tennis-court-outdoor",
        venue: "islington-tennis-centre",
        deepLink: "https://bookings.better.org.uk/location/islington-tennis-centre/tennis-court-outdoor",
        activities: ["tennis-court-outdoor", "tennis-court-indoor"],
      },
    },
  ];

  console.log("Seeding courts...");

  for (const court of courts) {
    const existing = await prisma.court.findUnique({ where: { slug: court.slug } });
    if (existing) {
      console.log(`  Skipping ${court.name} (already exists)`);
      continue;
    }
    await prisma.court.create({ data: court });
    console.log(`  Created ${court.name}`);
  }

  console.log("Done!");
  await prisma.$disconnect();
}

main().catch(console.error);
