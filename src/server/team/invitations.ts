import "server-only";

import {
  assertCanManageWorkers,
  assertInvitationAvailable,
  assertInvitationIdentity,
  isInvitationTokenShape,
  isValidInvitationEmail,
  normalizeInvitationEmail,
  resolveInvitedMembershipRole,
  WORKER_INVITATION_LIFETIME_MS,
} from "@/domain/team-policy";
import { getBootstrapRole } from "@/domain/auth-policy";
import { Prisma } from "@/generated/prisma/client";
import type { ApplicationPrincipal } from "@/server/auth/provisioning";
import { prisma } from "@/server/db/prisma";

import { TeamOperationError } from "./errors";
import {
  createWorkerInvitationToken,
  hashWorkerInvitationToken,
  workerInvitationPath,
} from "./tokens";

const MAX_TRANSACTION_ATTEMPTS = 3;

function isRetryable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034")
  );
}

async function serializable<T>(
  work: (transaction: Prisma.TransactionClient) => Promise<T>,
) {
  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isRetryable(error) || attempt === MAX_TRANSACTION_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  throw new TeamOperationError("STALE_UPDATE");
}

async function expireMatchingPendingInvitations(
  transaction: Prisma.TransactionClient,
  businessId: string,
  email: string,
  now: Date,
) {
  await transaction.workerInvitation.updateMany({
    where: {
      businessId,
      email,
      expiresAt: { lte: now },
      status: "PENDING",
    },
    data: { status: "EXPIRED", version: { increment: 1 } },
  });
}

function invitationExpiry(now: Date) {
  return new Date(now.getTime() + WORKER_INVITATION_LIFETIME_MS);
}

async function assertInvitableEmail(
  transaction: Prisma.TransactionClient,
  actor: ApplicationPrincipal,
  email: string,
) {
  if (getBootstrapRole(email, true)) {
    throw new TeamOperationError("PRIVILEGED_MEMBERSHIP_PROTECTED");
  }

  const user = await transaction.user.findUnique({
    where: { email },
    select: {
      memberships: {
        where: { businessId: actor.businessId },
        select: { role: true },
        take: 1,
      },
    },
  });
  const existingRole = user?.memberships[0]?.role;

  if (existingRole === "ADMIN" || existingRole === "OWNER") {
    throw new TeamOperationError("PRIVILEGED_MEMBERSHIP_PROTECTED");
  }
  if (existingRole === "WORKER") {
    throw new TeamOperationError("ALREADY_WORKER");
  }
}

