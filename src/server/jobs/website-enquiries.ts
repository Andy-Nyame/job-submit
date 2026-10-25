import "server-only";

import { isUuid } from "@/domain/job-attachments";
import {
  WEBSITE_ENQUIRY_RATE_LIMIT,
  WEBSITE_ENQUIRY_RATE_WINDOW_MS,
  WEBSITE_SERVICE_SLUG,
  normalizeWebsiteEnquiryMessage,
} from "@/domain/website-enquiries";
import { Prisma } from "@/generated/prisma/client";
import type { ApplicationPrincipal } from "@/server/auth/provisioning";
import { prisma } from "@/server/db/prisma";
import {
  notifyCustomerOfWebsiteEnquiryReply,
  notifyManagementOfWebsiteEnquiry,
} from "@/server/notifications/events";

export class WebsiteEnquiryOperationError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "RATE_LIMITED" | "VALIDATION") {
    super(code);
    this.name = "WebsiteEnquiryOperationError";
  }
}

export async function sendWebsiteEnquiryMessage(
  actor: ApplicationPrincipal,
  input: { body: string; clientMessageKey: string; publicReference: string },
) {
  if (!isUuid(input.clientMessageKey) || !input.publicReference || input.publicReference.length > 32) {
    throw new WebsiteEnquiryOperationError("VALIDATION");
  }
  let body: string;
  try {
    body = normalizeWebsiteEnquiryMessage(input.body);
  } catch {
    throw new WebsiteEnquiryOperationError("VALIDATION");
  }
  const customer = actor.role === "CUSTOMER";
  const manager = actor.role === "OWNER" || actor.role === "ADMIN";
  if (!customer && !manager) throw new WebsiteEnquiryOperationError("NOT_FOUND");

  const previous = await prisma.jobMessage.findUnique({
    where: { clientMessageKey: input.clientMessageKey },
    select: { id: true, job: { select: { businessId: true, customer: { select: { userId: true } } } }, senderMembershipId: true, senderUserId: true },
  });
  if (previous) {
    const owned = previous.job.businessId === actor.businessId && (customer ? previous.senderUserId === actor.userId && previous.job.customer?.userId === actor.userId : previous.senderMembershipId === actor.membershipId);
    if (!owned) throw new WebsiteEnquiryOperationError("NOT_FOUND");
    return previous;
  }

  try {
    return await prisma.$transaction(async (transaction) => {
      const membership = await transaction.businessMembership.findFirst({
        where: {
          business: { archivedAt: null, isActive: true },
          businessId: actor.businessId,
          deactivatedAt: null,
          id: actor.membershipId,
          role: customer ? "CUSTOMER" : { in: ["OWNER", "ADMIN"] },
          status: "ACTIVE",
          user: { deactivatedAt: null, id: actor.userId },
        },
        select: { id: true },
      });
      if (!membership) throw new WebsiteEnquiryOperationError("NOT_FOUND");
      const job = await transaction.job.findFirst({
        where: {
          archivedAt: null,
          businessId: actor.businessId,
          publicReference: input.publicReference,
          service: { slug: WEBSITE_SERVICE_SLUG },
          ...(customer ? { customer: { userId: actor.userId } } : {}),
        },
        select: { customer: { select: { userId: true } }, id: true },
      });
      if (!job) throw new WebsiteEnquiryOperationError("NOT_FOUND");

      const recent = await transaction.jobMessage.count({
        where: {
          businessId: actor.businessId,
          createdAt: { gt: new Date(Date.now() - WEBSITE_ENQUIRY_RATE_WINDOW_MS) },
          jobId: job.id,
          removedAt: null,
          ...(customer ? { senderUserId: actor.userId } : { senderMembershipId: actor.membershipId }),
        },
      });
      if (recent >= WEBSITE_ENQUIRY_RATE_LIMIT) throw new WebsiteEnquiryOperationError("RATE_LIMITED");

      const message = await transaction.jobMessage.create({
        data: {
          body,
          businessId: actor.businessId,
          clientMessageKey: input.clientMessageKey,
          jobId: job.id,
          readByCustomerAt: customer ? new Date() : null,
          readByManagementAt: manager ? new Date() : null,
          senderKind: customer ? "CUSTOMER" : "STAFF",
          senderMembershipId: manager ? actor.membershipId : null,
          senderUserId: customer ? actor.userId : null,
        },
        select: { id: true },
      });
      await transaction.auditLog.create({
        data: {
          action: customer ? "website_enquiry.customer_message_sent" : "website_enquiry.management_reply_sent",
          actorMembershipId: actor.membershipId,
          actorUserId: actor.userId,
          businessId: actor.businessId,
          metadata: { jobId: job.id },
          targetId: message.id,
          targetType: "JobMessage",
        },
      });
      if (customer) {
        await notifyManagementOfWebsiteEnquiry(transaction, { businessId: actor.businessId, messageId: message.id, publicReference: input.publicReference });
      } else {
        await notifyCustomerOfWebsiteEnquiryReply(transaction, { businessId: actor.businessId, customerUserId: job.customer?.userId ?? null, messageId: message.id, publicReference: input.publicReference });
      }
      return message;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrent = await prisma.jobMessage.findUnique({ where: { clientMessageKey: input.clientMessageKey }, select: { id: true, senderMembershipId: true, senderUserId: true } });
      if (concurrent && (customer ? concurrent.senderUserId === actor.userId : concurrent.senderMembershipId === actor.membershipId)) return concurrent;
    }
    throw error;
  }
}
