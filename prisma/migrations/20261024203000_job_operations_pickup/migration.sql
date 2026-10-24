-- Brick 7 adds small operational metadata to the canonical Job record and
-- makes pickup credentials retrievable only through authenticated application
-- decryption. Existing jobs remain outside the queue and retain one package.
ALTER TABLE "Job"
  ADD COLUMN "queueOrderTier" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "packageCount" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Job"
  ADD CONSTRAINT "Job_operational_metadata_check"
  CHECK (
    "queueOrderTier" BETWEEN -1 AND 1
    AND "packageCount" BETWEEN 1 AND 100
  );

ALTER TABLE "PickupVerification"
  ADD COLUMN "codeCiphertext" VARCHAR(1000),
  ADD COLUMN "credentialVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "issuedByMembershipId" UUID;

-- No production pickup credentials exist before this feature is released.
-- The explicit guard keeps the migration from inventing secrets for legacy rows.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "PickupVerification") THEN
    RAISE EXCEPTION 'PickupVerification must be empty before encrypted credentials are enabled';
  END IF;
END $$;

ALTER TABLE "PickupVerification"
  ALTER COLUMN "codeCiphertext" SET NOT NULL,
  ALTER COLUMN "issuedByMembershipId" SET NOT NULL;

ALTER TABLE "PickupVerification"
  ADD CONSTRAINT "PickupVerification_credential_check"
  CHECK (
    "credentialVersion" = 1
    AND btrim("codeCiphertext") <> ''
  );

ALTER TABLE "PickupVerification"
  ADD CONSTRAINT "PickupVerification_businessId_issuedByMembershipId_fkey"
  FOREIGN KEY ("businessId", "issuedByMembershipId")
  REFERENCES "BusinessMembership"("businessId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "PickupVerification_businessId_issuedByMembershipId_issuedAt_idx"
  ON "PickupVerification"("businessId", "issuedByMembershipId", "issuedAt");
