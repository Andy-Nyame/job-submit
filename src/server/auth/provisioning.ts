import "server-only";

import {
  BUSINESS_SLUG,
  determineIdentityBinding,
  evaluateApplicationAccess,
  getBootstrapRole,
  getPublicOnboardingRole,
  type ApplicationAccess,
  type ApplicationRole,
  IdentityBindingConflictError,
  resolveMembershipRole,
} from "@/domain/auth-policy";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";

import { ApplicationConfigurationError } from "./errors";
import type { AuthenticatedIdentity } from "./identity";

export interface ApplicationPrincipal {
  access: ApplicationAccess;
  businessId: string;
  displayName: string | null;
  email: string;
  membershipId: string;
  role: ApplicationRole;
  userId: string;
}

class ProvisioningRaceError extends Error {}

function isRetryableProvisioningError(error: unknown) {
  return (
    error instanceof ProvisioningRaceError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2034"))
  );
}

async function provisionOnce(
  identity: AuthenticatedIdentity,
): Promise<ApplicationPrincipal> {
  return prisma.$transaction(
    async (transaction) => {
      let user = await transaction.user.findUnique({
        where: { supabaseAuthUserId: identity.supabaseUserId },
      });

      if (!user) {
        const emailMatchedUser = await transaction.user.findUnique({
          where: { email: identity.email },
        });
        const decision = determineIdentityBinding({
          authenticatedSupabaseUserId: identity.supabaseUserId,
          emailMatchedUser,
          emailVerified: identity.emailVerified,
          subjectMatchedUserExists: false,
        });

        if (decision === "BIND_EXISTING_USER" && emailMatchedUser) {
          const claimed = await transaction.user.updateMany({
            where: {
              id: emailMatchedUser.id,
              supabaseAuthUserId: null,
            },
            data: { supabaseAuthUserId: identity.supabaseUserId },
          });

          if (claimed.count !== 1) {
            throw new ProvisioningRaceError();
          }

          user = await transaction.user.findUnique({
            where: { id: emailMatchedUser.id },
          });
        } else if (decision === "CREATE_USER") {
          user = await transaction.user.create({
            data: {
              displayName: identity.displayName,
              email: identity.email,
              supabaseAuthUserId: identity.supabaseUserId,
            },
          });
        } else {
          user = await transaction.user.findUnique({
            where: { supabaseAuthUserId: identity.supabaseUserId },
          });
        }
      }

      if (!user) {
        throw new ProvisioningRaceError();
      }

      const business = await transaction.business.findUnique({
        where: { slug: BUSINESS_SLUG },
      });

      if (!business) {
        throw new ApplicationConfigurationError();
      }

      const desiredRole = getPublicOnboardingRole(
        identity.email,
        identity.emailVerified,
      );
      const bootstrapRole = getBootstrapRole(
        identity.email,
        identity.emailVerified,
      );
      let membership = await transaction.businessMembership.findUnique({
        where: {
          businessId_userId: {
            businessId: business.id,
            userId: user.id,
          },
        },
      });
      let auditAction: string | null = null;
      let priorRole: ApplicationRole | null = null;

      if (!membership) {
        membership = await transaction.businessMembership.create({
          data: {
            businessId: business.id,
            deactivatedAt: user.deactivatedAt,
            role: desiredRole,
            status: user.deactivatedAt ? "INACTIVE" : "ACTIVE",
            userId: user.id,
          },
        });
        auditAction = bootstrapRole
          ? "auth.bootstrap_role_established"
          : null;
      } else {
        const resolvedRole = resolveMembershipRole(
          membership.role,
          desiredRole,
        );

        if (resolvedRole !== membership.role) {
          priorRole = membership.role;
          membership = await transaction.businessMembership.update({
            where: { id: membership.id },
            data: { role: resolvedRole },
          });
          auditAction = bootstrapRole ? "auth.bootstrap_role_elevated" : null;
        }
      }

      if (auditAction) {
        await transaction.auditLog.create({
          data: {
            action: auditAction,
            actorMembershipId: membership.id,
            actorUserId: user.id,
            businessId: business.id,
            metadata: {
              fromRole: priorRole,
              policy: "LOCKED_BOOTSTRAP_EMAIL",
              toRole: membership.role,
            },
            targetId: membership.id,
            targetType: "BusinessMembership",
          },
        });
      }

      return {
        access: evaluateApplicationAccess({
          businessArchivedAt: business.archivedAt,
          businessIsActive: business.isActive,
          membershipDeactivatedAt: membership.deactivatedAt,
          membershipStatus: membership.status,
          userDeactivatedAt: user.deactivatedAt,
        }),
        businessId: business.id,
        displayName: user.displayName,
        email: identity.email,
        membershipId: membership.id,
        role: membership.role,
        userId: user.id,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function resolveApplicationPrincipal(
  identity: AuthenticatedIdentity,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await provisionOnce(identity);
    } catch (error) {
      if (!isRetryableProvisioningError(error)) {
        throw error;
      }
    }
  }

  throw new IdentityBindingConflictError();
}
