-- Add optimistic concurrency protection for service management.
ALTER TABLE "Service"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Keep service records valid independently of application-layer validation.
ALTER TABLE "Service"
  ADD CONSTRAINT "Service_management_check"
  CHECK (
    btrim("name") <> ''
    AND btrim("slug") <> ''
    AND "sortOrder" BETWEEN 0 AND 10000
    AND "version" > 0
    AND ("description" IS NULL OR char_length("description") <= 2000)
  );
