import "server-only";

import { prisma } from "@/server/db/prisma";

export interface PublicService {
  description: string | null;
  name: string;
  slug: string;
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
          select: { description: true, name: true, slug: true },
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
