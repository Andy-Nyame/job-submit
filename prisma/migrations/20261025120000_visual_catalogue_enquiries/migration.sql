-- Brick 7.2 adds business-scoped service galleries and retry-safe read state for
-- the focused Website Design & Creation enquiry conversation.

CREATE TYPE "ServiceImageStatus" AS ENUM ('PENDING', 'READY', 'REMOVED', 'EXPIRED');

ALTER TYPE "NotificationType" ADD VALUE 'WEBSITE_ENQUIRY_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'WEBSITE_ENQUIRY_REPLY';

CREATE TABLE "ServiceImage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "businessId" UUID NOT NULL,
  "serviceId" UUID NOT NULL,
  "status" "ServiceImageStatus" NOT NULL DEFAULT 'PENDING',
  "storageKey" VARCHAR(500),
  "originalFilename" VARCHAR(255) NOT NULL,
  "mimeType" VARCHAR(100),
  "byteSize" BIGINT,
  "altText" VARCHAR(240) NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isCover" BOOLEAN NOT NULL DEFAULT false,
  "uploadedByMembershipId" UUID NOT NULL,
  "replacesImageId" UUID,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "uploadedAt" TIMESTAMPTZ(3),
  "removedAt" TIMESTAMPTZ(3),
  "removedByMembershipId" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "ServiceImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ServiceImage_state_check" CHECK (
    ("status" = 'PENDING' AND "storageKey" IS NULL AND "uploadedAt" IS NULL AND "removedAt" IS NULL)
    OR ("status" = 'READY' AND "storageKey" IS NOT NULL AND "mimeType" IS NOT NULL AND "byteSize" > 0 AND "uploadedAt" IS NOT NULL AND "removedAt" IS NULL)
    OR ("status" IN ('REMOVED', 'EXPIRED') AND "isCover" = false)
  ),
  CONSTRAINT "ServiceImage_alt_text_check" CHECK (nullif(btrim("altText"), '') IS NOT NULL),
  CONSTRAINT "ServiceImage_display_order_check" CHECK ("displayOrder" BETWEEN 0 AND 10000),
  CONSTRAINT "ServiceImage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ServiceImage_businessId_serviceId_fkey" FOREIGN KEY ("businessId", "serviceId") REFERENCES "Service"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ServiceImage_businessId_uploadedByMembershipId_fkey" FOREIGN KEY ("businessId", "uploadedByMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ServiceImage_businessId_removedByMembershipId_fkey" FOREIGN KEY ("businessId", "removedByMembershipId") REFERENCES "BusinessMembership"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ServiceImage_replacesImageId_fkey" FOREIGN KEY ("replacesImageId") REFERENCES "ServiceImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ServiceImage_businessId_id_key" ON "ServiceImage"("businessId", "id");
CREATE UNIQUE INDEX "ServiceImage_businessId_storageKey_key" ON "ServiceImage"("businessId", "storageKey");
CREATE UNIQUE INDEX "ServiceImage_replacesImageId_key" ON "ServiceImage"("replacesImageId");
CREATE UNIQUE INDEX "ServiceImage_one_cover_per_service_key"
  ON "ServiceImage"("businessId", "serviceId")
  WHERE "status" = 'READY' AND "isCover" = true;
CREATE INDEX "ServiceImage_businessId_serviceId_status_displayOrder_idx"
  ON "ServiceImage"("businessId", "serviceId", "status", "displayOrder");
CREATE INDEX "ServiceImage_businessId_status_expiresAt_idx"
  ON "ServiceImage"("businessId", "status", "expiresAt");

ALTER TABLE "JobMessage"
  ADD COLUMN "clientMessageKey" UUID,
  ADD COLUMN "readByCustomerAt" TIMESTAMPTZ(3),
  ADD COLUMN "readByManagementAt" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "JobMessage_clientMessageKey_key" ON "JobMessage"("clientMessageKey");

-- Existing immutable job snapshots continue to understand the legacy embedded
-- poster/label menu. Only future Sticker Printing requests use custom area pricing.
UPDATE "Service"
SET
  "quantityConfiguration" = '{"version":1,"minimum":1,"maximum":null,"increment":1,"presets":[],"unit":"pieces"}'::jsonb,
  "specificationConfiguration" = '{"version":2,"artworkRequirement":"CUSTOMER_PROVIDED","customerFields":[],"customInstructions":"Enter the finished sticker size. Printing-only requests need finished artwork.","finishing":{"options":[],"required":false},"materials":{"options":[],"required":false},"sizes":{"customUnits":["FEET","INCHES","CM","MM","METERS"],"fixed":null,"mode":"CUSTOM","options":[]},"variations":{"enabled":false,"maxItems":50}}'::jsonb,
  "pricingConfiguration" = '{"version":2,"mode":"FIXED","fixed":null,"profile":"STICKER_PRINTING","strategy":"AREA_BASED"}'::jsonb,
  "version" = "version" + 1,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'sav-sticker-printing';

