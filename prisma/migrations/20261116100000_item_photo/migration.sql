-- AlterTable
ALTER TABLE "Fixture" ADD COLUMN     "coverCrop" JSONB,
ADD COLUMN     "coverCropKey" TEXT,
ADD COLUMN     "coverId" TEXT;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
