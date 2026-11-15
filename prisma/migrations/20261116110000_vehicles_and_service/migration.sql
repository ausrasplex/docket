-- AlterEnum
ALTER TYPE "FixtureCategory" ADD VALUE 'VEHICLE';

-- AlterTable
ALTER TABLE "Fixture" ADD COLUMN     "odometer" INTEGER,
ADD COLUMN     "registration" TEXT,
ADD COLUMN     "registrationExpiresAt" DATE,
ADD COLUMN     "vin" TEXT;

-- CreateTable
CREATE TABLE "ServicePlan" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "everyMonths" INTEGER,
    "everyKm" INTEGER,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRecord" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "odometer" INTEGER,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "contactId" TEXT,
    "expenseId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ServicePlanToServiceRecord" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ServicePlanToServiceRecord_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "ServicePlan_fixtureId_idx" ON "ServicePlan"("fixtureId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRecord_expenseId_key" ON "ServiceRecord"("expenseId");

-- CreateIndex
CREATE INDEX "ServiceRecord_fixtureId_date_idx" ON "ServiceRecord"("fixtureId", "date");

-- CreateIndex
CREATE INDEX "_ServicePlanToServiceRecord_B_index" ON "_ServicePlanToServiceRecord"("B");

-- AddForeignKey
ALTER TABLE "ServicePlan" ADD CONSTRAINT "ServicePlan_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePlan" ADD CONSTRAINT "ServicePlan_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRecord" ADD CONSTRAINT "ServiceRecord_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRecord" ADD CONSTRAINT "ServiceRecord_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRecord" ADD CONSTRAINT "ServiceRecord_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRecord" ADD CONSTRAINT "ServiceRecord_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ServicePlanToServiceRecord" ADD CONSTRAINT "_ServicePlanToServiceRecord_A_fkey" FOREIGN KEY ("A") REFERENCES "ServicePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ServicePlanToServiceRecord" ADD CONSTRAINT "_ServicePlanToServiceRecord_B_fkey" FOREIGN KEY ("B") REFERENCES "ServiceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
