-- CreateEnum
CREATE TYPE "RoutingTrack" AS ENUM ('EDUCATIONAL', 'LIGHT', 'CONVERSION', 'CALL_INVITE', 'PRIORITY_SDR');

-- CreateEnum
CREATE TYPE "AnalysisState" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'ANALYSIS_FAILED';
ALTER TYPE "EventType" ADD VALUE 'ROUTED';

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "analysisError" TEXT,
ADD COLUMN     "analysisMode" TEXT,
ADD COLUMN     "analysisModel" TEXT,
ADD COLUMN     "analyzedAt" TIMESTAMP(3),
ADD COLUMN     "consentAt" TIMESTAMP(3),
ADD COLUMN     "motivation" TEXT,
ADD COLUMN     "phoneKey" TEXT,
ADD COLUMN     "routingTrack" "RoutingTrack";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "keywords" TEXT[];

-- CreateTable
CREATE TABLE "CvFile" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CvFile_candidateId_key" ON "CvFile"("candidateId");

-- CreateIndex
CREATE INDEX "Candidate_phoneKey_idx" ON "Candidate"("phoneKey");

-- AddForeignKey
ALTER TABLE "CvFile" ADD CONSTRAINT "CvFile_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
