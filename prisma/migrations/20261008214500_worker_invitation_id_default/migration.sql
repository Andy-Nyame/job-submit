-- Match the project's existing Prisma client-generated UUID convention.
ALTER TABLE "WorkerInvitation"
  ALTER COLUMN "id" DROP DEFAULT;
