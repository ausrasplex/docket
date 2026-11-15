-- AlterTable
ALTER TABLE "Space" ADD COLUMN     "coverId" TEXT;

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
