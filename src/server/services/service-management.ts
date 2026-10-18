import "server-only";

import {
  assertCanManageServices,
  SERVICE_AUDIT_ACTIONS,
  serviceLifecycleAuditAction,
  ServicePolicyError,
  type ServiceSettingsInput,
  validateServiceSettings,
} from "@/domain/service-policy";
import { Prisma } from "@/generated/prisma/client";
import type { ApplicationPrincipal } from "@/server/auth/provisioning";
import { prisma } from "@/server/db/prisma";

import { ServiceOperationError } from "./errors";

const MAX_TRANSACTION_ATTEMPTS = 3;

function isRetryable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

function isUniqueConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function validateInput(input: ServiceSettingsInput) {
  try {
    return validateServiceSettings(input);
  } catch (error) {
    if (error instanceof ServicePolicyError) {
      throw new ServiceOperationError("VALIDATION");
    }
    throw error;
  }
}

async function mutateService<T>(
  actor: ApplicationPrincipal,
  work: (transaction: Prisma.TransactionClient) => Promise<T>,
) {
  assertCanManageServices(actor.role);

  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const business = await transaction.business.findFirst({
            where: {
              archivedAt: null,
              id: actor.businessId,
              isActive: true,
            },
            select: { id: true },
          });
          if (!business) {
            throw new ServiceOperationError("BUSINESS_UNAVAILABLE");
          }
          return work(transaction);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ServiceOperationError("DUPLICATE_SERVICE");
      }
      if (!isRetryable(error) || attempt === MAX_TRANSACTION_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  throw new ServiceOperationError("STALE_UPDATE");
}

function auditSnapshot(service: {
  defaultComplexity: string | null;
  defaultWorkloadClass: string | null;
  description: string | null;
  isActive: boolean;
  name: string;
  onlineSubmissionEnabled: boolean;
  proofRequiredByDefault: boolean | null;
  sortOrder: number;
}) {
  return {
    defaultComplexity: service.defaultComplexity,
    defaultWorkloadClass: service.defaultWorkloadClass,
    description: service.description,
    isActive: service.isActive,
    name: service.name,
    onlineSubmissionEnabled: service.onlineSubmissionEnabled,
    proofRequiredByDefault: service.proofRequiredByDefault,
    sortOrder: service.sortOrder,
  };
}

export async function createService(
  actor: ApplicationPrincipal,
  input: ServiceSettingsInput,
) {
  const settings = validateInput(input);

  return mutateService(actor, async (transaction) => {
    const conflict = await transaction.service.findFirst({
      where: {
        businessId: actor.businessId,
        OR: [
          { slug: settings.slug },
          { name: { equals: settings.name, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (conflict) {
      throw new ServiceOperationError("DUPLICATE_SERVICE");
    }

    const service = await transaction.service.create({
      data: {
        businessId: actor.businessId,
        defaultComplexity: settings.defaultComplexity,
        defaultWorkloadClass: settings.defaultWorkloadClass,
        description: settings.description,
        isActive: settings.isActive,
        name: settings.name,
        onlineSubmissionEnabled: settings.onlineSubmissionEnabled,
        proofRequiredByDefault: settings.proofRequiredByDefault,
        slug: settings.slug,
        sortOrder: settings.sortOrder,
      },
    });

    await transaction.auditLog.create({
      data: {
        action: SERVICE_AUDIT_ACTIONS.CREATED,
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        metadata: { service: auditSnapshot(service) },
        targetId: service.id,
        targetType: "Service",
      },
    });

    return service;
  });
}

export async function updateService(
  actor: ApplicationPrincipal,
  input: ServiceSettingsInput & {
    expectedVersion: number;
    serviceId: string;
  },
) {
  if (
    !input.serviceId ||
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion < 1
  ) {
    throw new ServiceOperationError("VALIDATION");
  }
  const settings = validateInput(input);

  return mutateService(actor, async (transaction) => {
    const current = await transaction.service.findFirst({
      where: {
        archivedAt: null,
        businessId: actor.businessId,
        id: input.serviceId,
      },
    });
    if (!current) {
      throw new ServiceOperationError("NOT_FOUND");
    }
    if (current.version !== input.expectedVersion) {
      throw new ServiceOperationError("STALE_UPDATE");
    }

    const conflict = await transaction.service.findFirst({
      where: {
        businessId: actor.businessId,
        id: { not: current.id },
        OR: [
          { slug: settings.slug },
          { name: { equals: settings.name, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (conflict) {
      throw new ServiceOperationError("DUPLICATE_SERVICE");
    }

    const before = auditSnapshot(current);
    const updatedSettings = { ...settings, isActive: current.isActive };
    const after = auditSnapshot(updatedSettings);
    if (JSON.stringify(before) === JSON.stringify(after)) {
      return current;
    }

    const updated = await transaction.service.updateMany({
      where: {
        archivedAt: null,
        businessId: actor.businessId,
        id: current.id,
        version: input.expectedVersion,
      },
      data: {
        defaultComplexity: updatedSettings.defaultComplexity,
        defaultWorkloadClass: updatedSettings.defaultWorkloadClass,
        description: updatedSettings.description,
        name: updatedSettings.name,
        onlineSubmissionEnabled: updatedSettings.onlineSubmissionEnabled,
        proofRequiredByDefault: updatedSettings.proofRequiredByDefault,
        sortOrder: updatedSettings.sortOrder,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new ServiceOperationError("STALE_UPDATE");
    }

    await transaction.auditLog.create({
      data: {
        action: SERVICE_AUDIT_ACTIONS.UPDATED,
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        metadata: { after, before },
        targetId: current.id,
        targetType: "Service",
      },
    });

    return transaction.service.findFirstOrThrow({
      where: { businessId: actor.businessId, id: current.id },
    });
  });
}

export async function setServiceActiveState(
  actor: ApplicationPrincipal,
  input: {
    active: boolean;
    expectedVersion: number;
    serviceId: string;
  },
) {
  if (
    !input.serviceId ||
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion < 1
  ) {
    throw new ServiceOperationError("VALIDATION");
  }

  return mutateService(actor, async (transaction) => {
    const service = await transaction.service.findFirst({
      where: {
        archivedAt: null,
        businessId: actor.businessId,
        id: input.serviceId,
      },
    });
    if (!service) {
      throw new ServiceOperationError("NOT_FOUND");
    }
    if (service.version !== input.expectedVersion) {
      throw new ServiceOperationError("STALE_UPDATE");
    }
    if (service.isActive === input.active) {
      return service;
    }

    const result = await transaction.service.updateMany({
      where: {
        archivedAt: null,
        businessId: actor.businessId,
        id: service.id,
        isActive: service.isActive,
        version: input.expectedVersion,
      },
      data: {
        isActive: input.active,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      throw new ServiceOperationError("STALE_UPDATE");
    }

    await transaction.auditLog.create({
      data: {
        action: serviceLifecycleAuditAction(input.active),
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        metadata: {
          fromActive: service.isActive,
          name: service.name,
          toActive: input.active,
        },
        targetId: service.id,
        targetType: "Service",
      },
    });

    return transaction.service.findFirstOrThrow({
      where: { businessId: actor.businessId, id: service.id },
    });
  });
}
