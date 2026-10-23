-- Brick 6C adds opt-in negotiation and an immutable, versioned quotation
-- workflow without changing existing fixed-price submission snapshots.

CREATE TYPE "JobQuotationStatus" AS ENUM (
  'DRAFT',
  'ISSUED',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'SUPERSEDED',
  'WITHDRAWN'
);

CREATE TYPE "QuotationCounterofferStatus" AS ENUM (
  'PENDING',
  'DECLINED',
  'SUPERSEDED'
);

ALTER TABLE "Service"
  ADD COLUMN "allowPriceNegotiation" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Service"
  ADD CONSTRAINT "Service_negotiation_manual_pricing_only_check"
  CHECK (
    "allowPriceNegotiation" = false
    OR (
      "pricingConfiguration" IS NOT NULL
      AND "pricingConfiguration" ->> 'mode' = 'ON_REQUEST'
    )
  );

CREATE TABLE "JobQuotation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "businessId" UUID NOT NULL,
  "jobId" UUID NOT NULL,
  "publicReference" VARCHAR(32) NOT NULL,
  "quotationVersion" INTEGER NOT NULL,
  "status" "JobQuotationStatus" NOT NULL DEFAULT 'DRAFT',
  "priority" "JobPriority" NOT NULL,
  "lineItems" JSONB NOT NULL,
  "subtotalMinor" BIGINT NOT NULL,
  "expressSurchargeBasisPoints" INTEGER NOT NULL DEFAULT 0,
  "expressSurchargeMinor" BIGINT NOT NULL,
  "totalMinor" BIGINT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "customerNote" VARCHAR(2000),
  "negotiationAllowed" BOOLEAN NOT NULL DEFAULT false,
  "validityDays" INTEGER NOT NULL DEFAULT 7,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "createdByMembershipId" UUID NOT NULL,
  "issuedByMembershipId" UUID,
  "issuedAt" TIMESTAMPTZ(3),
  "decidedByUserId" UUID,
  "acceptedAt" TIMESTAMPTZ(3),
  "declinedAt" TIMESTAMPTZ(3),
  "supersededAt" TIMESTAMPTZ(3),
  "withdrawnAt" TIMESTAMPTZ(3),
  "withdrawnByMembershipId" UUID,
  "withdrawalReason" VARCHAR(500),
  "replacesQuotationId" UUID,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "JobQuotation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuotationCounteroffer" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "businessId" UUID NOT NULL,
  "quotationId" UUID NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "customerNote" VARCHAR(1000),
  "status" "QuotationCounterofferStatus" NOT NULL DEFAULT 'PENDING',
  "submittedByUserId" UUID NOT NULL,
  "reviewedByMembershipId" UUID,
  "respondedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "QuotationCounteroffer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobQuotation_publicReference_key"
  ON "JobQuotation"("publicReference");
CREATE UNIQUE INDEX "JobQuotation_businessId_id_key"
  ON "JobQuotation"("businessId", "id");
CREATE UNIQUE INDEX "JobQuotation_jobId_quotationVersion_key"
  ON "JobQuotation"("jobId", "quotationVersion");
CREATE INDEX "JobQuotation_businessId_jobId_status_version_idx"
  ON "JobQuotation"("businessId", "jobId", "status", "quotationVersion");
CREATE INDEX "JobQuotation_businessId_status_expiresAt_idx"
  ON "JobQuotation"("businessId", "status", "expiresAt");
CREATE UNIQUE INDEX "JobQuotation_one_draft_per_job"
  ON "JobQuotation"("businessId", "jobId") WHERE "status" = 'DRAFT';
CREATE UNIQUE INDEX "JobQuotation_one_issued_per_job"
  ON "JobQuotation"("businessId", "jobId") WHERE "status" = 'ISSUED';
CREATE UNIQUE INDEX "JobQuotation_one_accepted_per_job"
  ON "JobQuotation"("businessId", "jobId") WHERE "status" = 'ACCEPTED';

CREATE UNIQUE INDEX "QuotationCounteroffer_businessId_id_key"
  ON "QuotationCounteroffer"("businessId", "id");
CREATE INDEX "QuotationCounteroffer_business_quote_status_created_idx"
  ON "QuotationCounteroffer"("businessId", "quotationId", "status", "createdAt");
