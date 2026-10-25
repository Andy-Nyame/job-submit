import { get } from "@vercel/blob";

import { isUuid } from "@/domain/job-attachments";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ imageId: string }> }) {
  try {
    const { imageId } = await context.params;
    if (!isUuid(imageId)) return new Response("Not found", { status: 404 });
    const image = await prisma.serviceImage.findFirst({
      where: {
        business: { archivedAt: null, isActive: true, slug: "capt-bob-cedis-artworks" },
        id: imageId,
        service: { archivedAt: null },
        status: "READY",
      },
      select: { mimeType: true, storageKey: true },
    });
    if (!image?.storageKey || !image.mimeType) return new Response("Not found", { status: 404 });
    const blob = await get(image.storageKey, { access: "private" });
    if (!blob || blob.statusCode !== 200 || !blob.stream) return new Response("Not found", { status: 404 });
    return new Response(blob.stream, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        "Content-Type": image.mimeType,
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
