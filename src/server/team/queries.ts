import "server-only";

import { getInvitationLifecycleStatus } from "@/domain/team-policy";
import { prisma } from "@/server/db/prisma";

import { requireTeamManager, requireWorker } from "./authorization";

export type WorkerListFilter = "ALL" | "ACTIVE" | "ARCHIVED" | "INACTIVE";

export async function getTeamPageData(input: {
  query?: string;
  status?: WorkerListFilter;
}) {
  const principal = await requireTeamManager();
  const query = input.query?.trim().slice(0, 160) ?? "";
  const status = input.status ?? "ALL";

  const statusWhere =
    status === "ACTIVE"
      ? {
          deactivatedAt: null,
          status: "ACTIVE" as const,
          user: { deactivatedAt: null },
          workerProfile: {
            archivedAt: null,
            isActive: true,
          },
        }
      : status === "INACTIVE"
        ? {
            OR: [
              { status: "INACTIVE" as const },
              { deactivatedAt: { not: null } },
              { workerProfile: { isActive: false } },
            ],
          }
        : status === "ARCHIVED"
          ? { workerProfile: { archivedAt: { not: null } } }
          : {};

  const [workers, invitations] = await Promise.all([
    prisma.businessMembership.findMany({
      where: {
        businessId: principal.businessId,
        role: "WORKER",
        ...statusWhere,
        ...(query
          ? {
              user: {
                OR: [
                  { displayName: { contains: query, mode: "insensitive" as const } },
                  { email: { contains: query, mode: "insensitive" as const } },
                ],
              },
            }
          : {}),
      },
      include: {
        user: true,
        workerProfile: { include: { skills: { where: { isActive: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.workerInvitation.findMany({
      where: { businessId: principal.businessId },
      include: { replacement: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const now = new Date();
  return {
    invitations: invitations.map((invitation) => ({
      canReissue:
        invitation.status !== "ACCEPTED" && !invitation.replacement,
      createdAt: invitation.createdAt,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      id: invitation.id,
      status: getInvitationLifecycleStatus(invitation, now),
      version: invitation.version,
    })),
    principal,
    workers: workers.map((membership) => ({
      displayName: membership.user.displayName,
      email: membership.user.email,
      id: membership.id,
      membershipStatus: membership.status,
      profile: membership.workerProfile
        ? {
            archivedAt: membership.workerProfile.archivedAt,
            isActive: membership.workerProfile.isActive,
            skillCount: membership.workerProfile.skills.length,
          }
        : null,
      userDeactivatedAt: membership.user.deactivatedAt,
    })),
  };
}

export async function getManagedWorker(membershipId: string) {
  const principal = await requireTeamManager();
  const [membership, services] = await Promise.all([
    prisma.businessMembership.findFirst({
      where: {
        businessId: principal.businessId,
        id: membershipId,
        role: "WORKER",
      },
      include: {
        user: true,
        workerProfile: {
          include: {
            skills: {
              include: { service: true },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    }),
    prisma.service.findMany({
      where: {
        archivedAt: null,
        businessId: principal.businessId,
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  return { membership, principal, services };
}

export async function getOwnWorkerProfile() {
  const principal = await requireWorker();
  const membership = await prisma.businessMembership.findFirst({
    where: {
      businessId: principal.businessId,
      id: principal.membershipId,
      role: "WORKER",
    },
    include: {
      user: true,
      workerProfile: {
        include: {
          skills: {
            include: { service: true },
            where: { isActive: true },
            orderBy: { service: { sortOrder: "asc" } },
          },
        },
      },
    },
  });

  return { membership, principal };
}
