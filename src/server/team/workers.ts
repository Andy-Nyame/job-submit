import "server-only";

import {
  assertCanManageWorkers,
  validateWorkerCapacity,
} from "@/domain/team-policy";
import { Prisma } from "@/generated/prisma/client";
import type { ApplicationPrincipal } from "@/server/auth/provisioning";
import { prisma } from "@/server/db/prisma";

import { TeamOperationError } from "./errors";

const MAX_TRANSACTION_ATTEMPTS = 3;

function isRetryable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

async function mutateWorker<T>(
  actor: ApplicationPrincipal,
  work: (transaction: Prisma.TransactionClient) => Promise<T>,
) {
  assertCanManageWorkers(actor.role);

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
            throw new TeamOperationError("BLOCKED_ACCOUNT");
          }
          return work(transaction);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (!isRetryable(error) || attempt === MAX_TRANSACTION_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  throw new TeamOperationError("STALE_UPDATE");
}

function normalizeDisplayName(value: string) {
  const displayName = value.trim().replace(/\s+/g, " ");
  if (displayName.length < 2 || displayName.length > 160) {
    throw new TeamOperationError("VALIDATION");
  }
  return displayName;
}

export async function updateWorkerSettings(
  actor: ApplicationPrincipal,
  input: {
    canTakeFocus: boolean;
    displayName: string;
    expectedProfileVersion: number;
    maxQuickWorkload: number;
    maxStandardWorkload: number;
    membershipId: string;
    serviceIds: readonly string[];
  },
) {
  const displayName = normalizeDisplayName(input.displayName);
  const capacities = validateWorkerCapacity({
    canTakeFocus: input.canTakeFocus,
    maxQuickWorkload: input.maxQuickWorkload,
    maxStandardWorkload: input.maxStandardWorkload,
  });
  const serviceIds = [...new Set(input.serviceIds)];
  if (serviceIds.length > 6 || input.expectedProfileVersion < 1) {
    throw new TeamOperationError("VALIDATION");
  }

  return mutateWorker(actor, async (transaction) => {
    const membership = await transaction.businessMembership.findFirst({
      where: {
        businessId: actor.businessId,
        id: input.membershipId,
        role: "WORKER",
      },
      include: { user: true, workerProfile: { include: { skills: true } } },
    });
    const profile = membership?.workerProfile;
    if (!membership || !profile || profile.archivedAt) {
      throw new TeamOperationError("NOT_FOUND");
    }

    const services = await transaction.service.findMany({
      where: {
        archivedAt: null,
        businessId: actor.businessId,
        id: { in: serviceIds },
        isActive: true,
      },
      select: { id: true },
    });
    if (services.length !== serviceIds.length) {
      throw new TeamOperationError("VALIDATION");
    }

    const updated = await transaction.workerProfile.updateMany({
      where: {
        businessId: actor.businessId,
        id: profile.id,
        version: input.expectedProfileVersion,
      },
      data: { ...capacities, version: { increment: 1 } },
    });
    if (updated.count !== 1) {
      throw new TeamOperationError("STALE_UPDATE");
    }

    if (membership.user.displayName !== displayName) {
      await transaction.user.update({
        where: { id: membership.userId },
        data: { displayName },
      });
    }

    await transaction.workerServiceSkill.updateMany({
      where: {
        businessId: actor.businessId,
        serviceId: { notIn: serviceIds },
        workerProfileId: profile.id,
      },
      data: { deactivatedAt: new Date(), isActive: false },
    });

    for (const serviceId of serviceIds) {
      await transaction.workerServiceSkill.upsert({
        where: {
          workerProfileId_serviceId: {
            serviceId,
            workerProfileId: profile.id,
          },
        },
        update: { deactivatedAt: null, isActive: true },
        create: {
          businessId: actor.businessId,
          serviceId,
          workerProfileId: profile.id,
        },
      });
    }

    const priorActiveSkills = profile.skills.filter(
      (skill) => skill.isActive,
    ).length;
    await transaction.auditLog.create({
      data: {
        action: "team.worker.settings_updated",
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        metadata: {
          displayNameChanged: membership.user.displayName !== displayName,
          from: {
            canTakeFocus: profile.canTakeFocus,
            maxQuickWorkload: profile.maxQuickWorkload,
            maxStandardWorkload: profile.maxStandardWorkload,
            skillCount: priorActiveSkills,
          },
          to: { ...capacities, skillCount: serviceIds.length },
        },
        targetId: profile.id,
        targetType: "WorkerProfile",
      },
    });
  });
}

export async function setWorkerActiveState(
  actor: ApplicationPrincipal,
  input: {
    active: boolean;
    expectedMembershipVersion: number;
    expectedProfileVersion: number;
    membershipId: string;
  },
) {
  if (
    input.expectedMembershipVersion < 1 ||
    input.expectedProfileVersion < 1
  ) {
    throw new TeamOperationError("VALIDATION");
  }

  return mutateWorker(actor, async (transaction) => {
    const membership = await transaction.businessMembership.findFirst({
      where: {
        businessId: actor.businessId,
        id: input.membershipId,
        role: "WORKER",
      },
      include: { user: true, workerProfile: true },
    });
    const profile = membership?.workerProfile;
    if (!membership || !profile || profile.archivedAt) {
      throw new TeamOperationError("NOT_FOUND");
    }
    if (input.active && membership.user.deactivatedAt) {
      throw new TeamOperationError("BLOCKED_ACCOUNT");
    }
    const currentlyConfiguredActive =
      membership.status === "ACTIVE" &&
      !membership.deactivatedAt &&
      profile.isActive;
    if (currentlyConfiguredActive === input.active) {
      return;
    }

    const membershipUpdate = await transaction.businessMembership.updateMany({
      where: {
        businessId: actor.businessId,
        id: membership.id,
        version: input.expectedMembershipVersion,
      },
      data: input.active
        ? {
            deactivatedAt: null,
            status: "ACTIVE",
            version: { increment: 1 },
          }
        : {
            deactivatedAt: new Date(),
            status: "INACTIVE",
            version: { increment: 1 },
          },
    });
    const profileUpdate = await transaction.workerProfile.updateMany({
      where: {
        businessId: actor.businessId,
        id: profile.id,
        version: input.expectedProfileVersion,
      },
      data: { isActive: input.active, version: { increment: 1 } },
    });
    if (membershipUpdate.count !== 1 || profileUpdate.count !== 1) {
      throw new TeamOperationError("STALE_UPDATE");
    }

    await transaction.auditLog.create({
      data: {
        action: input.active
          ? "team.worker.activated"
          : "team.worker.deactivated",
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        metadata: {
          fromMembershipStatus: membership.status,
          fromProfileActive: profile.isActive,
        },
        targetId: membership.id,
        targetType: "BusinessMembership",
      },
    });
  });
}
