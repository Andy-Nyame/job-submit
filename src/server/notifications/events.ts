import "server-only";

import {
  notificationEventKey,
  notificationJobHref,
} from "@/domain/notification-policy";
import { formatGhanaCediMinor } from "@/domain/service-pricing";
import type { NotificationType, Prisma } from "@/generated/prisma/client";

interface NotificationEvent {
  body: string;
  eventKey: string;
  href: string;
  targetId: string;
  targetType: "Job" | "JobQuotation" | "QuotationCounteroffer";
  title: string;
  type: NotificationType;
}

async function createForRecipients(
  transaction: Prisma.TransactionClient,
  businessId: string,
  recipientUserIds: readonly string[],
  event: NotificationEvent,
) {
  const recipients = [...new Set(recipientUserIds)];
  if (recipients.length === 0) return;
  await transaction.notification.createMany({
    data: recipients.map((recipientUserId) => ({
      body: event.body,
      businessId,
      eventKey: event.eventKey,
      href: event.href,
      recipientUserId,
      targetId: event.targetId,
      targetType: event.targetType,
      title: event.title,
      type: event.type,
    })),
    skipDuplicates: true,
  });
}

async function activeRecipientIds(
  transaction: Prisma.TransactionClient,
  businessId: string,
  roles: readonly ("ADMIN" | "CUSTOMER" | "OWNER" | "WORKER")[],
  userId?: string | null,
) {
  if (userId === null) return [];
  const memberships = await transaction.businessMembership.findMany({
    where: {
      business: { archivedAt: null, isActive: true },
      businessId,
      deactivatedAt: null,
      role: { in: [...roles] },
      status: "ACTIVE",
      user: {
        deactivatedAt: null,
        ...(userId ? { id: userId } : {}),
      },
    },
    select: { userId: true },
  });
  return memberships.map((membership) => membership.userId);
}

async function notifyManagement(
  transaction: Prisma.TransactionClient,
  businessId: string,
  event: NotificationEvent,
) {
  const recipients = await activeRecipientIds(transaction, businessId, [
    "OWNER",
    "ADMIN",
  ]);
  await createForRecipients(transaction, businessId, recipients, event);
}

async function notifyCustomer(
  transaction: Prisma.TransactionClient,
  businessId: string,
  customerUserId: string | null,
  event: NotificationEvent,
) {
  const recipients = await activeRecipientIds(
    transaction,
    businessId,
    ["CUSTOMER"],
    customerUserId,
  );
  await createForRecipients(transaction, businessId, recipients, event);
}

export async function notifyManagementOfNewJob(
  transaction: Prisma.TransactionClient,
  input: {
    businessId: string;
    jobId: string;
    pricingMode: "FIXED" | "ON_REQUEST";
    priority: "EXPRESS" | "REGULAR";
    publicReference: string;
    serviceName: string;
  },
) {
  const needsCosting = input.pricingMode === "ON_REQUEST";
  await notifyManagement(transaction, input.businessId, {
    body: needsCosting
      ? `${input.publicReference} for ${input.serviceName} is ${input.priority.toLowerCase()} priority and needs a quotation.`
      : `${input.publicReference} for ${input.serviceName} is ${input.priority.toLowerCase()} priority with pricing confirmed at submission.`,
    eventKey: notificationEventKey("job", input.jobId, "submitted"),
    href: notificationJobHref("STAFF", input.publicReference),
    targetId: input.jobId,
    targetType: "Job",
    title: needsCosting ? "New job needs costing" : "New job submitted",
    type: needsCosting ? "COSTING_REQUIRED" : "JOB_SUBMITTED",
  });
}

export async function notifyCustomerOfJobStatus(
  transaction: Prisma.TransactionClient,
  input: {
    businessId: string;
    customerUserId: string | null;
    historyId: string;
    jobId: string;
    publicReference: string;
    status: "UNDER_REVIEW";
  },
) {
  await notifyCustomer(transaction, input.businessId, input.customerUserId, {
    body: `We're checking ${input.publicReference}. Price confirmation and production are separate next steps.`,
    eventKey: notificationEventKey("job", input.historyId, "status-updated"),
    href: notificationJobHref("CUSTOMER", input.publicReference),
    targetId: input.jobId,
    targetType: "Job",
    title: "We're checking your job",
    type: "JOB_STATUS_UPDATED",
  });
}

