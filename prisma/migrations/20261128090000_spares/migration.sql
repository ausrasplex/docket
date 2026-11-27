-- AlterTable
ALTER TABLE "Fixture" ADD COLUMN     "sparesEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Spare" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partNumber" TEXT,
    "buyUrl" TEXT,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "lowAt" INTEGER,
    "everyMonths" INTEGER,
    "lastReplacedAt" DATE,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Spare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Spare_fixtureId_idx" ON "Spare"("fixtureId");

-- CreateIndex
CREATE INDEX "Spare_householdId_idx" ON "Spare"("householdId");

-- AddForeignKey
ALTER TABLE "Spare" ADD CONSTRAINT "Spare_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spare" ADD CONSTRAINT "Spare_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

