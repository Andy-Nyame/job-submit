-- Brick 6D extends the existing persistent Notification model with focused
-- action-center events and recipient-scoped retry deduplication.

ALTER TYPE "NotificationType" ADD VALUE 'COSTING_REQUIRED';
ALTER TYPE "NotificationType" ADD VALUE 'JOB_STATUS_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'QUOTATION_ISSUED';
ALTER TYPE "NotificationType" ADD VALUE 'QUOTATION_REVISED';
ALTER TYPE "NotificationType" ADD VALUE 'QUOTATION_WITHDRAWN';
ALTER TYPE "NotificationType" ADD VALUE 'QUOTATION_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'QUOTATION_DECLINED';
ALTER TYPE "NotificationType" ADD VALUE 'QUOTATION_EXPIRED';
ALTER TYPE "NotificationType" ADD VALUE 'COUNTEROFFER_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'COUNTEROFFER_DECLINED';

ALTER TABLE "Notification"
  ADD COLUMN "eventKey" VARCHAR(180);

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_eventKey_nonempty_check"
  CHECK ("eventKey" IS NULL OR nullif(btrim("eventKey"), '') IS NOT NULL);

CREATE UNIQUE INDEX "Notification_businessId_recipientUserId_eventKey_key"
  ON "Notification"("businessId", "recipientUserId", "eventKey");
