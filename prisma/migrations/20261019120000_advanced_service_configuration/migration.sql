-- Add optional, snapshot-friendly advanced service configuration.
ALTER TABLE "Service"
  ADD COLUMN "quantityConfiguration" JSONB,
  ADD COLUMN "specificationConfiguration" JSONB,
  ADD COLUMN "indicativePriceMinMinor" BIGINT,
  ADD COLUMN "indicativePriceMaxMinor" BIGINT,
  ADD COLUMN "indicativePriceDescription" VARCHAR(500);

-- Money is stored exactly in Ghana pesewas. A range is either complete or absent.
ALTER TABLE "Service"
  ADD CONSTRAINT "Service_indicative_price_check"
  CHECK (
    (
      "indicativePriceMinMinor" IS NULL
      AND "indicativePriceMaxMinor" IS NULL
      AND "indicativePriceDescription" IS NULL
    )
    OR (
      "indicativePriceMinMinor" BETWEEN 0 AND 100000000
      AND "indicativePriceMaxMinor" BETWEEN "indicativePriceMinMinor" AND 100000000
    )
  ),
  ADD CONSTRAINT "Service_quantity_configuration_check"
  CHECK (
    "quantityConfiguration" IS NULL
    OR (
      jsonb_typeof("quantityConfiguration") = 'object'
      AND "quantityConfiguration" ->> 'version' = '1'
    )
  ),
  ADD CONSTRAINT "Service_specification_configuration_check"
  CHECK (
    "specificationConfiguration" IS NULL
    OR (
      jsonb_typeof("specificationConfiguration") = 'object'
      AND "specificationConfiguration" ->> 'version' = '1'
    )
  );

-- Reconcile only known original seeded names. Custom manager names are untouched,
-- stable IDs/slugs remain unchanged, and repeated execution is a no-op.
UPDATE "Service"
SET "name" = 'Sticker Printing', "updatedAt" = CURRENT_TIMESTAMP, "version" = "version" + 1
WHERE "slug" = 'sav-sticker-printing'
  AND "name" IN ('SAV / Sticker Printing', 'SAV/Sticker Printing');

UPDATE "Service"
SET "name" = 'Banner Printing', "updatedAt" = CURRENT_TIMESTAMP, "version" = "version" + 1
WHERE "slug" = 'flexi-banner-printing'
  AND "name" IN ('Flexi / Banner Printing', 'Flexi/Banner Printing');

UPDATE "Service"
SET "name" = 'For Sale Stickers', "updatedAt" = CURRENT_TIMESTAMP, "version" = "version" + 1
WHERE "slug" = 'for-sale-sticker-printing'
  AND "name" = 'For Sale Sticker Printing';

UPDATE "Service"
SET "name" = 'Container Head & Batch Number Printing', "updatedAt" = CURRENT_TIMESTAMP, "version" = "version" + 1
WHERE "slug" = 'container-head-sticker-batch-numbers-printing'
  AND "name" IN (
    'Container Head/Batch Number Printing',
    'Container Head Sticker / Batch Numbers Printing',
    'Container Head / Batch Number Printing'
  );
