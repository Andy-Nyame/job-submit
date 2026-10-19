-- Add the new fixed-price / price-on-request contract without converting or
-- deleting Brick 5.1 indicative-price data.
ALTER TABLE "Service"
  ADD COLUMN "pricingConfiguration" JSONB;

ALTER TABLE "Service"
  ADD CONSTRAINT "Service_pricing_configuration_check"
  CHECK (
    "pricingConfiguration" IS NULL
    OR (
      jsonb_typeof("pricingConfiguration") = 'object'
      AND "pricingConfiguration" ->> 'version' = '1'
      AND "pricingConfiguration" ->> 'mode' IN ('FIXED', 'ON_REQUEST')
    )
  );

-- Brick 5.2 specification documents use version 2. Version 1 remains valid so
-- existing manager configuration is preserved and can be adapted by the app.
ALTER TABLE "Service"
  DROP CONSTRAINT "Service_specification_configuration_check",
  ADD CONSTRAINT "Service_specification_configuration_check"
  CHECK (
    "specificationConfiguration" IS NULL
    OR (
      jsonb_typeof("specificationConfiguration") = 'object'
      AND "specificationConfiguration" ->> 'version' IN ('1', '2')
    )
  );
