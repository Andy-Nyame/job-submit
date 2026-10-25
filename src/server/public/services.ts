import "server-only";

import { prisma } from "@/server/db/prisma";

export interface PublicService {
  description: string | null;
  name: string;
  images?: { altText: string; id: string; isCover: boolean }[];
  onlineSubmissionEnabled: boolean;
  pricingConfiguration: unknown;
  quantityConfiguration: unknown;
  slug: string;
  specificationConfiguration: unknown;
}

export type PublicServicesResult =
  | { services: PublicService[]; status: "ready" }
  | { status: "unavailable" };

export async function getActivePublicServices(): Promise<PublicServicesResult> {
  try {
    const business = await prisma.business.findUnique({
      where: { slug: "capt-bob-cedis-artworks" },
      select: {
        archivedAt: true,
        isActive: true,
        services: {
          where: { archivedAt: null, isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            description: true,
            images: {
              where: { status: "READY" },
              orderBy: [{ isCover: "desc" }, { displayOrder: "asc" }, { createdAt: "asc" }],
              select: { altText: true, id: true, isCover: true },
            },
            name: true,
            onlineSubmissionEnabled: true,
            pricingConfiguration: true,
            quantityConfiguration: true,
            slug: true,
            specificationConfiguration: true,
          },
        },
      },
    });

    if (!business?.isActive || business.archivedAt) {
      return { status: "unavailable" };
    }

    return { services: business.services, status: "ready" };
  } catch {
    console.warn("The public service catalogue is temporarily unavailable.");
    return { status: "unavailable" };
  }
}