export async function notifyCustomerOfQuotationIssued(
  transaction: Prisma.TransactionClient,
  input: {
    businessId: string;
    customerUserId: string | null;
    publicReference: string;
    quotationId: string;
    quotationVersion: number;
  },
) {
  const revised = input.quotationVersion > 1;
  await notifyCustomer(transaction, input.businessId, input.customerUserId, {
    body: revised
      ? `An updated price is ready for ${input.publicReference}. Check it before you respond.`
      : `Your price is ready for ${input.publicReference}. Open the job to accept or decline it.`,
    eventKey: notificationEventKey("quotation", input.quotationId, "issued"),
    href: notificationJobHref("CUSTOMER", input.publicReference),
    targetId: input.quotationId,
    targetType: "JobQuotation",
    title: revised ? "Your updated price is ready" : "Your price is ready",
    type: revised ? "QUOTATION_REVISED" : "QUOTATION_ISSUED",
  });
}

export async function notifyCustomerOfQuotationOutcome(
  transaction: Prisma.TransactionClient,
  input: {
    businessId: string;
    customerUserId: string | null;
    outcome: "COUNTEROFFER_DECLINED" | "EXPIRED" | "WITHDRAWN";
    publicReference: string;
    quotationId: string;
  },
) {
  const details = {
    COUNTEROFFER_DECLINED: {
      body: `Management declined your price suggestion for ${input.publicReference}. The current offered price is still available.`,
      title: "Your price suggestion was reviewed",
      type: "COUNTEROFFER_DECLINED" as const,
    },
    EXPIRED: {
      body: `The offered price for ${input.publicReference} has expired and can no longer be accepted.`,
      title: "Your price has expired",
      type: "QUOTATION_EXPIRED" as const,
    },
    WITHDRAWN: {
      body: `The offered price for ${input.publicReference} was withdrawn and can no longer be accepted.`,
      title: "Your price was withdrawn",
      type: "QUOTATION_WITHDRAWN" as const,
    },
  }[input.outcome];
  await notifyCustomer(transaction, input.businessId, input.customerUserId, {
    ...details,
    eventKey: notificationEventKey(
      "quotation",
      input.quotationId,
      input.outcome.toLowerCase().replaceAll("_", "-"),
    ),
    href: notificationJobHref("CUSTOMER", input.publicReference),
    targetId: input.quotationId,
    targetType: "JobQuotation",
  });
}

export async function notifyManagementOfQuotationDecision(
  transaction: Prisma.TransactionClient,
  input: {
    businessId: string;
    currency: string;
    decision: "ACCEPTED" | "DECLINED";
    publicReference: string;
    quotationId: string;
    totalMinor: bigint;
  },
) {
  const accepted = input.decision === "ACCEPTED";
  const amount =
    input.currency === "GHS"
      ? formatGhanaCediMinor(input.totalMinor)
      : `${input.currency} ${input.totalMinor.toString()} minor units`;
  await notifyManagement(transaction, input.businessId, {
    body: accepted
      ? `The customer accepted ${amount} for ${input.publicReference}. Price agreement does not start production automatically.`
      : `The customer declined the quotation for ${input.publicReference}. Management review is required.`,
    eventKey: notificationEventKey(
      "quotation",
      input.quotationId,
      accepted ? "accepted" : "declined",
    ),
    href: notificationJobHref("STAFF", input.publicReference),
    targetId: input.quotationId,
    targetType: "JobQuotation",
    title: accepted ? "Quotation accepted" : "Quotation declined",
    type: accepted ? "QUOTATION_ACCEPTED" : "QUOTATION_DECLINED",
  });
}

export async function notifyManagementOfCounteroffer(
  transaction: Prisma.TransactionClient,
  input: {
    businessId: string;
    counterofferId: string;
    publicReference: string;
  },
) {
  await notifyManagement(transaction, input.businessId, {
    body: `A customer counteroffer for ${input.publicReference} requires management review. It has not been accepted automatically.`,
    eventKey: notificationEventKey(
      "counteroffer",
      input.counterofferId,
      "submitted",
    ),
    href: notificationJobHref("STAFF", input.publicReference),
    targetId: input.counterofferId,
    targetType: "QuotationCounteroffer",
    title: "Counteroffer requires review",
    type: "COUNTEROFFER_SUBMITTED",
  });
}
