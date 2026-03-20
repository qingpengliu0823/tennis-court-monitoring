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
        lat: 51.5268, lng: -0.1275,
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
        lat: 51.5513, lng: -0.1152,
        activity: "tennis-court-outdoor",
        venue: "islington-tennis-centre",
        deepLink: "https://bookings.better.org.uk/location/islington-tennis-centre/tennis-court-outdoor",
        activities: ["tennis-court-outdoor", "tennis-court-indoor"],
      },
    },
    // ClubSpark courts
    {
      name: "Finsbury Park Tennis",
      slug: "finsbury-park",
      bookingSystem: "clubspark",
      bookingUrl: "https://clubspark.lta.org.uk/FinsburyPark/Booking/BookByDate",
      location: "Finsbury Park, London N4 2DE",
      metadata: {
        lat: 51.5637, lng: -0.1052,
        venue: "FinsburyPark",
        deepLink: "https://clubspark.lta.org.uk/FinsburyPark/Booking/BookByDate",
        courts: 8, surface: "Hard", floodlit: true,
        pricing: { offPeak: "£4", peak: "£7" },
      },
    },
    // Disabled: requires ClubSpark login
    {
      name: "Paddington Recreation Ground",
      slug: "paddington-recreation-ground",
      bookingSystem: "clubspark",
      bookingUrl: "https://clubspark.lta.org.uk/PaddingtonRecreationGround/Booking/BookByDate",
      location: "Randolph Avenue, London W9 1PD",
      enabled: false,
      metadata: {
        lat: 51.5281, lng: -0.1828,
        venue: "PaddingtonRecreationGround",
        deepLink: "https://clubspark.lta.org.uk/PaddingtonRecreationGround/Booking/BookByDate",
        courts: 13, surface: "Tarmac & Synthetic", floodlit: true,
        pricing: { nonMember: "£8-10/hr" },
        note: "Requires ClubSpark login — cannot scrape anonymously",
      },
    },
    // Disabled: requires ClubSpark login
    {
      name: "Rosemary Gardens Tennis",
      slug: "rosemary-gardens",
      bookingSystem: "clubspark",
      bookingUrl: "https://clubspark.lta.org.uk/RosemaryGardens/Booking/BookByDate",
      location: "Southgate Road, London N1 3JP",
      enabled: false,
      metadata: {
        lat: 51.5396, lng: -0.0876,
        venue: "RosemaryGardens",
        deepLink: "https://clubspark.lta.org.uk/RosemaryGardens/Booking/BookByDate",
        courts: 2, surface: "Tarmac",
        note: "Requires ClubSpark login — cannot scrape anonymously",
      },
    },
    {
      name: "Clissold Park Tennis",
      slug: "clissold-park",
      bookingSystem: "clubspark",
      bookingUrl: "https://clubspark.lta.org.uk/ClissoldParkHackney/Booking/BookByDate",
      location: "Clissold Park, London N16 0BF",
      metadata: {
        lat: 51.5612, lng: -0.0823,
        venue: "ClissoldParkHackney",
        deepLink: "https://clubspark.lta.org.uk/ClissoldParkHackney/Booking/BookByDate",
        courts: 7, floodlit: true,
        pricing: { offPeak: "£4-5" },
      },
    },
    {
      name: "Hackney Downs Park Tennis",
      slug: "hackney-downs",
      bookingSystem: "clubspark",
      bookingUrl: "https://clubspark.lta.org.uk/HackneyDowns/Booking/BookByDate",
      location: "Hackney Downs, London N16",
      metadata: {
        lat: 51.5545, lng: -0.0574,
        venue: "HackneyDowns",
        deepLink: "https://clubspark.lta.org.uk/HackneyDowns/Booking/BookByDate",
        courts: 5, floodlit: true,
        pricing: { offPeak: "£4-5" },
      },
    },
    {
      name: "London Fields Tennis",
      slug: "london-fields",
      bookingSystem: "clubspark",
      bookingUrl: "https://clubspark.lta.org.uk/LondonFieldsPark/Booking/BookByDate",
      location: "London Fields, London E8",
      metadata: {
        lat: 51.5413, lng: -0.0596,
        venue: "LondonFieldsPark",
        deepLink: "https://clubspark.lta.org.uk/LondonFieldsPark/Booking/BookByDate",
        courts: 2, surface: "Porous Macadam",
        pricing: { adult: "£4.50/hr" },
      },
    },
    {
      name: "Geraldine Mary Harmsworth Park Tennis",
      slug: "geraldine-mary-harmsworth",
      bookingSystem: "clubspark",
      bookingUrl: "https://clubspark.lta.org.uk/GeraldineMaryHarmsworth/Booking/BookByDate",
      location: "St George's Road, London SE1 6HZ",
      metadata: {
        lat: 51.4978, lng: -0.1026,
        venue: "GeraldineMaryHarmsworth",
        deepLink: "https://clubspark.lta.org.uk/GeraldineMaryHarmsworth/Booking/BookByDate",
        courts: 2, floodlit: true, surface: "All-weather",
      },
    },
    // Disabled: Tennis In Lambeth requires ClubSpark login
    {
      name: "Archbishop's Park Tennis",
      slug: "archbishops-park",
      bookingSystem: "clubspark",
      bookingUrl: "https://clubspark.lta.org.uk/TennisInLambeth/Booking/BookByDate",
      location: "Lambeth Palace Road, London SE1 7LQ",
      enabled: false,
      metadata: {
        lat: 51.4984, lng: -0.1149,
        venue: "TennisInLambeth",
        deepLink: "https://clubspark.lta.org.uk/TennisInLambeth/Booking/BookByDate",
        courts: 2, surface: "Tarmac",
        note: "Requires ClubSpark login — cannot scrape anonymously",
      },
    },
    // Disabled: Tennis In Lambeth requires ClubSpark login
    {
      name: "Kennington Park Tennis",
      slug: "kennington-park",
      bookingSystem: "clubspark",
      bookingUrl: "https://clubspark.lta.org.uk/TennisInLambeth/Booking/BookByDate",
      location: "Kennington Park Road, London SE11 4BE",
      enabled: false,
      metadata: {
        lat: 51.4856, lng: -0.1077,
        venue: "TennisInLambeth",
        deepLink: "https://clubspark.lta.org.uk/TennisInLambeth/Booking/BookByDate",
        courts: 4, surface: "Tarmac", floodlit: true,
        note: "Requires ClubSpark login — cannot scrape anonymously",
      },
    },
    {
      name: "Spring Hill Tennis",
      slug: "spring-hill",
      bookingSystem: "clubspark",
      bookingUrl: "https://clubspark.lta.org.uk/SpringHillParkTennis/Booking/BookByDate",
      location: "Spring Hill, Hackney, London",
      metadata: {
        lat: 51.5505, lng: -0.0530,
        venue: "SpringHillParkTennis",
        deepLink: "https://clubspark.lta.org.uk/SpringHillParkTennis/Booking/BookByDate",
        courts: 2, surface: "Tarmac",
        pricing: { adult: "£3.90/hr" },
      },
    },
    {
      name: "Elthorne Tennis Club",
      slug: "elthorne-tennis",
      bookingSystem: "clubspark",
      bookingUrl: "https://clubspark.lta.org.uk/ElthorneTennis/Booking/BookByDate",
      location: "Elthorne Park, Haringey, London",
      metadata: {
        lat: 51.5770, lng: -0.1289,
        venue: "ElthorneTennis",
        deepLink: "https://clubspark.lta.org.uk/ElthorneTennis/Booking/BookByDate",
        courts: 3, floodlit: true,
        pricing: { nonMember: "£8.70/hr", floodlit: "£11.70/hr" },
      },
    },
    // Millfields Park removed — ClubSpark URL returns 404
    {
      name: "Southwark Park Tennis",
      slug: "southwark-park",
      bookingSystem: "clubspark",
      bookingUrl: "https://clubspark.lta.org.uk/SouthwarkPark/Booking/BookByDate",
      location: "Jamaica Gate entrance, London SE16",
      metadata: {
        lat: 51.4929, lng: -0.0565,
        venue: "SouthwarkPark",
        deepLink: "https://clubspark.lta.org.uk/SouthwarkPark/Booking/BookByDate",
        courts: 4, surface: "Tarmac",
      },
    },
    {
      name: "Clapham Common Tennis",
      slug: "clapham-common",
      bookingSystem: "clubspark",
      bookingUrl: "https://clubspark.lta.org.uk/claphamcommon/Booking/BookByDate",
      location: "Windmill Drive, London SW4 9AN",
      metadata: {
        lat: 51.4600, lng: -0.1580,
        venue: "claphamcommon",
        deepLink: "https://clubspark.lta.org.uk/claphamcommon/Booking/BookByDate",
        courts: 8, floodlit: true,
      },
    },
    // Tower Hamlets courts (migrated from Courtside to ClubSpark)
    {
      name: "Bethnal Green Gardens Tennis",
      slug: "bethnal-green-gardens",
      bookingSystem: "clubspark",
      bookingUrl: "https://clubspark.lta.org.uk/BethnalGreenGardens/Booking/BookByDate",
      location: "Malcolm Place, London E2 0EU",
      metadata: {
        lat: 51.5280, lng: -0.0625,
        venue: "BethnalGreenGardens",
        deepLink: "https://clubspark.lta.org.uk/BethnalGreenGardens/Booking/BookByDate",
        courts: 4, surface: "Hard", floodlit: true,
        pricing: { adult: "£4-6" },
      },
    },
    {
      name: "King Edward Memorial Park Tennis",
      slug: "king-edward-memorial",
      bookingSystem: "clubspark",
      bookingUrl: "https://clubspark.lta.org.uk/KingEdwardMemorialPark/Booking/BookByDate",
      location: "Glamis Road, London E1W 3TD",
      metadata: {
        lat: 51.5087, lng: -0.0467,
        venue: "KingEdwardMemorialPark",
        deepLink: "https://clubspark.lta.org.uk/KingEdwardMemorialPark/Booking/BookByDate",
        courts: 4, surface: "Porous Macadam",
        pricing: { adult: "£4-6" },
      },
    },
    // Disabled: requires ClubSpark login
    {
      name: "St John's Park Tennis",
      slug: "st-johns-park",
      bookingSystem: "clubspark",
      bookingUrl: "https://clubspark.lta.org.uk/StJohnsPark/Booking/BookByDate",
      location: "Plevna Street, Tower Hamlets, London",
      enabled: false,
      metadata: {
        lat: 51.5166, lng: -0.0270,
        venue: "StJohnsPark",
        deepLink: "https://clubspark.lta.org.uk/StJohnsPark/Booking/BookByDate",
        courts: 2, floodlit: true,
        pricing: { offPeak: "£4", peak: "£6" },
        note: "Requires ClubSpark login — cannot scrape anonymously",
      },
    },
    // Disabled: requires ClubSpark login (Better URL defunct)
    {
      name: "Highbury Fields Tennis",
      slug: "highbury-fields",
      bookingSystem: "clubspark",
      bookingUrl: "https://clubspark.lta.org.uk/HighburyFieldsLondon/Booking/BookByDate",
      location: "Highbury Fields, London N5",
      enabled: false,
      metadata: {
        lat: 51.5510, lng: -0.0980,
        venue: "HighburyFieldsLondon",
        deepLink: "https://clubspark.lta.org.uk/HighburyFieldsLondon/Booking/BookByDate",
        courts: 11, surface: "Tarmac", floodlit: true,
        note: "Requires ClubSpark login — cannot scrape anonymously",
      },
    },
    // Camden Active courts
    {
      name: "Lincoln's Inn Fields Tennis",
      slug: "lincolns-inn-fields",
      bookingSystem: "camden_active",
      bookingUrl: "https://camdenactive.camden.gov.uk/sports/lincolnsinnfields/",
      location: "Gate opposite Royal College of Surgeons, London WC2A",
      metadata: {
        lat: 51.5154, lng: -0.1176,
        venue: "lincolnsinnfields",
        deepLink: "https://camdenactive.camden.gov.uk/sports/lincolnsinnfields/",
        courts: 3, surface: "Tarmac",
        pricing: { standard: "£13.90", seniors: "£5.55", under16: "£5.55" },
        courtPages: [
          { id: 171, slug: "lincoln-s-inn-fields-tennis-court-1" },
          { id: 176, slug: "lincoln-s-inn-fields-tennis-court-2" },
          { id: 177, slug: "lincoln-s-inn-fields-tennis-court-3" },
        ],
      },
    },
    {
      name: "Waterlow Park Tennis",
      slug: "waterlow-park",
      bookingSystem: "camden_active",
      bookingUrl: "https://camdenactive.camden.gov.uk/sports/waterlow/",
      location: "Swains Lane / Highgate Hill, London N6",
      metadata: {
        lat: 51.5674, lng: -0.1449,
        venue: "waterlow",
        deepLink: "https://camdenactive.camden.gov.uk/sports/waterlow/",
        courts: 6, surface: "Tarmac",
        pricing: { standard: "£10.45", seniors: "£5.55", under16: "£5.55" },
        courtPages: [
          { id: 187, slug: "waterlow-park-tennis-court-1" },
          { id: 188, slug: "waterlow-park-tennis-court-2" },
          { id: 190, slug: "waterlow-park-tennis-court-3" },
          { id: 191, slug: "waterlow-park-tennis-court-4" },
          { id: 192, slug: "waterlow-park-tennis-court-5" },
          { id: 193, slug: "waterlow-park-tennis-court-6" },
        ],
      },
    },
    {
      name: "Kilburn Grange Park Tennis",
      slug: "kilburn-grange-park",
      bookingSystem: "camden_active",
      bookingUrl: "https://camdenactive.camden.gov.uk/sport/kilburngrange/",
      location: "Messina Avenue, London NW6",
      metadata: {
        lat: 51.5446, lng: -0.1959,
        venue: "kilburngrange",
        deepLink: "https://camdenactive.camden.gov.uk/sport/kilburngrange/",
        courts: 3, surface: "Tarmac",
        pricing: { standard: "£10.45", seniors: "£5.55", under16: "£5.55" },
        courtPages: [
          { id: 178, slug: "kilburn-grange-tennis-court-1" },
          { id: 179, slug: "kilburn-grange-tennis-court-2" },
          { id: 183, slug: "kilburn-grange-tennis-court-3" },
        ],
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
