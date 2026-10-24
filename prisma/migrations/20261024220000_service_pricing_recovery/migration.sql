-- Brick 7.1 extends versioned JSON pricing without rewriting existing service
-- records and adds nullable linkage for atomic design-plus-print submissions.
ALTER TABLE "Service"
  DROP CONSTRAINT "Service_pricing_configuration_check",
  ADD CONSTRAINT "Service_pricing_configuration_check"
  CHECK (
    "pricingConfiguration" IS NULL
    OR (
      jsonb_typeof("pricingConfiguration") = 'object'
      AND "pricingConfiguration" ->> 'version' IN ('1', '2')
      AND "pricingConfiguration" ->> 'mode' IN ('FIXED', 'ON_REQUEST')
    )
  );

ALTER TABLE "Job"
  ADD COLUMN "submissionGroupReference" VARCHAR(32),
  ADD COLUMN "dependsOnJobId" UUID,
  ADD COLUMN "dependencyClearedAt" TIMESTAMPTZ(3),
  ADD COLUMN "dependencyClearedByMembershipId" UUID;

ALTER TABLE "Job"
  ADD CONSTRAINT "Job_dependency_state_check"
  CHECK (
    ("dependsOnJobId" IS NULL AND "dependencyClearedAt" IS NULL AND "dependencyClearedByMembershipId" IS NULL)
    OR ("dependsOnJobId" IS NOT NULL)
  ),
  ADD CONSTRAINT "Job_businessId_dependsOnJobId_fkey"
  FOREIGN KEY ("businessId", "dependsOnJobId")
  REFERENCES "Job"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Job_businessId_dependencyClearedByMembershipId_fkey"
  FOREIGN KEY ("businessId", "dependencyClearedByMembershipId")
  REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Job_businessId_submissionGroupReference_idx"
  ON "Job"("businessId", "submissionGroupReference");
CREATE INDEX "Job_businessId_dependsOnJobId_dependencyClearedAt_idx"
  ON "Job"("businessId", "dependsOnJobId", "dependencyClearedAt");