export async function createWorkerInvitation(
  actor: ApplicationPrincipal,
  requestedEmail: string,
) {
  assertCanManageWorkers(actor.role);
  const email = normalizeInvitationEmail(requestedEmail);
  if (!isValidInvitationEmail(email)) {
    throw new TeamOperationError("VALIDATION");
  }

  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    const token = createWorkerInvitationToken();
    const tokenHash = hashWorkerInvitationToken(token);
    const now = new Date();

    try {
      const invitation = await serializable(async (transaction) => {
        await assertInvitableEmail(transaction, actor, email);
        await expireMatchingPendingInvitations(
          transaction,
          actor.businessId,
          email,
          now,
        );

        const pending = await transaction.workerInvitation.findFirst({
          where: { businessId: actor.businessId, email, status: "PENDING" },
          select: { id: true },
        });
        if (pending) {
          throw new TeamOperationError("DUPLICATE_INVITATION");
        }

        const created = await transaction.workerInvitation.create({
          data: {
            businessId: actor.businessId,
            createdByMembershipId: actor.membershipId,
            email,
            expiresAt: invitationExpiry(now),
            tokenHash,
          },
        });

        await transaction.auditLog.create({
          data: {
            action: "team.invitation.created",
            actorMembershipId: actor.membershipId,
            actorUserId: actor.userId,
            businessId: actor.businessId,
            metadata: { expiresAt: created.expiresAt.toISOString() },
            targetId: created.id,
            targetType: "WorkerInvitation",
          },
        });

        return created;
      });

      return {
        invitation,
        invitationPath: workerInvitationPath(token),
      };
    } catch (error) {
      if (!isRetryable(error) || attempt === MAX_TRANSACTION_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  throw new TeamOperationError("STALE_UPDATE");
}

export async function revokeWorkerInvitation(
  actor: ApplicationPrincipal,
  input: { invitationId: string; version: number },
) {
  assertCanManageWorkers(actor.role);
  const now = new Date();

  return serializable(async (transaction) => {
    const invitation = await transaction.workerInvitation.findFirst({
      where: { businessId: actor.businessId, id: input.invitationId },
    });
    if (!invitation) {
      throw new TeamOperationError("NOT_FOUND");
    }
    assertInvitationAvailable(invitation, now);

    const revoked = await transaction.workerInvitation.updateMany({
      where: {
        businessId: actor.businessId,
        id: invitation.id,
        status: "PENDING",
        version: input.version,
      },
      data: {
        revokedAt: now,
        revokedByMembershipId: actor.membershipId,
        status: "REVOKED",
        version: { increment: 1 },
      },
    });
    if (revoked.count !== 1) {
      throw new TeamOperationError("STALE_UPDATE");
    }

    await transaction.auditLog.create({
      data: {
        action: "team.invitation.revoked",
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        targetId: invitation.id,
        targetType: "WorkerInvitation",
      },
    });
  });
}

export async function reissueWorkerInvitation(
  actor: ApplicationPrincipal,
  invitationId: string,
) {
  assertCanManageWorkers(actor.role);

  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    const token = createWorkerInvitationToken();
    const tokenHash = hashWorkerInvitationToken(token);
    const now = new Date();

    try {
      const invitation = await serializable(async (transaction) => {
        const prior = await transaction.workerInvitation.findFirst({
          where: { businessId: actor.businessId, id: invitationId },
          include: { replacement: { select: { id: true } } },
        });
        if (!prior) {
          throw new TeamOperationError("NOT_FOUND");
        }
        if (prior.status === "ACCEPTED" || prior.replacement) {
          throw new TeamOperationError("INVITATION_UNAVAILABLE");
        }

        await assertInvitableEmail(transaction, actor, prior.email);
        await expireMatchingPendingInvitations(
          transaction,
          actor.businessId,
          prior.email,
          now,
        );

        const refreshedPrior = await transaction.workerInvitation.findUniqueOrThrow({
          where: { id: prior.id },
        });
        if (refreshedPrior.status === "PENDING") {
          await transaction.workerInvitation.update({
            where: { id: refreshedPrior.id },
            data: {
              revokedAt: now,
              revokedByMembershipId: actor.membershipId,
              status: "REVOKED",
              version: { increment: 1 },
            },
          });
          await transaction.auditLog.create({
            data: {
              action: "team.invitation.revoked",
              actorMembershipId: actor.membershipId,
              actorUserId: actor.userId,
              businessId: actor.businessId,
              metadata: { reason: "REISSUED" },
              targetId: refreshedPrior.id,
              targetType: "WorkerInvitation",
            },
          });
        }

        const created = await transaction.workerInvitation.create({
          data: {
            businessId: actor.businessId,
            createdByMembershipId: actor.membershipId,
            email: prior.email,
            expiresAt: invitationExpiry(now),
            replacesInvitationId: prior.id,
            tokenHash,
          },
        });
        await transaction.auditLog.create({
          data: {
            action: "team.invitation.created",
            actorMembershipId: actor.membershipId,
            actorUserId: actor.userId,
            businessId: actor.businessId,
            metadata: {
              expiresAt: created.expiresAt.toISOString(),
              source: "REISSUE",
            },
            targetId: created.id,
            targetType: "WorkerInvitation",
          },
        });

        return created;
      });

      return {
        invitation,
        invitationPath: workerInvitationPath(token),
      };
    } catch (error) {
      if (!isRetryable(error) || attempt === MAX_TRANSACTION_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  throw new TeamOperationError("STALE_UPDATE");
}

export async function redeemWorkerInvitation(input: {
  identity: {
    email: string;
    emailVerified: boolean;
  };
  principal: ApplicationPrincipal;
  token: string;
}) {
  if (!isInvitationTokenShape(input.token) || !input.principal.access.allowed) {
    throw new TeamOperationError("INVITATION_UNAVAILABLE");
  }

  const tokenHash = hashWorkerInvitationToken(input.token);
  const now = new Date();

  return serializable(async (transaction) => {
    const invitation = await transaction.workerInvitation.findUnique({
      where: { tokenHash },
    });
    if (!invitation || invitation.businessId !== input.principal.businessId) {
      throw new TeamOperationError("INVITATION_UNAVAILABLE");
    }

    assertInvitationAvailable(invitation, now);
    assertInvitationIdentity({
      authenticatedEmail: input.identity.email,
      emailVerified: input.identity.emailVerified,
      invitationEmail: invitation.email,
    });

    const membership = await transaction.businessMembership.findFirst({
      where: {
        businessId: input.principal.businessId,
        deactivatedAt: null,
        id: input.principal.membershipId,
        status: "ACTIVE",
        user: { deactivatedAt: null },
      },
      include: { workerProfile: true },
    });
    if (!membership) {
      throw new TeamOperationError("BLOCKED_ACCOUNT");
    }

    const resolvedRole = resolveInvitedMembershipRole(membership.role);
    if (
      membership.workerProfile &&
      (!membership.workerProfile.isActive || membership.workerProfile.archivedAt)
    ) {
      throw new TeamOperationError("BLOCKED_ACCOUNT");
    }

    const consumed = await transaction.workerInvitation.updateMany({
      where: {
        expiresAt: { gt: now },
        id: invitation.id,
        status: "PENDING",
        version: invitation.version,
      },
      data: {
        acceptedAt: now,
        acceptedByMembershipId: membership.id,
        status: "ACCEPTED",
        version: { increment: 1 },
      },
    });
    if (consumed.count !== 1) {
      throw new TeamOperationError("INVITATION_UNAVAILABLE");
    }

    if (membership.role !== resolvedRole) {
      const promoted = await transaction.businessMembership.updateMany({
        where: {
          businessId: input.principal.businessId,
          id: membership.id,
          role: "CUSTOMER",
          status: "ACTIVE",
          version: membership.version,
        },
        data: { role: "WORKER", version: { increment: 1 } },
      });
      if (promoted.count !== 1) {
        throw new TeamOperationError("STALE_UPDATE");
      }

      await transaction.auditLog.create({
        data: {
          action: "team.membership.role_changed",
          actorMembershipId: membership.id,
          actorUserId: membership.userId,
          businessId: input.principal.businessId,
          metadata: { fromRole: membership.role, toRole: "WORKER" },
          targetId: membership.id,
          targetType: "BusinessMembership",
        },
      });
    }

    const profile = membership.workerProfile ??
      (await transaction.workerProfile.create({
        data: {
          businessId: input.principal.businessId,
          membershipId: membership.id,
        },
      }));

    await transaction.auditLog.create({
      data: {
        action: "team.invitation.accepted",
        actorMembershipId: membership.id,
        actorUserId: membership.userId,
        businessId: input.principal.businessId,
        metadata: { workerProfileId: profile.id },
        targetId: invitation.id,
        targetType: "WorkerInvitation",
      },
    });

    return { membershipId: membership.id, workerProfileId: profile.id };
  });
}
