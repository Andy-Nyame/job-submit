-- Brick 6A stores immutable customer submission snapshots, makes initial
-- classification nullable until review when no service default exists, and
-- records short-lived private Blob upload reservations before a job exists.

CREATE TYPE "CustomerUploadStatus" AS ENUM ('PENDING', 'UPLOADED', 'CLAIMED', 'EXPIRED');

ALTER TABLE "Job"
  ADD COLUMN "submissionKey" UUID,
  ADD COLUMN "submissionSnapshot" JSONB,
  ALTER COLUMN "complexity" DROP NOT NULL,
  ALTER COLUMN "workloadClass" DROP NOT NULL;

CREATE TABLE "CustomerUpload" (
  "id" UUID NOT NULL,
  "businessId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "jobId" UUID,
  "status" "CustomerUploadStatus" NOT NULL DEFAULT 'PENDING',
  "storageKey" VARCHAR(500),
  "originalFilename" VARCHAR(255) NOT NULL,
  "mimeType" VARCHAR(160),
  "byteSize" BIGINT,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "uploadedAt" TIMESTAMPTZ(3),
  "claimedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "CustomerUpload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Job_submissionKey_key" ON "Job"("submissionKey");
CREATE UNIQUE INDEX "CustomerUpload_businessId_storageKey_key"
  ON "CustomerUpload"("businessId", "storageKey");
CREATE INDEX "CustomerUpload_businessId_userId_status_expiresAt_idx"
  ON "CustomerUpload"("businessId", "userId", "status", "expiresAt");
CREATE INDEX "CustomerUpload_businessId_jobId_idx"
  ON "CustomerUpload"("businessId", "jobId");

ALTER TABLE "CustomerUpload"
  ADD CONSTRAINT "CustomerUpload_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerUpload"
  ADD CONSTRAINT "CustomerUpload_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerUpload"
  ADD CONSTRAINT "CustomerUpload_businessId_jobId_fkey"
  FOREIGN KEY ("businessId", "jobId") REFERENCES "Job"("businessId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Job" DROP CONSTRAINT "Job_content_check";
ALTER TABLE "Job"
  ADD CONSTRAINT "Job_content_check"
  CHECK (
    btrim("publicReference") <> ''
    AND btrim("title") <> ''
    AND ("quantity" IS NULL OR "quantity" > 0)
    AND "version" > 0
  );

ALTER TABLE "CustomerUpload"
  ADD CONSTRAINT "CustomerUpload_state_check"
  CHECK (
    btrim("originalFilename") <> ''
    AND "expiresAt" > "createdAt"
    AND ("byteSize" IS NULL OR "byteSize" > 0)
    AND (
      (
        "status" = 'PENDING'
        AND "storageKey" IS NULL
        AND "mimeType" IS NULL
        AND "byteSize" IS NULL
        AND "uploadedAt" IS NULL
        AND "claimedAt" IS NULL
        AND "jobId" IS NULL
      )
      OR (
        "status" = 'UPLOADED'
        AND nullif(btrim("storageKey"), '') IS NOT NULL
        AND nullif(btrim("mimeType"), '') IS NOT NULL
        AND "byteSize" IS NOT NULL
        AND "uploadedAt" IS NOT NULL
        AND "claimedAt" IS NULL
        AND "jobId" IS NULL
      )
      OR (
        "status" = 'CLAIMED'
        AND nullif(btrim("storageKey"), '') IS NOT NULL
        AND nullif(btrim("mimeType"), '') IS NOT NULL
        AND "byteSize" IS NOT NULL
        AND "uploadedAt" IS NOT NULL
        AND "claimedAt" IS NOT NULL
        AND "jobId" IS NOT NULL
      )
      OR (
        "status" = 'EXPIRED'
        AND "claimedAt" IS NULL
        AND "jobId" IS NULL
      )
    )
  );

CREATE FUNCTION protect_job_submission_snapshot() RETURNS trigger AS $$
BEGIN
  IF OLD."submissionKey" IS NOT NULL
     AND NEW."submissionKey" IS DISTINCT FROM OLD."submissionKey" THEN
    RAISE EXCEPTION 'Job submissionKey is immutable';
  END IF;
  IF OLD."submissionSnapshot" IS NOT NULL
     AND NEW."submissionSnapshot" IS DISTINCT FROM OLD."submissionSnapshot" THEN
    RAISE EXCEPTION 'Job submissionSnapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Job_submission_snapshot_immutable"
  BEFORE UPDATE OF "submissionKey", "submissionSnapshot" ON "Job"
  FOR EACH ROW EXECUTE FUNCTION protect_job_submission_snapshot();

CREATE FUNCTION protect_claimed_customer_upload() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'CLAIMED' THEN
    RAISE EXCEPTION 'Claimed CustomerUpload rows are immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CustomerUpload_claimed_immutable"
  BEFORE UPDATE OR DELETE ON "CustomerUpload"
  FOR EACH ROW EXECUTE FUNCTION protect_claimed_customer_upload();
