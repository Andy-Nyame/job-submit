-- Add the stable external identity used by Supabase Auth. Existing application
-- users remain claimable because the binding is nullable until first sign-in.
ALTER TABLE "User"
  ADD COLUMN "supabaseAuthUserId" UUID;

-- Normalize existing contact identities before enforcing the same invariant
-- used by server-side provisioning. Fail closed if historical rows would
-- collide after normalization instead of merging them automatically.
DO $$
BEGIN
  IF EXISTS (
    SELECT lower(btrim("email"))
    FROM "User"
    WHERE "email" IS NOT NULL
    GROUP BY lower(btrim("email"))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'User emails collide after normalization';
  END IF;
END;
$$;

UPDATE "User"
SET "email" = lower(btrim("email"))
WHERE "email" IS NOT NULL
  AND "email" IS DISTINCT FROM lower(btrim("email"));

ALTER TABLE "User"
  ADD CONSTRAINT "User_email_normalized_check"
  CHECK (
    "email" IS NULL
    OR (
      "email" = lower(btrim("email"))
      AND length("email") > 0
    )
  );

CREATE UNIQUE INDEX "User_supabaseAuthUserId_key"
  ON "User"("supabaseAuthUserId");
