-- AlterEnum
ALTER TYPE "InviteKind" ADD VALUE 'HOUSEHOLD';

-- AlterTable
ALTER TABLE "user" ADD COLUMN "serverAdmin" BOOLEAN NOT NULL DEFAULT false;

-- The first account on the server runs it
UPDATE "user" SET "serverAdmin" = true WHERE "id" = (SELECT "id" FROM "user" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);
