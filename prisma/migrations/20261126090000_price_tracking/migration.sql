-- CreateTable
CREATE TABLE "PriceSource" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "selector" TEXT,
    "lastPrice" DECIMAL(12,2),
    "lastOkAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "failingSince" TIMESTAMP(3),
    "pendingPrice" DECIMAL(12,2),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceCheck" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "inStock" BOOLEAN,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceSource_householdId_idx" ON "PriceSource"("householdId");

-- CreateIndex
CREATE INDEX "PriceSource_fixtureId_idx" ON "PriceSource"("fixtureId");

-- CreateIndex
CREATE INDEX "PriceSource_lastCheckedAt_idx" ON "PriceSource"("lastCheckedAt");

-- CreateIndex
CREATE INDEX "PriceCheck_sourceId_checkedAt_idx" ON "PriceCheck"("sourceId", "checkedAt");

-- AddForeignKey
ALTER TABLE "PriceSource" ADD CONSTRAINT "PriceSource_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSource" ADD CONSTRAINT "PriceSource_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceCheck" ADD CONSTRAINT "PriceCheck_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "PriceSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