CREATE UNIQUE INDEX "QuotationCounteroffer_one_pending_per_quotation"
  ON "QuotationCounteroffer"("businessId", "quotationId") WHERE "status" = 'PENDING';

ALTER TABLE "JobQuotation"
  ADD CONSTRAINT "JobQuotation_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobQuotation"
  ADD CONSTRAINT "JobQuotation_businessId_jobId_fkey"
  FOREIGN KEY ("businessId", "jobId") REFERENCES "Job"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobQuotation"
  ADD CONSTRAINT "JobQuotation_createdBy_fkey"
  FOREIGN KEY ("businessId", "createdByMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobQuotation"
  ADD CONSTRAINT "JobQuotation_issuedBy_fkey"
  FOREIGN KEY ("businessId", "issuedByMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobQuotation"
  ADD CONSTRAINT "JobQuotation_withdrawnBy_fkey"
  FOREIGN KEY ("businessId", "withdrawnByMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobQuotation"
  ADD CONSTRAINT "JobQuotation_decidedBy_fkey"
  FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobQuotation"
  ADD CONSTRAINT "JobQuotation_replaces_fkey"
  FOREIGN KEY ("businessId", "replacesQuotationId") REFERENCES "JobQuotation"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "QuotationCounteroffer"
  ADD CONSTRAINT "QuotationCounteroffer_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuotationCounteroffer"
  ADD CONSTRAINT "QuotationCounteroffer_quotation_fkey"
  FOREIGN KEY ("businessId", "quotationId") REFERENCES "JobQuotation"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuotationCounteroffer"
  ADD CONSTRAINT "QuotationCounteroffer_submittedBy_fkey"
  FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuotationCounteroffer"
  ADD CONSTRAINT "QuotationCounteroffer_reviewedBy_fkey"
  FOREIGN KEY ("businessId", "reviewedByMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JobQuotation"
  ADD CONSTRAINT "JobQuotation_values_check"
  CHECK (
    "quotationVersion" > 0
    AND "rowVersion" > 0
    AND "validityDays" BETWEEN 1 AND 90
    AND "currency" ~ '^[A-Z]{3}$'
    AND jsonb_typeof("lineItems") = 'array'
    AND jsonb_array_length("lineItems") BETWEEN 1 AND 20
    AND "subtotalMinor" > 0
    AND "expressSurchargeMinor" >= 0
    AND "totalMinor" > 0
    AND (
      ("priority" = 'REGULAR' AND "expressSurchargeBasisPoints" = 0 AND "expressSurchargeMinor" = 0)
      OR (
        "priority" = 'EXPRESS'
        AND "expressSurchargeBasisPoints" = 4000
        AND "expressSurchargeMinor" = floor((("subtotalMinor"::numeric * 4000) + 5000) / 10000)::bigint
      )
    )
    AND "totalMinor" = "subtotalMinor" + "expressSurchargeMinor"
    AND (
      ("status" = 'DRAFT' AND "issuedAt" IS NULL AND "issuedByMembershipId" IS NULL)
      OR ("status" = 'WITHDRAWN' AND (
        ("issuedAt" IS NULL AND "issuedByMembershipId" IS NULL)
        OR ("issuedAt" IS NOT NULL AND "issuedByMembershipId" IS NOT NULL)
      ))
      OR ("status" NOT IN ('DRAFT', 'WITHDRAWN') AND "issuedAt" IS NOT NULL AND "issuedByMembershipId" IS NOT NULL)
    )
    AND (
      ("status" = 'ACCEPTED' AND "acceptedAt" IS NOT NULL AND "decidedByUserId" IS NOT NULL)
      OR ("status" <> 'ACCEPTED' AND "acceptedAt" IS NULL)
    )
    AND (
      ("status" = 'DECLINED' AND "declinedAt" IS NOT NULL AND "decidedByUserId" IS NOT NULL)
      OR ("status" <> 'DECLINED' AND "declinedAt" IS NULL)
    )
    AND (
      ("status" = 'SUPERSEDED' AND "supersededAt" IS NOT NULL)
      OR ("status" <> 'SUPERSEDED' AND "supersededAt" IS NULL)
    )
    AND (
      (
        "status" = 'WITHDRAWN'
        AND "withdrawnAt" IS NOT NULL
        AND "withdrawnByMembershipId" IS NOT NULL
        AND nullif(btrim("withdrawalReason"), '') IS NOT NULL
      )
      OR (
        "status" <> 'WITHDRAWN'
        AND "withdrawnAt" IS NULL
        AND "withdrawnByMembershipId" IS NULL
        AND "withdrawalReason" IS NULL
      )
    )
  );

ALTER TABLE "QuotationCounteroffer"
  ADD CONSTRAINT "QuotationCounteroffer_values_check"
  CHECK (
    "amountMinor" > 0
    AND (
      ("status" = 'PENDING' AND "reviewedByMembershipId" IS NULL AND "respondedAt" IS NULL)
      OR ("status" = 'DECLINED' AND "reviewedByMembershipId" IS NOT NULL AND "respondedAt" IS NOT NULL)
      OR ("status" = 'SUPERSEDED' AND "respondedAt" IS NOT NULL)
    )
  );

CREATE FUNCTION protect_job_quotation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'JobQuotation records are preserved';
  END IF;
  IF NEW."publicReference" IS DISTINCT FROM OLD."publicReference"
    OR NEW."businessId" IS DISTINCT FROM OLD."businessId"
    OR NEW."jobId" IS DISTINCT FROM OLD."jobId"
    OR NEW."quotationVersion" IS DISTINCT FROM OLD."quotationVersion"
    OR NEW."createdByMembershipId" IS DISTINCT FROM OLD."createdByMembershipId" THEN
    RAISE EXCEPTION 'JobQuotation identity is immutable';
  END IF;
  IF OLD."status" <> 'DRAFT' AND (
    NEW."priority" IS DISTINCT FROM OLD."priority"
    OR NEW."lineItems" IS DISTINCT FROM OLD."lineItems"
    OR NEW."subtotalMinor" IS DISTINCT FROM OLD."subtotalMinor"
    OR NEW."expressSurchargeBasisPoints" IS DISTINCT FROM OLD."expressSurchargeBasisPoints"
    OR NEW."expressSurchargeMinor" IS DISTINCT FROM OLD."expressSurchargeMinor"
    OR NEW."totalMinor" IS DISTINCT FROM OLD."totalMinor"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."customerNote" IS DISTINCT FROM OLD."customerNote"
    OR NEW."negotiationAllowed" IS DISTINCT FROM OLD."negotiationAllowed"
    OR NEW."validityDays" IS DISTINCT FROM OLD."validityDays"
    OR NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt"
    OR NEW."issuedByMembershipId" IS DISTINCT FROM OLD."issuedByMembershipId"
    OR NEW."issuedAt" IS DISTINCT FROM OLD."issuedAt"
  ) THEN
    RAISE EXCEPTION 'Issued JobQuotation financial terms are immutable';
  END IF;
  IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
    (OLD."status" = 'DRAFT' AND NEW."status" IN ('ISSUED', 'WITHDRAWN'))
    OR (OLD."status" = 'ISSUED' AND NEW."status" IN ('ACCEPTED', 'DECLINED', 'EXPIRED', 'SUPERSEDED', 'WITHDRAWN'))
  ) THEN
    RAISE EXCEPTION 'Invalid JobQuotation status transition';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "JobQuotation_protected"
  BEFORE UPDATE OR DELETE ON "JobQuotation"
  FOR EACH ROW EXECUTE FUNCTION protect_job_quotation();

CREATE FUNCTION protect_quotation_counteroffer() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'QuotationCounteroffer records are preserved';
  END IF;
  IF NEW."businessId" IS DISTINCT FROM OLD."businessId"
    OR NEW."quotationId" IS DISTINCT FROM OLD."quotationId"
    OR NEW."amountMinor" IS DISTINCT FROM OLD."amountMinor"
    OR NEW."customerNote" IS DISTINCT FROM OLD."customerNote"
    OR NEW."submittedByUserId" IS DISTINCT FROM OLD."submittedByUserId" THEN
    RAISE EXCEPTION 'QuotationCounteroffer proposal is immutable';
  END IF;
  IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
    OLD."status" = 'PENDING' AND NEW."status" IN ('DECLINED', 'SUPERSEDED')
  ) THEN
    RAISE EXCEPTION 'Invalid QuotationCounteroffer status transition';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "QuotationCounteroffer_protected"
  BEFORE UPDATE OR DELETE ON "QuotationCounteroffer"
  FOR EACH ROW EXECUTE FUNCTION protect_quotation_counteroffer();
