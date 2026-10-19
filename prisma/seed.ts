import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  SEEDED_SERVICES,
  shouldReconcileSeededServiceName,
} from "../src/domain/service-seed";

config({ path: [".env.local", ".env"], quiet: true });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed JobSubmit.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const business = await prisma.business.upsert({
    where: { slug: "capt-bob-cedis-artworks" },
    update: {
      name: "Capt. Bob Cedi’s Artworks",
      defaultCurrency: "GHS",
      isActive: true,
      archivedAt: null,
    },
    create: {
      name: "Capt. Bob Cedi’s Artworks",
      slug: "capt-bob-cedis-artworks",
      defaultCurrency: "GHS",
    },
  });

  for (const service of SEEDED_SERVICES) {
    const existing = await prisma.service.findUnique({
      where: {
        businessId_slug: { businessId: business.id, slug: service.slug },
      },
      select: { id: true, name: true },
    });

    if (!existing) {
      await prisma.service.create({
        data: {
          businessId: business.id,
          name: service.name,
          slug: service.slug,
          sortOrder: service.sortOrder,
        },
      });
    } else if (shouldReconcileSeededServiceName(existing.name, service)) {
      await prisma.service.update({
        where: { id: existing.id },
        data: { name: service.name, version: { increment: 1 } },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
