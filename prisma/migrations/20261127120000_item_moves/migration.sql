-- CreateEnum
CREATE TYPE "ItemMoveKind" AS ENUM ('MOVED', 'LENT', 'RETURNED');

-- AlterTable
ALTER TABLE "Fixture" ADD COLUMN     "lentAt" DATE,
ADD COLUMN     "lentDueBack" DATE,
ADD COLUMN     "lentTo" TEXT,
ADD COLUMN     "location" TEXT;

-- CreateTable
CREATE TABLE "ItemMove" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "kind" "ItemMoveKind" NOT NULL,
    "date" DATE NOT NULL,
    "place" TEXT,
    "person" TEXT,
    "dueBack" DATE,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemMove_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemMove_fixtureId_date_idx" ON "ItemMove"("fixtureId", "date");

-- CreateIndex
CREATE INDEX "ItemMove_householdId_idx" ON "ItemMove"("householdId");

-- AddForeignKey
ALTER TABLE "ItemMove" ADD CONSTRAINT "ItemMove_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemMove" ADD CONSTRAINT "ItemMove_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

