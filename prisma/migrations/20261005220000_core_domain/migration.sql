-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('CUSTOMER', 'WORKER', 'ADMIN', 'OWNER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "JobSource" AS ENUM ('CUSTOMER_PORTAL', 'ADMIN_CREATED', 'WALK_IN');

-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('REGULAR', 'EXPRESS');

-- CreateEnum
CREATE TYPE "JobComplexity" AS ENUM ('SIMPLE', 'MEDIUM', 'COMPLEX');

-- CreateEnum
CREATE TYPE "WorkloadClass" AS ENUM ('QUICK', 'STANDARD', 'FOCUS');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'QUEUED', 'PROCESSING', 'WAITING_FOR_CUSTOMER', 'AWAITING_CUSTOMER_APPROVAL', 'PREPARING_FOR_PICKUP', 'READY_FOR_PICKUP', 'PICKED_UP', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobPricingStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "QueueOverrideDirection" AS ENUM ('PROMOTE', 'DEMOTE');

-- CreateEnum
CREATE TYPE "JobAssignmentKind" AS ENUM ('WORKER_CLAIM', 'STAFF_ASSIGNED', 'CONTRIBUTOR');

-- CreateEnum
CREATE TYPE "JobAttachmentPurpose" AS ENUM ('CUSTOMER_ORIGINAL', 'CUSTOMER_REPLACEMENT', 'WORKER_PROOF', 'FINAL_PRODUCTION', 'JOB_DOCUMENT', 'MESSAGE_ATTACHMENT');

-- CreateEnum
CREATE TYPE "JobMessageSenderKind" AS ENUM ('CUSTOMER', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "StaffConversationKind" AS ENUM ('DIRECT');

-- CreateEnum
CREATE TYPE "StaffMessageKind" AS ENUM ('TEXT', 'AUDIO', 'FILE');

-- CreateEnum
CREATE TYPE "StaffAttachmentKind" AS ENUM ('AUDIO', 'FILE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('JOB_SUBMITTED', 'JOB_ACCEPTED', 'JOB_DECLINED', 'CLARIFICATION_REQUESTED', 'CUSTOMER_RESPONDED', 'WORKER_ASSIGNED', 'WORKER_CLAIMED', 'JOB_PROCESSING', 'PROOF_READY', 'PROOF_RESPONSE', 'PREPARING_FOR_PICKUP', 'READY_FOR_PICKUP', 'PICKUP_CODE_ISSUED', 'PICKUP_VERIFIED', 'STAR_BONUS', 'STAR_CORRECTION', 'NEW_STAFF_MESSAGE');

-- CreateEnum
CREATE TYPE "PickupCodeStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "StarLedgerType" AS ENUM ('COMPLETION_AWARD', 'OWNER_BONUS', 'CORRECTION', 'REVERSAL');

-- CreateTable
CREATE TABLE "Business" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "defaultCurrency" CHAR(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320),
    "displayName" VARCHAR(160),
    "deactivatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessMembership" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BusinessMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerProfile" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "canTakeFocus" BOOLEAN NOT NULL DEFAULT false,
    "maxQuickWorkload" INTEGER NOT NULL DEFAULT 0,
    "maxStandardWorkload" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WorkerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "onlineSubmissionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "defaultComplexity" "JobComplexity",
    "defaultWorkloadClass" "WorkloadClass",
    "proofRequiredByDefault" BOOLEAN,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerServiceSkill" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "workerProfileId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WorkerServiceSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "publicReference" VARCHAR(32) NOT NULL,
    "serviceId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "instructions" TEXT NOT NULL,
    "quantity" INTEGER,
    "requestedByAt" TIMESTAMPTZ(3),
    "promisedReadyAt" TIMESTAMPTZ(3),
    "source" "JobSource" NOT NULL,
    "priority" "JobPriority" NOT NULL DEFAULT 'REGULAR',
    "complexity" "JobComplexity" NOT NULL,
    "workloadClass" "WorkloadClass" NOT NULL,
    "currentStatus" "JobStatus" NOT NULL DEFAULT 'SUBMITTED',
    "queueEnteredAt" TIMESTAMPTZ(3),
    "reviewedAt" TIMESTAMPTZ(3),
    "reviewedByMembershipId" UUID,
    "acceptedAt" TIMESTAMPTZ(3),
    "acceptedByMembershipId" UUID,
    "archivedAt" TIMESTAMPTZ(3),
    "archivedByMembershipId" UUID,
    "archiveReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobCustomer" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "userId" UUID,
    "displayName" VARCHAR(160),
    "email" VARCHAR(320),
    "phone" VARCHAR(40),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobStatusHistory" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "fromStatus" "JobStatus",
    "toStatus" "JobStatus" NOT NULL,
    "actorUserId" UUID,
    "actorMembershipId" UUID,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPricing" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "JobPricingStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "JobPriority" NOT NULL,
    "basePriceMinor" BIGINT,
    "expressSurchargeBasisPoints" INTEGER NOT NULL DEFAULT 0,
    "expressSurchargeMinor" BIGINT,
    "confirmedTotalMinor" BIGINT,
    "currency" CHAR(3) NOT NULL,
    "confirmedByMembershipId" UUID,
    "confirmedAt" TIMESTAMPTZ(3),
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "JobPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobQueueOverride" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "direction" "QueueOverrideDirection" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdByMembershipId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),
    "revokedByMembershipId" UUID,
    "revocationReason" TEXT,

    CONSTRAINT "JobQueueOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAssignment" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "workerMembershipId" UUID NOT NULL,
    "kind" "JobAssignmentKind" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "assignedByMembershipId" UUID,
    "assignmentReason" TEXT,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMPTZ(3),
    "releasedByMembershipId" UUID,
    "releaseReason" TEXT,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "JobAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAttachment" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "uploaderUserId" UUID,
    "purpose" "JobAttachmentPurpose" NOT NULL,
    "storageKey" VARCHAR(500) NOT NULL,
    "originalFilename" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(160) NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "durationMs" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "replacesAttachmentId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMPTZ(3),
    "removedByMembershipId" UUID,
    "removalReason" TEXT,

    CONSTRAINT "JobAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobMessage" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "senderKind" "JobMessageSenderKind" NOT NULL,
    "senderUserId" UUID,
    "senderMembershipId" UUID,
    "body" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMPTZ(3),
    "removedByMembershipId" UUID,
    "removalReason" TEXT,

    CONSTRAINT "JobMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobMessageAttachment" (
    "messageId" UUID NOT NULL,
    "attachmentId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobMessageAttachment_pkey" PRIMARY KEY ("messageId","attachmentId")
);

-- CreateTable
CREATE TABLE "JobNote" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "authorMembershipId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMPTZ(3),
    "archivedByMembershipId" UUID,
    "archiveReason" TEXT,

    CONSTRAINT "JobNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffConversation" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "kind" "StaffConversationKind" NOT NULL DEFAULT 'DIRECT',
    "directKey" VARCHAR(80),
    "createdByMembershipId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "lastMessageAt" TIMESTAMPTZ(3),

    CONSTRAINT "StaffConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffConversationParticipant" (
    "businessId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMPTZ(3),
    "archivedAt" TIMESTAMPTZ(3),
    "lastReadAt" TIMESTAMPTZ(3),

    CONSTRAINT "StaffConversationParticipant_pkey" PRIMARY KEY ("conversationId","membershipId")
);

-- CreateTable
CREATE TABLE "StaffMessage" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderMembershipId" UUID NOT NULL,
    "kind" "StaffMessageKind" NOT NULL DEFAULT 'TEXT',
    "body" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMPTZ(3),
    "removedAt" TIMESTAMPTZ(3),
    "removedByMembershipId" UUID,
    "removalReason" TEXT,

    CONSTRAINT "StaffMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMessageAttachment" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "uploadedByMembershipId" UUID NOT NULL,
    "kind" "StaffAttachmentKind" NOT NULL,
    "storageKey" VARCHAR(500) NOT NULL,
    "originalFilename" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(160) NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffMessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "recipientUserId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "body" TEXT,
    "payload" JSONB,
    "targetType" VARCHAR(80),
    "targetId" VARCHAR(100),
    "href" VARCHAR(500),
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupVerification" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "codeHash" VARCHAR(255) NOT NULL,
    "codeHint" VARCHAR(16),
    "status" "PickupCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3),
    "consumedAt" TIMESTAMPTZ(3),
    "verifiedByMembershipId" UUID,
    "overriddenAt" TIMESTAMPTZ(3),
    "overriddenByMembershipId" UUID,
    "overrideReason" TEXT,

    CONSTRAINT "PickupVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StarLedger" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "workerMembershipId" UUID NOT NULL,
    "jobId" UUID,
    "type" "StarLedgerType" NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "actorMembershipId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StarLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "actorUserId" UUID,
    "actorMembershipId" UUID,
    "action" VARCHAR(120) NOT NULL,
    "targetType" VARCHAR(80) NOT NULL,
    "targetId" VARCHAR(100) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Business_slug_key" ON "Business"("slug");

-- CreateIndex
CREATE INDEX "Business_isActive_archivedAt_idx" ON "Business"("isActive", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "BusinessMembership_businessId_role_status_idx" ON "BusinessMembership"("businessId", "role", "status");

-- CreateIndex
CREATE INDEX "BusinessMembership_userId_status_idx" ON "BusinessMembership"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessMembership_businessId_userId_key" ON "BusinessMembership"("businessId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessMembership_businessId_id_key" ON "BusinessMembership"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerProfile_membershipId_key" ON "WorkerProfile"("membershipId");

-- CreateIndex
CREATE INDEX "WorkerProfile_businessId_isActive_archivedAt_idx" ON "WorkerProfile"("businessId", "isActive", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerProfile_businessId_id_key" ON "WorkerProfile"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerProfile_businessId_membershipId_key" ON "WorkerProfile"("businessId", "membershipId");

-- CreateIndex
CREATE INDEX "Service_businessId_isActive_sortOrder_idx" ON "Service"("businessId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Service_businessId_onlineSubmissionEnabled_isActive_idx" ON "Service"("businessId", "onlineSubmissionEnabled", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Service_businessId_slug_key" ON "Service"("businessId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Service_businessId_id_key" ON "Service"("businessId", "id");

-- CreateIndex
CREATE INDEX "WorkerServiceSkill_businessId_serviceId_isActive_idx" ON "WorkerServiceSkill"("businessId", "serviceId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerServiceSkill_workerProfileId_serviceId_key" ON "WorkerServiceSkill"("workerProfileId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_publicReference_key" ON "Job"("publicReference");

-- CreateIndex
CREATE INDEX "Job_businessId_currentStatus_priority_queueEnteredAt_idx" ON "Job"("businessId", "currentStatus", "priority", "queueEnteredAt");

-- CreateIndex
CREATE INDEX "Job_businessId_serviceId_currentStatus_idx" ON "Job"("businessId", "serviceId", "currentStatus");

-- CreateIndex
CREATE INDEX "Job_businessId_createdAt_idx" ON "Job"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "Job_archivedAt_idx" ON "Job"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Job_businessId_id_key" ON "Job"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "JobCustomer_jobId_key" ON "JobCustomer"("jobId");

-- CreateIndex
CREATE INDEX "JobCustomer_businessId_userId_idx" ON "JobCustomer"("businessId", "userId");

-- CreateIndex
CREATE INDEX "JobCustomer_email_idx" ON "JobCustomer"("email");

-- CreateIndex
CREATE INDEX "JobCustomer_phone_idx" ON "JobCustomer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "JobCustomer_businessId_jobId_key" ON "JobCustomer"("businessId", "jobId");

-- CreateIndex
CREATE INDEX "JobStatusHistory_businessId_jobId_createdAt_idx" ON "JobStatusHistory"("businessId", "jobId", "createdAt");

-- CreateIndex
CREATE INDEX "JobStatusHistory_businessId_toStatus_createdAt_idx" ON "JobStatusHistory"("businessId", "toStatus", "createdAt");

-- CreateIndex
CREATE INDEX "JobPricing_businessId_jobId_status_revision_idx" ON "JobPricing"("businessId", "jobId", "status", "revision");

-- CreateIndex
CREATE INDEX "JobPricing_businessId_confirmedAt_idx" ON "JobPricing"("businessId", "confirmedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobPricing_jobId_revision_key" ON "JobPricing"("jobId", "revision");

-- CreateIndex
CREATE INDEX "JobQueueOverride_businessId_jobId_revokedAt_idx" ON "JobQueueOverride"("businessId", "jobId", "revokedAt");

-- CreateIndex
CREATE INDEX "JobQueueOverride_businessId_createdAt_idx" ON "JobQueueOverride"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "JobAssignment_businessId_jobId_releasedAt_idx" ON "JobAssignment"("businessId", "jobId", "releasedAt");

-- CreateIndex
CREATE INDEX "JobAssignment_businessId_workerMembershipId_releasedAt_idx" ON "JobAssignment"("businessId", "workerMembershipId", "releasedAt");

-- CreateIndex
CREATE INDEX "JobAssignment_businessId_assignedAt_idx" ON "JobAssignment"("businessId", "assignedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobAttachment_replacesAttachmentId_key" ON "JobAttachment"("replacesAttachmentId");

-- CreateIndex
CREATE INDEX "JobAttachment_businessId_jobId_purpose_createdAt_idx" ON "JobAttachment"("businessId", "jobId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "JobAttachment_uploaderUserId_createdAt_idx" ON "JobAttachment"("uploaderUserId", "createdAt");

-- CreateIndex
CREATE INDEX "JobAttachment_removedAt_idx" ON "JobAttachment"("removedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobAttachment_businessId_storageKey_key" ON "JobAttachment"("businessId", "storageKey");

-- CreateIndex
CREATE INDEX "JobMessage_businessId_jobId_createdAt_idx" ON "JobMessage"("businessId", "jobId", "createdAt");

-- CreateIndex
CREATE INDEX "JobMessage_senderUserId_createdAt_idx" ON "JobMessage"("senderUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobMessage_businessId_id_key" ON "JobMessage"("businessId", "id");

-- CreateIndex
CREATE INDEX "JobMessageAttachment_attachmentId_idx" ON "JobMessageAttachment"("attachmentId");

-- CreateIndex
CREATE INDEX "JobNote_businessId_jobId_createdAt_idx" ON "JobNote"("businessId", "jobId", "createdAt");

-- CreateIndex
CREATE INDEX "JobNote_businessId_archivedAt_idx" ON "JobNote"("businessId", "archivedAt");

-- CreateIndex
CREATE INDEX "StaffConversation_businessId_lastMessageAt_idx" ON "StaffConversation"("businessId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffConversation_businessId_directKey_key" ON "StaffConversation"("businessId", "directKey");

-- CreateIndex
CREATE UNIQUE INDEX "StaffConversation_businessId_id_key" ON "StaffConversation"("businessId", "id");

-- CreateIndex
CREATE INDEX "StaffConversationParticipant_businessId_membershipId_archiv_idx" ON "StaffConversationParticipant"("businessId", "membershipId", "archivedAt");

-- CreateIndex
CREATE INDEX "StaffConversationParticipant_conversationId_lastReadAt_idx" ON "StaffConversationParticipant"("conversationId", "lastReadAt");

-- CreateIndex
CREATE INDEX "StaffMessage_businessId_conversationId_createdAt_idx" ON "StaffMessage"("businessId", "conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffMessage_businessId_senderMembershipId_createdAt_idx" ON "StaffMessage"("businessId", "senderMembershipId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMessage_businessId_id_key" ON "StaffMessage"("businessId", "id");

-- CreateIndex
CREATE INDEX "StaffMessageAttachment_businessId_messageId_idx" ON "StaffMessageAttachment"("businessId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMessageAttachment_businessId_storageKey_key" ON "StaffMessageAttachment"("businessId", "storageKey");

-- CreateIndex
CREATE INDEX "Notification_businessId_recipientUserId_readAt_createdAt_idx" ON "Notification"("businessId", "recipientUserId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_businessId_type_createdAt_idx" ON "Notification"("businessId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_targetType_targetId_idx" ON "Notification"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "PickupVerification_codeHash_key" ON "PickupVerification"("codeHash");

-- CreateIndex
CREATE INDEX "PickupVerification_businessId_jobId_issuedAt_idx" ON "PickupVerification"("businessId", "jobId", "issuedAt");

-- CreateIndex
CREATE INDEX "PickupVerification_businessId_status_expiresAt_idx" ON "PickupVerification"("businessId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "StarLedger_businessId_workerMembershipId_createdAt_idx" ON "StarLedger"("businessId", "workerMembershipId", "createdAt");

-- CreateIndex
CREATE INDEX "StarLedger_businessId_jobId_idx" ON "StarLedger"("businessId", "jobId");

-- CreateIndex
CREATE INDEX "StarLedger_businessId_type_createdAt_idx" ON "StarLedger"("businessId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_businessId_createdAt_idx" ON "AuditLog"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_businessId_actorMembershipId_createdAt_idx" ON "AuditLog"("businessId", "actorMembershipId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_businessId_targetType_targetId_createdAt_idx" ON "AuditLog"("businessId", "targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_businessId_action_createdAt_idx" ON "AuditLog"("businessId", "action", "createdAt");

-- AddForeignKey
ALTER TABLE "BusinessMembership" ADD CONSTRAINT "BusinessMembership_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessMembership" ADD CONSTRAINT "BusinessMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerProfile" ADD CONSTRAINT "WorkerProfile_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerProfile" ADD CONSTRAINT "WorkerProfile_businessId_membershipId_fkey" FOREIGN KEY ("businessId", "membershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerServiceSkill" ADD CONSTRAINT "WorkerServiceSkill_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerServiceSkill" ADD CONSTRAINT "WorkerServiceSkill_businessId_workerProfileId_fkey" FOREIGN KEY ("businessId", "workerProfileId") REFERENCES "WorkerProfile"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerServiceSkill" ADD CONSTRAINT "WorkerServiceSkill_businessId_serviceId_fkey" FOREIGN KEY ("businessId", "serviceId") REFERENCES "Service"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_businessId_serviceId_fkey" FOREIGN KEY ("businessId", "serviceId") REFERENCES "Service"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_businessId_reviewedByMembershipId_fkey" FOREIGN KEY ("businessId", "reviewedByMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_businessId_acceptedByMembershipId_fkey" FOREIGN KEY ("businessId", "acceptedByMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_businessId_archivedByMembershipId_fkey" FOREIGN KEY ("businessId", "archivedByMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCustomer" ADD CONSTRAINT "JobCustomer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCustomer" ADD CONSTRAINT "JobCustomer_businessId_jobId_fkey" FOREIGN KEY ("businessId", "jobId") REFERENCES "Job"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCustomer" ADD CONSTRAINT "JobCustomer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobStatusHistory" ADD CONSTRAINT "JobStatusHistory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobStatusHistory" ADD CONSTRAINT "JobStatusHistory_businessId_jobId_fkey" FOREIGN KEY ("businessId", "jobId") REFERENCES "Job"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobStatusHistory" ADD CONSTRAINT "JobStatusHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobStatusHistory" ADD CONSTRAINT "JobStatusHistory_businessId_actorMembershipId_fkey" FOREIGN KEY ("businessId", "actorMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPricing" ADD CONSTRAINT "JobPricing_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPricing" ADD CONSTRAINT "JobPricing_businessId_jobId_fkey" FOREIGN KEY ("businessId", "jobId") REFERENCES "Job"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPricing" ADD CONSTRAINT "JobPricing_businessId_confirmedByMembershipId_fkey" FOREIGN KEY ("businessId", "confirmedByMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobQueueOverride" ADD CONSTRAINT "JobQueueOverride_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobQueueOverride" ADD CONSTRAINT "JobQueueOverride_businessId_jobId_fkey" FOREIGN KEY ("businessId", "jobId") REFERENCES "Job"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobQueueOverride" ADD CONSTRAINT "JobQueueOverride_businessId_createdByMembershipId_fkey" FOREIGN KEY ("businessId", "createdByMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobQueueOverride" ADD CONSTRAINT "JobQueueOverride_businessId_revokedByMembershipId_fkey" FOREIGN KEY ("businessId", "revokedByMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_businessId_jobId_fkey" FOREIGN KEY ("businessId", "jobId") REFERENCES "Job"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_businessId_workerMembershipId_fkey" FOREIGN KEY ("businessId", "workerMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_businessId_assignedByMembershipId_fkey" FOREIGN KEY ("businessId", "assignedByMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_businessId_releasedByMembershipId_fkey" FOREIGN KEY ("businessId", "releasedByMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAttachment" ADD CONSTRAINT "JobAttachment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAttachment" ADD CONSTRAINT "JobAttachment_businessId_jobId_fkey" FOREIGN KEY ("businessId", "jobId") REFERENCES "Job"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAttachment" ADD CONSTRAINT "JobAttachment_uploaderUserId_fkey" FOREIGN KEY ("uploaderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAttachment" ADD CONSTRAINT "JobAttachment_businessId_removedByMembershipId_fkey" FOREIGN KEY ("businessId", "removedByMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAttachment" ADD CONSTRAINT "JobAttachment_replacesAttachmentId_fkey" FOREIGN KEY ("replacesAttachmentId") REFERENCES "JobAttachment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMessage" ADD CONSTRAINT "JobMessage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMessage" ADD CONSTRAINT "JobMessage_businessId_jobId_fkey" FOREIGN KEY ("businessId", "jobId") REFERENCES "Job"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMessage" ADD CONSTRAINT "JobMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMessage" ADD CONSTRAINT "JobMessage_businessId_senderMembershipId_fkey" FOREIGN KEY ("businessId", "senderMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMessage" ADD CONSTRAINT "JobMessage_businessId_removedByMembershipId_fkey" FOREIGN KEY ("businessId", "removedByMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMessageAttachment" ADD CONSTRAINT "JobMessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "JobMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMessageAttachment" ADD CONSTRAINT "JobMessageAttachment_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "JobAttachment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobNote" ADD CONSTRAINT "JobNote_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobNote" ADD CONSTRAINT "JobNote_businessId_jobId_fkey" FOREIGN KEY ("businessId", "jobId") REFERENCES "Job"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobNote" ADD CONSTRAINT "JobNote_businessId_authorMembershipId_fkey" FOREIGN KEY ("businessId", "authorMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobNote" ADD CONSTRAINT "JobNote_businessId_archivedByMembershipId_fkey" FOREIGN KEY ("businessId", "archivedByMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffConversation" ADD CONSTRAINT "StaffConversation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffConversation" ADD CONSTRAINT "StaffConversation_businessId_createdByMembershipId_fkey" FOREIGN KEY ("businessId", "createdByMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffConversationParticipant" ADD CONSTRAINT "StaffConversationParticipant_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffConversationParticipant" ADD CONSTRAINT "StaffConversationParticipant_businessId_conversationId_fkey" FOREIGN KEY ("businessId", "conversationId") REFERENCES "StaffConversation"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffConversationParticipant" ADD CONSTRAINT "StaffConversationParticipant_businessId_membershipId_fkey" FOREIGN KEY ("businessId", "membershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMessage" ADD CONSTRAINT "StaffMessage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMessage" ADD CONSTRAINT "StaffMessage_businessId_conversationId_fkey" FOREIGN KEY ("businessId", "conversationId") REFERENCES "StaffConversation"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMessage" ADD CONSTRAINT "StaffMessage_businessId_senderMembershipId_fkey" FOREIGN KEY ("businessId", "senderMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMessage" ADD CONSTRAINT "StaffMessage_businessId_removedByMembershipId_fkey" FOREIGN KEY ("businessId", "removedByMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMessageAttachment" ADD CONSTRAINT "StaffMessageAttachment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMessageAttachment" ADD CONSTRAINT "StaffMessageAttachment_businessId_messageId_fkey" FOREIGN KEY ("businessId", "messageId") REFERENCES "StaffMessage"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMessageAttachment" ADD CONSTRAINT "StaffMessageAttachment_businessId_uploadedByMembershipId_fkey" FOREIGN KEY ("businessId", "uploadedByMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_businessId_recipientUserId_fkey" FOREIGN KEY ("businessId", "recipientUserId") REFERENCES "BusinessMembership"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupVerification" ADD CONSTRAINT "PickupVerification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupVerification" ADD CONSTRAINT "PickupVerification_businessId_jobId_fkey" FOREIGN KEY ("businessId", "jobId") REFERENCES "Job"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupVerification" ADD CONSTRAINT "PickupVerification_businessId_verifiedByMembershipId_fkey" FOREIGN KEY ("businessId", "verifiedByMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupVerification" ADD CONSTRAINT "PickupVerification_businessId_overriddenByMembershipId_fkey" FOREIGN KEY ("businessId", "overriddenByMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StarLedger" ADD CONSTRAINT "StarLedger_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StarLedger" ADD CONSTRAINT "StarLedger_businessId_workerMembershipId_fkey" FOREIGN KEY ("businessId", "workerMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StarLedger" ADD CONSTRAINT "StarLedger_businessId_jobId_fkey" FOREIGN KEY ("businessId", "jobId") REFERENCES "Job"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StarLedger" ADD CONSTRAINT "StarLedger_businessId_actorMembershipId_fkey" FOREIGN KEY ("businessId", "actorMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_businessId_actorMembershipId_fkey" FOREIGN KEY ("businessId", "actorMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain checks that Prisma cannot currently express in the schema.
ALTER TABLE "Business"
  ADD CONSTRAINT "Business_defaultCurrency_format_check"
  CHECK ("defaultCurrency" ~ '^[A-Z]{3}$');

ALTER TABLE "BusinessMembership"
  ADD CONSTRAINT "BusinessMembership_deactivation_check"
  CHECK ("deactivatedAt" IS NULL OR "status" = 'INACTIVE');

ALTER TABLE "WorkerProfile"
  ADD CONSTRAINT "WorkerProfile_capacity_check"
  CHECK ("maxQuickWorkload" >= 0 AND "maxStandardWorkload" >= 0);

ALTER TABLE "Service"
  ADD CONSTRAINT "Service_sortOrder_check"
  CHECK ("sortOrder" >= 0);

ALTER TABLE "Job"
  ADD CONSTRAINT "Job_content_check"
  CHECK (
    btrim("publicReference") <> ''
    AND btrim("title") <> ''
    AND btrim("instructions") <> ''
    AND ("quantity" IS NULL OR "quantity" > 0)
    AND "version" > 0
  );

ALTER TABLE "JobCustomer"
  ADD CONSTRAINT "JobCustomer_identity_check"
  CHECK (
    "userId" IS NOT NULL
    OR nullif(btrim("displayName"), '') IS NOT NULL
    OR nullif(btrim("email"), '') IS NOT NULL
    OR nullif(btrim("phone"), '') IS NOT NULL
  );

ALTER TABLE "JobPricing"
  ADD CONSTRAINT "JobPricing_values_check"
  CHECK (
    "revision" > 0
    AND "currency" ~ '^[A-Z]{3}$'
    AND ("basePriceMinor" IS NULL OR "basePriceMinor" >= 0)
    AND ("expressSurchargeMinor" IS NULL OR "expressSurchargeMinor" >= 0)
    AND ("confirmedTotalMinor" IS NULL OR "confirmedTotalMinor" >= 0)
    AND (
      ("priority" = 'REGULAR' AND "expressSurchargeBasisPoints" = 0)
      OR ("priority" = 'EXPRESS' AND "expressSurchargeBasisPoints" = 4000)
    )
    AND (
      "status" = 'DRAFT'
      OR (
        "basePriceMinor" IS NOT NULL
        AND "expressSurchargeMinor" IS NOT NULL
        AND "confirmedTotalMinor" IS NOT NULL
        AND "confirmedByMembershipId" IS NOT NULL
        AND "confirmedAt" IS NOT NULL
        AND "expressSurchargeMinor" = CASE
          WHEN "priority" = 'EXPRESS'
            THEN floor((("basePriceMinor"::numeric * 4000) + 5000) / 10000)::bigint
          ELSE 0
        END
        AND "confirmedTotalMinor" = "basePriceMinor" + "expressSurchargeMinor"
      )
    )
  );

ALTER TABLE "JobQueueOverride"
  ADD CONSTRAINT "JobQueueOverride_reason_check"
  CHECK (
    btrim("reason") <> ''
    AND (
      ("revokedAt" IS NULL AND "revokedByMembershipId" IS NULL AND "revocationReason" IS NULL)
      OR (
        "revokedAt" IS NOT NULL
        AND "revokedByMembershipId" IS NOT NULL
        AND nullif(btrim("revocationReason"), '') IS NOT NULL
      )
    )
  );

ALTER TABLE "JobAssignment"
  ADD CONSTRAINT "JobAssignment_timeline_check"
  CHECK (
    ("releasedAt" IS NULL OR "releasedAt" >= "assignedAt")
    AND ("completedAt" IS NULL OR "completedAt" >= "assignedAt")
    AND (
      ("releasedAt" IS NULL AND "releasedByMembershipId" IS NULL AND "releaseReason" IS NULL)
      OR (
        "releasedAt" IS NOT NULL
        AND nullif(btrim("releaseReason"), '') IS NOT NULL
      )
    )
  );

ALTER TABLE "JobAttachment"
  ADD CONSTRAINT "JobAttachment_metadata_check"
  CHECK (
    "byteSize" >= 0
    AND ("durationMs" IS NULL OR "durationMs" >= 0)
    AND "version" > 0
    AND btrim("storageKey") <> ''
    AND btrim("originalFilename") <> ''
    AND btrim("mimeType") <> ''
    AND ("replacesAttachmentId" IS NULL OR "replacesAttachmentId" <> "id")
  );

ALTER TABLE "JobNote"
  ADD CONSTRAINT "JobNote_body_check"
  CHECK (btrim("body") <> '');

ALTER TABLE "StaffConversation"
  ADD CONSTRAINT "StaffConversation_directKey_check"
  CHECK ("directKey" IS NULL OR btrim("directKey") <> '');

ALTER TABLE "StaffMessage"
  ADD CONSTRAINT "StaffMessage_content_check"
  CHECK ("kind" <> 'TEXT' OR nullif(btrim("body"), '') IS NOT NULL);

ALTER TABLE "StaffMessageAttachment"
  ADD CONSTRAINT "StaffMessageAttachment_metadata_check"
  CHECK (
    "byteSize" >= 0
    AND ("durationMs" IS NULL OR "durationMs" >= 0)
    AND btrim("storageKey") <> ''
    AND btrim("originalFilename") <> ''
    AND btrim("mimeType") <> ''
    AND ("kind" = 'AUDIO' OR "durationMs" IS NULL)
  );

ALTER TABLE "PickupVerification"
  ADD CONSTRAINT "PickupVerification_state_check"
  CHECK (
    ("expiresAt" IS NULL OR "expiresAt" > "issuedAt")
    AND (
      ("status" = 'ACTIVE' AND "consumedAt" IS NULL AND "verifiedByMembershipId" IS NULL)
      OR (
        "status" = 'CONSUMED'
        AND "consumedAt" IS NOT NULL
        AND "verifiedByMembershipId" IS NOT NULL
      )
      OR ("status" IN ('REVOKED', 'EXPIRED') AND "consumedAt" IS NULL)
    )
    AND (
      ("overriddenAt" IS NULL AND "overriddenByMembershipId" IS NULL AND "overrideReason" IS NULL)
      OR (
        "overriddenAt" IS NOT NULL
        AND "overriddenByMembershipId" IS NOT NULL
        AND nullif(btrim("overrideReason"), '') IS NOT NULL
      )
    )
  );

ALTER TABLE "StarLedger"
  ADD CONSTRAINT "StarLedger_entry_check"
  CHECK (
    "delta" <> 0
    AND btrim("reason") <> ''
    AND (
      "type" <> 'COMPLETION_AWARD'
      OR ("jobId" IS NOT NULL AND "delta" BETWEEN 1 AND 3)
    )
  );

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_content_check"
  CHECK (
    btrim("action") <> ''
    AND btrim("targetType") <> ''
    AND btrim("targetId") <> ''
  );

-- Only one live operational record of each kind may exist at a time.
CREATE UNIQUE INDEX "JobQueueOverride_one_active_per_job"
  ON "JobQueueOverride" ("businessId", "jobId")
  WHERE "revokedAt" IS NULL;

CREATE UNIQUE INDEX "JobAssignment_one_active_primary_per_job"
  ON "JobAssignment" ("businessId", "jobId")
  WHERE "isPrimary" = true AND "releasedAt" IS NULL;

CREATE UNIQUE INDEX "PickupVerification_one_active_per_job"
  ON "PickupVerification" ("businessId", "jobId")
  WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "StarLedger_one_completion_award_per_worker_job"
  ON "StarLedger" ("businessId", "jobId", "workerMembershipId")
  WHERE "type" = 'COMPLETION_AWARD' AND "jobId" IS NOT NULL;

-- Preserve public references once issued.
CREATE FUNCTION prevent_job_reference_change() RETURNS trigger AS $$
BEGIN
  IF NEW."publicReference" IS DISTINCT FROM OLD."publicReference" THEN
    RAISE EXCEPTION 'Job publicReference is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Job_publicReference_immutable"
  BEFORE UPDATE ON "Job"
  FOR EACH ROW EXECUTE FUNCTION prevent_job_reference_change();

-- Confirmed pricing is a commercial snapshot; revisions require a new row.
CREATE FUNCTION protect_confirmed_pricing() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'CONFIRMED' THEN
    RAISE EXCEPTION 'Confirmed JobPricing rows are immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "JobPricing_confirmed_immutable"
  BEFORE UPDATE OR DELETE ON "JobPricing"
  FOR EACH ROW EXECUTE FUNCTION protect_confirmed_pricing();

-- Append-only tables reject updates and deletes. Corrections use new entries.
CREATE FUNCTION protect_append_only_record() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "JobStatusHistory_append_only"
  BEFORE UPDATE OR DELETE ON "JobStatusHistory"
  FOR EACH ROW EXECUTE FUNCTION protect_append_only_record();

CREATE TRIGGER "StarLedger_append_only"
  BEFORE UPDATE OR DELETE ON "StarLedger"
  FOR EACH ROW EXECUTE FUNCTION protect_append_only_record();

CREATE TRIGGER "AuditLog_append_only"
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION protect_append_only_record();

-- Worker-only records must point to worker memberships.
CREATE FUNCTION validate_worker_membership() RETURNS trigger AS $$
DECLARE
  membership_role "MembershipRole";
  membership_status "MembershipStatus";
BEGIN
  SELECT "role", "status" INTO membership_role, membership_status
  FROM "BusinessMembership"
  WHERE "businessId" = NEW."businessId"
    AND "id" = CASE
      WHEN TG_TABLE_NAME = 'WorkerProfile' THEN NEW."membershipId"
      ELSE NEW."workerMembershipId"
    END;

  IF membership_role IS DISTINCT FROM 'WORKER' THEN
    RAISE EXCEPTION '% requires a WORKER membership', TG_TABLE_NAME;
  END IF;
  IF TG_TABLE_NAME = 'JobAssignment' AND membership_status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION 'New JobAssignment requires an active worker membership';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "WorkerProfile_worker_only"
  BEFORE INSERT OR UPDATE OF "businessId", "membershipId" ON "WorkerProfile"
  FOR EACH ROW EXECUTE FUNCTION validate_worker_membership();

CREATE TRIGGER "JobAssignment_worker_only"
  BEFORE INSERT OR UPDATE OF "businessId", "workerMembershipId" ON "JobAssignment"
  FOR EACH ROW EXECUTE FUNCTION validate_worker_membership();

-- Staff messaging is explicitly participant-based and excludes customers.
CREATE FUNCTION validate_staff_conversation_creator() RETURNS trigger AS $$
DECLARE
  creator_role "MembershipRole";
BEGIN
  SELECT "role" INTO creator_role
  FROM "BusinessMembership"
  WHERE "businessId" = NEW."businessId"
    AND "id" = NEW."createdByMembershipId"
    AND "status" = 'ACTIVE';

  IF creator_role IS NULL OR creator_role = 'CUSTOMER' THEN
    RAISE EXCEPTION 'Staff conversations require a staff creator';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StaffConversation_staff_creator"
  BEFORE INSERT OR UPDATE OF "businessId", "createdByMembershipId" ON "StaffConversation"
  FOR EACH ROW EXECUTE FUNCTION validate_staff_conversation_creator();

CREATE FUNCTION validate_staff_participant() RETURNS trigger AS $$
DECLARE
  participant_role "MembershipRole";
BEGIN
  SELECT "role" INTO participant_role
  FROM "BusinessMembership"
  WHERE "businessId" = NEW."businessId"
    AND "id" = NEW."membershipId";

  IF participant_role IS NULL OR participant_role = 'CUSTOMER' THEN
    RAISE EXCEPTION 'Customers cannot participate in staff conversations';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StaffConversationParticipant_staff_only"
  BEFORE INSERT OR UPDATE OF "businessId", "membershipId"
  ON "StaffConversationParticipant"
  FOR EACH ROW EXECUTE FUNCTION validate_staff_participant();

CREATE FUNCTION validate_staff_message_sender() RETURNS trigger AS $$
DECLARE
  sender_role "MembershipRole";
BEGIN
  SELECT membership."role" INTO sender_role
  FROM "BusinessMembership" AS membership
  INNER JOIN "StaffConversationParticipant" AS participant
    ON participant."businessId" = membership."businessId"
    AND participant."membershipId" = membership."id"
  WHERE participant."businessId" = NEW."businessId"
    AND participant."conversationId" = NEW."conversationId"
    AND participant."membershipId" = NEW."senderMembershipId"
    AND participant."leftAt" IS NULL
    AND membership."status" = 'ACTIVE';

  IF sender_role IS NULL OR sender_role = 'CUSTOMER' THEN
    RAISE EXCEPTION 'Staff message sender must be an active staff participant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StaffMessage_active_participant_sender"
  BEFORE INSERT OR UPDATE OF "businessId", "conversationId", "senderMembershipId"
  ON "StaffMessage"
  FOR EACH ROW EXECUTE FUNCTION validate_staff_message_sender();

-- Customer/job messages have explicit sender identity rules.
CREATE FUNCTION validate_job_message_sender() RETURNS trigger AS $$
DECLARE
  staff_role "MembershipRole";
BEGIN
  IF NEW."senderKind" = 'CUSTOMER' THEN
    IF NEW."senderUserId" IS NULL OR NEW."senderMembershipId" IS NOT NULL THEN
      RAISE EXCEPTION 'Customer JobMessage requires a user and no staff membership';
    END IF;
  ELSIF NEW."senderKind" = 'STAFF' THEN
    SELECT "role" INTO staff_role
    FROM "BusinessMembership"
    WHERE "businessId" = NEW."businessId"
      AND "id" = NEW."senderMembershipId";
    IF staff_role IS NULL OR staff_role = 'CUSTOMER' THEN
      RAISE EXCEPTION 'Staff JobMessage requires a staff membership';
    END IF;
  ELSIF NEW."senderUserId" IS NOT NULL OR NEW."senderMembershipId" IS NOT NULL THEN
    RAISE EXCEPTION 'System JobMessage cannot have a human sender';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "JobMessage_sender_integrity"
  BEFORE INSERT OR UPDATE OF "businessId", "senderKind", "senderUserId", "senderMembershipId"
  ON "JobMessage"
  FOR EACH ROW EXECUTE FUNCTION validate_job_message_sender();

-- Version links and message links cannot cross job boundaries.
CREATE FUNCTION validate_attachment_replacement() RETURNS trigger AS $$
DECLARE
  prior_business_id uuid;
  prior_job_id uuid;
  prior_version integer;
BEGIN
  IF NEW."replacesAttachmentId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "businessId", "jobId", "version"
    INTO prior_business_id, prior_job_id, prior_version
  FROM "JobAttachment"
  WHERE "id" = NEW."replacesAttachmentId";

  IF prior_business_id IS DISTINCT FROM NEW."businessId"
    OR prior_job_id IS DISTINCT FROM NEW."jobId"
    OR NEW."version" <> prior_version + 1 THEN
    RAISE EXCEPTION 'Replacement attachment must follow the prior version on the same job';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "JobAttachment_version_integrity"
  BEFORE INSERT OR UPDATE OF "businessId", "jobId", "version", "replacesAttachmentId"
  ON "JobAttachment"
  FOR EACH ROW EXECUTE FUNCTION validate_attachment_replacement();

CREATE FUNCTION validate_job_message_attachment() RETURNS trigger AS $$
DECLARE
  message_job_id uuid;
  attachment_job_id uuid;
BEGIN
  SELECT "jobId" INTO message_job_id FROM "JobMessage" WHERE "id" = NEW."messageId";
  SELECT "jobId" INTO attachment_job_id FROM "JobAttachment" WHERE "id" = NEW."attachmentId";

  IF message_job_id IS DISTINCT FROM attachment_job_id THEN
    RAISE EXCEPTION 'JobMessage attachments must belong to the same job';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "JobMessageAttachment_same_job"
  BEFORE INSERT OR UPDATE ON "JobMessageAttachment"
  FOR EACH ROW EXECUTE FUNCTION validate_job_message_attachment();

-- Completion stars may be recorded only after a verified pickup.
CREATE FUNCTION validate_completion_star_award() RETURNS trigger AS $$
BEGIN
  IF NEW."type" = 'COMPLETION_AWARD' AND NOT EXISTS (
    SELECT 1
    FROM "Job" AS job
    INNER JOIN "PickupVerification" AS pickup
      ON pickup."businessId" = job."businessId"
      AND pickup."jobId" = job."id"
      AND pickup."status" = 'CONSUMED'
    WHERE job."businessId" = NEW."businessId"
      AND job."id" = NEW."jobId"
      AND job."currentStatus" = 'PICKED_UP'
  ) THEN
    RAISE EXCEPTION 'Completion stars require a picked-up job with consumed verification';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StarLedger_completion_requires_pickup"
  BEFORE INSERT ON "StarLedger"
  FOR EACH ROW EXECUTE FUNCTION validate_completion_star_award();
