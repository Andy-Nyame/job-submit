-- Worker invitation lifecycle. Raw invitation tokens are never persisted;
-- tokenHash stores a SHA-256 digest of a 256-bit random token.
CREATE TYPE "WorkerInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

ALTER TABLE "BusinessMembership"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "WorkerProfile"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "WorkerInvitation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "businessId" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "status" "WorkerInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "acceptedAt" TIMESTAMPTZ(3),
  "acceptedByMembershipId" UUID,
  "revokedAt" TIMESTAMPTZ(3),
  "revokedByMembershipId" UUID,
  "createdByMembershipId" UUID NOT NULL,
  "replacesInvitationId" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "WorkerInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkerInvitation_tokenHash_key"
  ON "WorkerInvitation"("tokenHash");

CREATE UNIQUE INDEX "WorkerInvitation_replacesInvitationId_key"
  ON "WorkerInvitation"("replacesInvitationId");

CREATE UNIQUE INDEX "WorkerInvitation_businessId_id_key"
  ON "WorkerInvitation"("businessId", "id");

CREATE UNIQUE INDEX "WorkerInvitation_businessId_replacesInvitationId_key"
  ON "WorkerInvitation"("businessId", "replacesInvitationId");

CREATE INDEX "WorkerInvitation_businessId_status_expiresAt_idx"
  ON "WorkerInvitation"("businessId", "status", "expiresAt");

CREATE INDEX "WorkerInvitation_businessId_email_createdAt_idx"
  ON "WorkerInvitation"("businessId", "email", "createdAt");

CREATE UNIQUE INDEX "WorkerInvitation_one_pending_per_email"
  ON "WorkerInvitation"("businessId", "email")
  WHERE "status" = 'PENDING';

ALTER TABLE "WorkerInvitation"
  ADD CONSTRAINT "WorkerInvitation_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerInvitation"
  ADD CONSTRAINT "WorkerInvitation_businessId_createdByMembershipId_fkey"
  FOREIGN KEY ("businessId", "createdByMembershipId")
  REFERENCES "BusinessMembership"("businessId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerInvitation"
  ADD CONSTRAINT "WorkerInvitation_businessId_acceptedByMembershipId_fkey"
  FOREIGN KEY ("businessId", "acceptedByMembershipId")
  REFERENCES "BusinessMembership"("businessId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerInvitation"
  ADD CONSTRAINT "WorkerInvitation_businessId_revokedByMembershipId_fkey"
  FOREIGN KEY ("businessId", "revokedByMembershipId")
  REFERENCES "BusinessMembership"("businessId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerInvitation"
  ADD CONSTRAINT "WorkerInvitation_businessId_replacesInvitationId_fkey"
  FOREIGN KEY ("businessId", "replacesInvitationId")
  REFERENCES "WorkerInvitation"("businessId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BusinessMembership"
  ADD CONSTRAINT "BusinessMembership_version_check"
  CHECK ("version" > 0);

ALTER TABLE "WorkerProfile"
  DROP CONSTRAINT "WorkerProfile_capacity_check";

ALTER TABLE "WorkerProfile"
  ADD CONSTRAINT "WorkerProfile_capacity_check"
  CHECK (
    "maxQuickWorkload" BETWEEN 0 AND 50
    AND "maxStandardWorkload" BETWEEN 0 AND 20
    AND "version" > 0
  );

ALTER TABLE "WorkerInvitation"
  ADD CONSTRAINT "WorkerInvitation_content_check"
  CHECK (
    "email" = lower(btrim("email"))
    AND length("email") > 0
    AND "tokenHash" ~ '^[0-9a-f]{64}$'
    AND "expiresAt" > "createdAt"
    AND "version" > 0
  );

ALTER TABLE "WorkerInvitation"
  ADD CONSTRAINT "WorkerInvitation_lifecycle_check"
  CHECK (
    (
      "status" = 'PENDING'
      AND "acceptedAt" IS NULL
      AND "acceptedByMembershipId" IS NULL
      AND "revokedAt" IS NULL
      AND "revokedByMembershipId" IS NULL
    )
    OR (
      "status" = 'ACCEPTED'
      AND "acceptedAt" IS NOT NULL
      AND "acceptedByMembershipId" IS NOT NULL
      AND "revokedAt" IS NULL
      AND "revokedByMembershipId" IS NULL
    )
    OR (
      "status" = 'EXPIRED'
      AND "acceptedAt" IS NULL
      AND "acceptedByMembershipId" IS NULL
      AND "revokedAt" IS NULL
      AND "revokedByMembershipId" IS NULL
    )
    OR (
      "status" = 'REVOKED'
      AND "acceptedAt" IS NULL
      AND "acceptedByMembershipId" IS NULL
      AND "revokedAt" IS NOT NULL
      AND "revokedByMembershipId" IS NOT NULL
    )
  );
