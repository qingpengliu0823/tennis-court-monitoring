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
      name: "Clissold Park",
      slug: "clissold-park",
      bookingSystem: "localtenniscourts",
      bookingUrl: "https://www.localtenniscourts.com/london",
      venueId: "clissold-park",
      location: "Clissold Park, Stoke Newington, London N16",
      metadata: { venueId: 1, deepLink: "https://clubspark.lta.org.uk/ClissoldParkHackney/Booking/BookByDate" },
    },
    {
      name: "Highbury Fields",
      slug: "highbury-fields",
      bookingSystem: "localtenniscourts",
      bookingUrl: "https://www.localtenniscourts.com/london",
      location: "Highbury Fields, London N5",
      metadata: { venueId: 2, deepLink: "https://clubspark.lta.org.uk/HighburyFieldsLondon" },
    },
    {
      name: "London Fields",
      slug: "london-fields",
      bookingSystem: "localtenniscourts",
      bookingUrl: "https://www.localtenniscourts.com/london",
      location: "London Fields, Hackney, London E8",
      metadata: { venueId: 3, deepLink: "https://clubspark.lta.org.uk/LondonFieldsPark/Booking/BookByDate" },
    },
    {
      name: "Finsbury Park",
      slug: "finsbury-park",
      bookingSystem: "localtenniscourts",
      bookingUrl: "https://www.localtenniscourts.com/london",
      location: "Finsbury Park, London N4",
      metadata: { venueId: 4, deepLink: "https://clubspark.lta.org.uk/FinsburyPark/Booking/BookByDate" },
    },
    {
      name: "Regent's Park",
      slug: "regents-park",
      bookingSystem: "localtenniscourts",
      bookingUrl: "https://www.localtenniscourts.com/london",
      location: "Regent's Park, London NW1",
      metadata: { venueId: 5, deepLink: "https://clubspark.lta.org.uk/RegentsPark" },
    },
    {
      name: "Hyde Park",
      slug: "hyde-park",
      bookingSystem: "localtenniscourts",
      bookingUrl: "https://www.localtenniscourts.com/london",
      location: "Hyde Park, London W2",
      metadata: { venueId: 6, deepLink: "https://clubspark.lta.org.uk/HydePark" },
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
