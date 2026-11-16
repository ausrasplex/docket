-- CreateEnum
CREATE TYPE "TextStatus" AS ENUM ('DONE', 'EMPTY', 'FAILED');

-- CreateEnum
CREATE TYPE "TextSource" AS ENUM ('PDF', 'OCR');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "textStatus" "TextStatus";

-- CreateTable
CREATE TABLE "DocumentPage" (
    "documentId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "source" "TextSource" NOT NULL DEFAULT 'PDF',

    CONSTRAINT "DocumentPage_pkey" PRIMARY KEY ("documentId","page")
);

-- AddForeignKey
ALTER TABLE "DocumentPage" ADD CONSTRAINT "DocumentPage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

