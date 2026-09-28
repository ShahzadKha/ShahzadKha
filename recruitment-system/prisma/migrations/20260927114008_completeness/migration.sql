-- AlterEnum
ALTER TYPE "CandidateSource" ADD VALUE 'REFERRAL';

-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'REFERRAL_CREATED';

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "recycleCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "referredById" TEXT,
ADD COLUMN     "sourceDetail" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "platformUrl" TEXT;

-- CreateTable
CREATE TABLE "InboundEmail" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "subject" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "detail" TEXT,
    "candidateId" TEXT,

    CONSTRAINT "InboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InboundEmail_messageId_key" ON "InboundEmail"("messageId");

-- CreateIndex
CREATE INDEX "InboundEmail_processedAt_idx" ON "InboundEmail"("processedAt");
