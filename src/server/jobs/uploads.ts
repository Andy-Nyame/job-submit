import "server-only";

import { head } from "@vercel/blob";

import {
  CUSTOMER_UPLOAD_LIFETIME_MS,
  validateAttachmentBatch,
  validateAttachmentMetadata,
  validateCustomerUploadPath,
  type CustomerUploadReference,
} from "@/domain/job-attachments";
import type { ApplicationPrincipal } from "@/server/auth/provisioning";
import { prisma } from "@/server/db/prisma";

import { JobOperationError } from "./errors";

export async function reserveCustomerUpload(
  actor: ApplicationPrincipal,
  input: { originalFilename: string; uploadId: string },
) {
  const expiresAt = new Date(Date.now() + CUSTOMER_UPLOAD_LIFETIME_MS);
  try {
    return await prisma.customerUpload.create({
      data: {
        businessId: actor.businessId,
        expiresAt,
        id: input.uploadId,
        originalFilename: input.originalFilename,
        userId: actor.userId,
      },
    });
  } catch {
    throw new JobOperationError("ATTACHMENT_INVALID");
  }
}

export async function recordCompletedCustomerUpload(input: {
  byteSize: number;
  mimeType: string;
  pathname: string;
  uploadId: string;
}) {
  validateCustomerUploadPath(input.uploadId, input.pathname);
  const reservation = await prisma.customerUpload.findUnique({
    where: { id: input.uploadId },
    select: { originalFilename: true },
  });
  if (!reservation) {
    throw new JobOperationError("ATTACHMENT_UNAVAILABLE");
  }
  validateAttachmentMetadata({
    byteSize: input.byteSize,
    mimeType: input.mimeType,
    originalFilename: reservation.originalFilename,
  });

  const now = new Date();
  const updated = await prisma.customerUpload.updateMany({
    where: {
      expiresAt: { gt: now },
      id: input.uploadId,
      status: "PENDING",
    },
    data: {
      byteSize: BigInt(input.byteSize),
      mimeType: input.mimeType,
      status: "UPLOADED",
      storageKey: input.pathname,
      uploadedAt: now,
    },
  });
  if (updated.count === 1) {
    return;
  }

  const existing = await prisma.customerUpload.findUnique({
    where: { id: input.uploadId },
    select: { status: true, storageKey: true },
  });
  if (existing?.status !== "UPLOADED" || existing.storageKey !== input.pathname) {
    throw new JobOperationError("ATTACHMENT_UNAVAILABLE");
  }
}

export interface ResolvedCustomerUpload {
  byteSize: number;
  mimeType: string;
  originalFilename: string;
  pathname: string;
  uploadId: string;
}

export async function resolveCustomerUploads(
  actor: ApplicationPrincipal,
  references: readonly CustomerUploadReference[],
) {
  if (references.length === 0) {
    return [];
  }
  const ids = references.map((reference) => reference.uploadId);
  const reservations = await prisma.customerUpload.findMany({
    where: {
      businessId: actor.businessId,
      expiresAt: { gt: new Date() },
      id: { in: ids },
      status: { in: ["PENDING", "UPLOADED"] },
      userId: actor.userId,
    },
  });
  const reservationsById = new Map(
    reservations.map((reservation) => [reservation.id, reservation]),
  );

  const resolved = await Promise.all(
    references.map(async (reference): Promise<ResolvedCustomerUpload> => {
      const reservation = reservationsById.get(reference.uploadId);
      if (
        !reservation ||
        reservation.originalFilename !== reference.originalFilename ||
        (reservation.storageKey && reservation.storageKey !== reference.pathname)
      ) {
        throw new JobOperationError("ATTACHMENT_UNAVAILABLE");
      }
      validateCustomerUploadPath(reference.uploadId, reference.pathname);
      let blob;
      try {
        blob = await head(reference.pathname);
      } catch {
        throw new JobOperationError("ATTACHMENT_UNAVAILABLE");
      }
      if (blob.pathname !== reference.pathname) {
        throw new JobOperationError("ATTACHMENT_UNAVAILABLE");
      }
      try {
        const metadata = validateAttachmentMetadata({
          byteSize: blob.size,
          mimeType: blob.contentType,
          originalFilename: reservation.originalFilename,
        });
        return {
          ...metadata,
          pathname: blob.pathname,
          uploadId: reference.uploadId,
        };
      } catch {
        throw new JobOperationError("ATTACHMENT_INVALID");
      }
    }),
  );

  try {
    validateAttachmentBatch(resolved);
  } catch {
    throw new JobOperationError("ATTACHMENT_INVALID");
  }
  return resolved;
}
