-- AlterEnum
ALTER TYPE "FinishKind" ADD VALUE 'GROUT';
ALTER TYPE "FinishKind" ADD VALUE 'SEALANT';

-- AlterTable
ALTER TABLE "Fixture" ADD COLUMN "store" TEXT, ADD COLUMN "colour" TEXT, ADD COLUMN "size" TEXT;
ALTER TABLE "Finish" ADD COLUMN "size" TEXT, ADD COLUMN "store" TEXT;
