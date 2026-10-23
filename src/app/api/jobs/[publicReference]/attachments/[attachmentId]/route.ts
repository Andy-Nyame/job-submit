import { get } from "@vercel/blob";

import { isUuid } from "@/domain/job-attachments";
import { canManageStaffJobs } from "@/domain/staff-job-policy";
import { requireBusinessMembership } from "@/server/auth/authorization";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function contentDisposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7E]/gu, "_").replace(/["\\]/gu, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ attachmentId: string; publicReference: string }> },
) {
  try {
    const actor = await requireBusinessMembership();
    const { attachmentId, publicReference } = await context.params;
    const customer = actor.role === "CUSTOMER";
    if (
      (!customer && !canManageStaffJobs(actor.role)) ||
      !isUuid(attachmentId) ||
      publicReference.length > 32
    ) {
      return new Response("Not found", { status: 404 });
    }
    const attachment = await prisma.jobAttachment.findFirst({
      where: {
        businessId: actor.businessId,
        id: attachmentId,
        job: {
          archivedAt: null,
          publicReference,
          ...(customer ? { customer: { userId: actor.userId } } : {}),
        },
        removedAt: null,
      },
      select: { mimeType: true, originalFilename: true, storageKey: true },
    });
    if (!attachment) {
      return new Response("Not found", { status: 404 });
    }
    const blob = await get(attachment.storageKey, { access: "private" });
    if (!blob || blob.statusCode !== 200) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(blob.stream, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDisposition(attachment.originalFilename),
        "Content-Type": attachment.mimeType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
