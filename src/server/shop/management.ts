import "server-only";

import {
  assertCanManageShop,
  shopAuditAction,
} from "@/domain/shop-policy";
import { Prisma } from "@/generated/prisma/client";
import type { ApplicationPrincipal } from "@/server/auth/provisioning";
import { prisma } from "@/server/db/prisma";

import { ShopOperationError } from "./errors";

const MAX_TRANSACTION_ATTEMPTS = 3;

function isRetryable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

export async function setShopOpenState(
  actor: ApplicationPrincipal,
  input: { acceptingNewJobs: boolean; expectedState: boolean },
) {
  assertCanManageShop(actor.role);

  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const membership = await transaction.businessMembership.findFirst({
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
          if (!membership) {
            throw new ShopOperationError("BUSINESS_UNAVAILABLE");
          }

          const updated = await transaction.business.updateMany({
            data: { acceptingNewJobs: input.acceptingNewJobs },
            where: {
              acceptingNewJobs: input.expectedState,
              archivedAt: null,
              id: actor.businessId,
              isActive: true,
            },
          });
          if (updated.count !== 1) {
            throw new ShopOperationError("STALE_UPDATE");
          }

          await transaction.auditLog.create({
            data: {
              action: shopAuditAction(input.acceptingNewJobs),
              actorMembershipId: actor.membershipId,
              actorUserId: actor.userId,
              businessId: actor.businessId,
              metadata: {
                from: input.expectedState ? "OPEN" : "CLOSED",
                to: input.acceptingNewJobs ? "OPEN" : "CLOSED",
              },
              targetId: actor.businessId,
              targetType: "Business",
            },
          });

          return { acceptingNewJobs: input.acceptingNewJobs };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (!isRetryable(error) || attempt === MAX_TRANSACTION_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  throw new ShopOperationError("STALE_UPDATE");
}
