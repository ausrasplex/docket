-- CreateTable
CREATE TABLE "WorksWith" (
    "aId" TEXT NOT NULL,
    "bId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorksWith_pkey" PRIMARY KEY ("aId","bId")
);

-- CreateIndex
CREATE INDEX "WorksWith_bId_idx" ON "WorksWith"("bId");

-- AddForeignKey
ALTER TABLE "WorksWith" ADD CONSTRAINT "WorksWith_aId_fkey" FOREIGN KEY ("aId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorksWith" ADD CONSTRAINT "WorksWith_bId_fkey" FOREIGN KEY ("bId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
