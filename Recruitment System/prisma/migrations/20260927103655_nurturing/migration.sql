-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'STOPPED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'UNSUBSCRIBED';
ALTER TYPE "EventType" ADD VALUE 'SEQUENCE_STARTED';
ALTER TYPE "EventType" ADD VALUE 'SEQUENCE_ENDED';

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "publicToken" TEXT,
ADD COLUMN     "unsubscribedAt" TIMESTAMP(3);

-- Give existing candidates a random public token, then make it required
UPDATE "Candidate" SET "publicToken" = md5(random()::text || clock_timestamp()::text || "id");
ALTER TABLE "Candidate" ALTER COLUMN "publicToken" SET NOT NULL;

-- CreateTable
CREATE TABLE "EmailSequence" (
    "id" TEXT NOT NULL,
    "track" "RoutingTrack" NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailStep" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "dayOffset" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isOffer" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EmailStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "stepsSent" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextSendAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "stepId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'sequence',
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailSequence_track_key" ON "EmailSequence"("track");

-- CreateIndex
CREATE UNIQUE INDEX "EmailStep_sequenceId_order_key" ON "EmailStep"("sequenceId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_candidateId_key" ON "Enrollment"("candidateId");

-- CreateIndex
CREATE INDEX "Enrollment_status_nextSendAt_idx" ON "Enrollment"("status", "nextSendAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_token_key" ON "EmailMessage"("token");

-- CreateIndex
CREATE INDEX "EmailMessage_candidateId_sentAt_idx" ON "EmailMessage"("candidateId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_publicToken_key" ON "Candidate"("publicToken");

-- AddForeignKey
ALTER TABLE "EmailStep" ADD CONSTRAINT "EmailStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "EmailSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "EmailSequence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "EmailStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

