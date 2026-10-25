import "server-only";

import { del, get, head } from "@vercel/blob";

import {
  MAX_SERVICE_IMAGES,
  SERVICE_IMAGE_UPLOAD_LIFETIME_MS,
  normalizeServiceImageAltText,
  validateServiceImageMetadata,
  validateServiceImagePath,
  validateServiceImageSignature,
} from "@/domain/service-images";
import { Prisma } from "@/generated/prisma/client";
import type { ApplicationPrincipal } from "@/server/auth/provisioning";
import { prisma } from "@/server/db/prisma";

export class ServiceImageOperationError extends Error {
  constructor(
    public readonly code:
      | "BUSINESS_UNAVAILABLE"
      | "FILE_INVALID"
      | "GALLERY_FULL"
      | "NOT_FOUND"
      | "STALE_UPDATE",
  ) {
    super(code);
    this.name = "ServiceImageOperationError";
  }
}

function assertManager(actor: ApplicationPrincipal) {
  if (actor.role !== "OWNER" && actor.role !== "ADMIN") {
    throw new ServiceImageOperationError("NOT_FOUND");
  }
}

async function activeManager(
  transaction: Prisma.TransactionClient,
  actor: Pick<ApplicationPrincipal, "businessId" | "membershipId" | "userId">,
) {
  return transaction.businessMembership.findFirst({
    where: {
      business: { archivedAt: null, isActive: true },
      businessId: actor.businessId,
      deactivatedAt: null,
      id: actor.membershipId,
      role: { in: ["OWNER", "ADMIN"] },
      status: "ACTIVE",
      user: { deactivatedAt: null, id: actor.userId },
    },
    select: { id: true },
  });
}