-- New standalone services are deliberately offline until management reviews and
-- explicitly enables each one. Existing shop/service availability is untouched.
INSERT INTO "Service" (
  "id", "businessId", "name", "slug", "description",
  "quantityConfiguration", "specificationConfiguration", "pricingConfiguration",
  "isActive", "onlineSubmissionEnabled", "allowPriceNegotiation", "sortOrder",
  "version", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(), b."id", 'Poster Printing', 'poster-printing',
  'A-series poster printing from customer-provided artwork.',
  '{"version":1,"minimum":2,"maximum":null,"increment":2,"presets":[],"unit":"posters"}'::jsonb,
  '{"version":2,"artworkRequirement":"CUSTOMER_PROVIDED","customerFields":[],"customInstructions":"Choose an A-series size. Printing-only requests need finished artwork.","finishing":{"options":[],"required":false},"materials":{"options":[],"required":false},"sizes":{"customUnits":[],"fixed":null,"mode":"PRESET","options":["A4","A3","A2","A1"]},"variations":{"enabled":false,"maxItems":50}}'::jsonb,
  '{"version":2,"mode":"FIXED","fixed":null,"profile":"POSTER_PRINTING","strategy":"SIZE_VARIANT_QUANTITY_GROUP"}'::jsonb,
  true, false, false, 30, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Business" b
WHERE NOT EXISTS (
  SELECT 1 FROM "Service" s
  WHERE s."businessId" = b."id"
    AND (s."slug" = 'poster-printing' OR lower(s."name") = lower('Poster Printing'))
);

INSERT INTO "Service" (
  "id", "businessId", "name", "slug", "description",
  "quantityConfiguration", "specificationConfiguration", "pricingConfiguration",
  "isActive", "onlineSubmissionEnabled", "allowPriceNegotiation", "sortOrder",
  "version", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(), b."id", 'Label Printing', 'label-printing',
  'Custom-size printed labels prepared from customer-provided artwork.',
  '{"version":1,"minimum":60,"maximum":null,"increment":1,"presets":[],"unit":"labels"}'::jsonb,
  '{"version":2,"artworkRequirement":"CUSTOMER_PROVIDED","customerFields":[{"id":"label-shape","label":"What shape are the labels?","helpText":null,"type":"SELECTION","scope":"JOB","required":true,"options":["Square","Rectangle","Rounded corners","Custom / irregular"],"maxLength":null}],"customInstructions":"Enter the finished size of one label in inches. Printing-only requests need finished artwork.","finishing":{"options":[],"required":false},"materials":{"options":[],"required":false},"sizes":{"customUnits":["INCHES"],"fixed":null,"mode":"CUSTOM","options":[]},"variations":{"enabled":false,"maxItems":50}}'::jsonb,
  '{"version":2,"mode":"FIXED","fixed":null,"profile":"LABEL_PRINTING","strategy":"MATERIAL_LAYOUT_PLUS_CUTTING"}'::jsonb,
  true, false, false, 40, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Business" b
WHERE NOT EXISTS (
  SELECT 1 FROM "Service" s
  WHERE s."businessId" = b."id"
    AND (s."slug" = 'label-printing' OR lower(s."name") = lower('Label Printing'))
);

INSERT INTO "Service" (
  "id", "businessId", "name", "slug", "description",
  "quantityConfiguration", "specificationConfiguration", "pricingConfiguration",
  "isActive", "onlineSubmissionEnabled", "allowPriceNegotiation", "sortOrder",
  "version", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(), b."id", 'Website Design & Creation', 'website-design-creation',
  'We design and build websites for businesses, online shops, organisations and personal brands.',
  NULL, NULL,
  '{"version":1,"mode":"ON_REQUEST","fixed":null}'::jsonb,
  true, false, false, 90, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Business" b
WHERE NOT EXISTS (
  SELECT 1 FROM "Service" s
  WHERE s."businessId" = b."id"
    AND (s."slug" = 'website-design-creation' OR lower(s."name") = lower('Website Design & Creation'))
);

UPDATE "Service" SET "sortOrder" = 50, "updatedAt" = CURRENT_TIMESTAMP WHERE "slug" = 'flexi-banner-printing' AND "sortOrder" = 30;
UPDATE "Service" SET "sortOrder" = 60, "updatedAt" = CURRENT_TIMESTAMP WHERE "slug" = 'document-printing' AND "sortOrder" = 40;
UPDATE "Service" SET "sortOrder" = 70, "updatedAt" = CURRENT_TIMESTAMP WHERE "slug" = 'for-sale-sticker-printing' AND "sortOrder" = 50;
UPDATE "Service" SET "sortOrder" = 80, "updatedAt" = CURRENT_TIMESTAMP WHERE "slug" = 'container-head-sticker-batch-numbers-printing' AND "sortOrder" = 60;
