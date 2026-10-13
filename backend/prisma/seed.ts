import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const adminEmail = (
    process.env.ADMIN_EMAIL ?? "admin@eventplatform.com"
  ).toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin@12345";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: "Event Platform Admin",
      email: adminEmail,
      password: await bcrypt.hash(adminPassword, 12),
      role: "ADMIN",
    },
    select: { id: true, email: true, role: true },
  });
  console.log("Admin user ready:", admin);

  if (process.env.SEED_DEMO_DATA === "true") {
    const demoEmail = "demo@eventplatform.com";
    const password = await bcrypt.hash("Demo@12345", 12);

    const demoUser = await prisma.user.upsert({
      where: { email: demoEmail },
      update: {},
      create: {
        name: "Demo Customer",
        email: demoEmail,
        password,
        role: "CUSTOMER",
        age: 24,
        instagramUsername: "demo.customer",
      },
      select: { id: true },
    });

    const existingEvent = await prisma.event.findFirst({
      where: { title: "Sunset Rooftop Mixer" },
      select: { id: true },
    });

    if (!existingEvent) {
      await prisma.event.create({
        data: {
          title: "Sunset Rooftop Mixer",
          description:
            "An evening of music, conversations and new connections above the city skyline.",
          image:
            "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&q=80",
          date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
          startTime: "17:30",
          endTime: "22:00",
          venue: "Skyline Rooftop, Downtown",
          ticketPrice: 499,
          capacity: 50,
          status: "PUBLISHED",
        },
      });
      console.log("Demo event created");
    }

    console.log("Demo customer ready:", demoUser);
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