export async function reserveServiceImage(
  actor: ApplicationPrincipal,
  input: {
    altText: string;
    imageId: string;
    originalFilename: string;
    replacesImageId?: string | null;
    serviceId: string;
  },
) {
  assertManager(actor);
  const altText = normalizeServiceImageAltText(input.altText);
  const expiresAt = new Date(Date.now() + SERVICE_IMAGE_UPLOAD_LIFETIME_MS);

  return prisma.$transaction(async (transaction) => {
    await transaction.serviceImage.updateMany({
      where: {
        businessId: actor.businessId,
        expiresAt: { lte: new Date() },
        serviceId: input.serviceId,
        status: "PENDING",
      },
      data: { isCover: false, status: "EXPIRED" },
    });
    const [manager, service, imageCount, lastImage] = await Promise.all([
      activeManager(transaction, actor),
      transaction.service.findFirst({
        where: { archivedAt: null, businessId: actor.businessId, id: input.serviceId },
        select: { id: true },
      }),
      transaction.serviceImage.count({
        where: {
          businessId: actor.businessId,
          serviceId: input.serviceId,
          status: { in: ["PENDING", "READY"] },
        },
      }),
      transaction.serviceImage.findFirst({
        where: { businessId: actor.businessId, serviceId: input.serviceId, status: "READY" },
        orderBy: { displayOrder: "desc" },
        select: { displayOrder: true },
      }),
    ]);
    if (!manager || !service) throw new ServiceImageOperationError("NOT_FOUND");
    if (!input.replacesImageId && imageCount >= MAX_SERVICE_IMAGES) {
      throw new ServiceImageOperationError("GALLERY_FULL");
    }
    if (input.replacesImageId) {
      const replaced = await transaction.serviceImage.findFirst({
        where: {
          businessId: actor.businessId,
          id: input.replacesImageId,
          serviceId: input.serviceId,
          status: "READY",
        },
        select: { id: true },
      });
      if (!replaced) throw new ServiceImageOperationError("NOT_FOUND");
    }
    return transaction.serviceImage.create({
      data: {
        altText,
        businessId: actor.businessId,
        displayOrder: (lastImage?.displayOrder ?? -1) + 1,
        expiresAt,
        id: input.imageId,
        originalFilename: input.originalFilename,
        replacesImageId: input.replacesImageId || null,
        serviceId: input.serviceId,
        uploadedByMembershipId: actor.membershipId,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function completeServiceImageUpload(input: {
  businessId: string;
  imageId: string;
  membershipId: string;
  pathname: string;
  serviceId: string;
  userId: string;
}) {
  validateServiceImagePath(input.imageId, input.pathname);
  const pending = await prisma.serviceImage.findFirst({
    where: {
      businessId: input.businessId,
      expiresAt: { gt: new Date() },
      id: input.imageId,
      serviceId: input.serviceId,
      status: "PENDING",
      uploadedByMembershipId: input.membershipId,
    },
    select: { originalFilename: true },
  });
  if (!pending) throw new ServiceImageOperationError("NOT_FOUND");

  try {
    const metadata = await head(input.pathname);
    validateServiceImageMetadata({
      byteSize: metadata.size,
      mimeType: metadata.contentType,
      originalFilename: pending.originalFilename,
    });
    const blob = await get(input.pathname, { access: "private", useCache: false });
    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      throw new ServiceImageOperationError("FILE_INVALID");
    }
    const bytes = new Uint8Array(await new Response(blob.stream).arrayBuffer());
    validateServiceImageSignature(bytes, metadata.contentType);

    let replacedStorageKey: string | null = null;
    await prisma.$transaction(async (transaction) => {
      const actor = {
        businessId: input.businessId,
        membershipId: input.membershipId,
        userId: input.userId,
      };
      const [manager, image, readyCount] = await Promise.all([
        activeManager(transaction, actor),
        transaction.serviceImage.findFirst({
          where: {
            businessId: input.businessId,
            expiresAt: { gt: new Date() },
            id: input.imageId,
            serviceId: input.serviceId,
            status: "PENDING",
          },
        }),
        transaction.serviceImage.count({
          where: { businessId: input.businessId, serviceId: input.serviceId, status: "READY" },
        }),
      ]);
      if (!manager || !image) throw new ServiceImageOperationError("NOT_FOUND");

      let displayOrder = image.displayOrder;
      let isCover = readyCount === 0;
      if (image.replacesImageId) {
        const replaced = await transaction.serviceImage.findFirst({
          where: {
            businessId: input.businessId,
            id: image.replacesImageId,
            serviceId: input.serviceId,
            status: "READY",
          },
        });
        if (!replaced) throw new ServiceImageOperationError("STALE_UPDATE");
        displayOrder = replaced.displayOrder;
        isCover = replaced.isCover;
        replacedStorageKey = replaced.storageKey;
        await transaction.serviceImage.update({
          where: { id: replaced.id },
          data: {
            isCover: false,
            removedAt: new Date(),
            removedByMembershipId: input.membershipId,
            status: "REMOVED",
          },
        });
      }
      if (isCover) {
        await transaction.serviceImage.updateMany({
          where: { businessId: input.businessId, serviceId: input.serviceId, status: "READY" },
          data: { isCover: false },
        });
      }
      await transaction.serviceImage.update({
        where: { id: image.id },
        data: {
          byteSize: BigInt(metadata.size),
          displayOrder,
          isCover,
          mimeType: metadata.contentType,
          status: "READY",
          storageKey: metadata.pathname,
          uploadedAt: new Date(),
        },
      });
      await transaction.auditLog.create({
        data: {
          action: image.replacesImageId ? "service.image_replaced" : "service.image_added",
          actorMembershipId: input.membershipId,
          actorUserId: input.userId,
          businessId: input.businessId,
          metadata: { altText: image.altText, replacedImageId: image.replacesImageId },
          targetId: image.id,
          targetType: "ServiceImage",
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (replacedStorageKey) await del(replacedStorageKey).catch(() => undefined);
  } catch (error) {
    await del(input.pathname).catch(() => undefined);
    await prisma.serviceImage.updateMany({
      where: { id: input.imageId, status: "PENDING" },
      data: { isCover: false, status: "EXPIRED" },
    });
    throw error;
  }
}

export async function updateServiceGallery(
  actor: ApplicationPrincipal,
  input:
    | { imageId: string; operation: "COVER"; serviceId: string }
    | { imageId: string; operation: "REMOVE"; serviceId: string }
    | { imageIds: string[]; operation: "REORDER"; serviceId: string },
) {
  assertManager(actor);
  let removedStorageKey: string | null = null;
  await prisma.$transaction(async (transaction) => {
    const manager = await activeManager(transaction, actor);
    if (!manager) throw new ServiceImageOperationError("NOT_FOUND");
    const images = await transaction.serviceImage.findMany({
      where: { businessId: actor.businessId, serviceId: input.serviceId, status: "READY" },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });
    if (input.operation === "REORDER") {
      const expected = new Set(images.map((image) => image.id));
      if (input.imageIds.length !== images.length || input.imageIds.some((id) => !expected.delete(id)) || expected.size) {
        throw new ServiceImageOperationError("STALE_UPDATE");
      }
      await Promise.all(input.imageIds.map((id, displayOrder) => transaction.serviceImage.update({ where: { id }, data: { displayOrder } })));
      await transaction.auditLog.create({
        data: { action: "service.images_reordered", actorMembershipId: actor.membershipId, actorUserId: actor.userId, businessId: actor.businessId, metadata: { imageIds: input.imageIds }, targetId: input.serviceId, targetType: "Service" },
      });
      return;
    }

    const image = images.find((candidate) => candidate.id === input.imageId);
    if (!image) throw new ServiceImageOperationError("NOT_FOUND");
    if (input.operation === "COVER") {
      if (image.isCover) return;
      await transaction.serviceImage.updateMany({ where: { businessId: actor.businessId, serviceId: input.serviceId, status: "READY" }, data: { isCover: false } });
      await transaction.serviceImage.update({ where: { id: image.id }, data: { isCover: true } });
      await transaction.auditLog.create({
        data: { action: "service.image_cover_selected", actorMembershipId: actor.membershipId, actorUserId: actor.userId, businessId: actor.businessId, metadata: { imageId: image.id }, targetId: input.serviceId, targetType: "Service" },
      });
      return;
    }

    removedStorageKey = image.storageKey;
    await transaction.serviceImage.update({
      where: { id: image.id },
      data: { isCover: false, removedAt: new Date(), removedByMembershipId: actor.membershipId, status: "REMOVED" },
    });
    if (image.isCover) {
      const replacement = images.find((candidate) => candidate.id !== image.id);
      if (replacement) await transaction.serviceImage.update({ where: { id: replacement.id }, data: { isCover: true } });
    }
    await transaction.auditLog.create({
      data: { action: "service.image_removed", actorMembershipId: actor.membershipId, actorUserId: actor.userId, businessId: actor.businessId, metadata: { altText: image.altText }, targetId: image.id, targetType: "ServiceImage" },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (removedStorageKey) await del(removedStorageKey).catch(() => undefined);
}
