-- CreateTable
CREATE TABLE "ServerConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "maxUploadMb" INTEGER NOT NULL DEFAULT 25,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServerConfig_pkey" PRIMARY KEY ("id")
);
