import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed JobSubmit.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const services = [
  { name: "Designing", slug: "designing", sortOrder: 10 },
  {
    name: "SAV / Sticker Printing",
    slug: "sav-sticker-printing",
    sortOrder: 20,
  },
  {
    name: "Flexi / Banner Printing",
    slug: "flexi-banner-printing",
    sortOrder: 30,
  },
  {
    name: "Document Printing",
    slug: "document-printing",
    sortOrder: 40,
  },
  {
    name: "For Sale Sticker Printing",
    slug: "for-sale-sticker-printing",
    sortOrder: 50,
  },
  {
    name: "Container Head Sticker / Batch Numbers Printing",
    slug: "container-head-sticker-batch-numbers-printing",
    sortOrder: 60,
  },
] as const;

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

  for (const service of services) {
    await prisma.service.upsert({
      where: {
        businessId_slug: {
          businessId: business.id,
          slug: service.slug,
        },
      },
      update: {
        name: service.name,
        sortOrder: service.sortOrder,
      },
      create: {
        businessId: business.id,
        name: service.name,
        slug: service.slug,
        sortOrder: service.sortOrder,
      },
    });
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
