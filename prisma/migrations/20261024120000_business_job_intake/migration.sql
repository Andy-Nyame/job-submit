-- Keep the business operational while allowing management to pause only new
-- customer submissions. Existing businesses remain open after this additive
-- migration; service-level online availability remains independently enforced.
ALTER TABLE "Business"
ADD COLUMN "acceptingNewJobs" BOOLEAN NOT NULL DEFAULT true;
