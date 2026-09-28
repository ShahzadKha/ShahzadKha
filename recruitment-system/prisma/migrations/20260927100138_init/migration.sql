-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SDR', 'RECRUITER');

-- CreateEnum
CREATE TYPE "CandidateSource" AS ENUM ('EMAIL', 'WEB_FORM', 'CSV_IMPORT', 'FILE_DROP', 'MANUAL');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('NEW_CV', 'CV_PARSED', 'GPT_ANALYZED', 'NOT_ELIGIBLE', 'PRODUCT_MATCHED', 'EMAIL_1_SENT', 'ENGAGED', 'INTEREST_CONFIRMED', 'OFFER_SENT', 'PRICE_VIEWED', 'PURCHASE_READY', 'SDR_ASSIGNED', 'CALL_COMPLETED', 'WON', 'LOST', 'NURTURE');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CREATED', 'UPDATED', 'DUPLICATE_MERGED', 'CV_PARSED', 'AI_ANALYZED', 'STATUS_CHANGED', 'EMAIL_SENT', 'EMAIL_OPENED', 'EMAIL_CLICKED', 'EMAIL_REPLIED', 'PRICE_VIEWED', 'SDR_ASSIGNED', 'CALL_LOGGED', 'PAYMENT_CONFIRMED', 'NOTE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'RECRUITER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "country" TEXT,
    "source" "CandidateSource" NOT NULL,
    "status" "CandidateStatus" NOT NULL DEFAULT 'NEW_CV',
    "currentTitle" TEXT,
    "yearsExperience" INTEGER,
    "education" TEXT,
    "skills" TEXT[],
    "languages" TEXT[],
    "linkedinUrl" TEXT,
    "cvFileName" TEXT,
    "cvText" TEXT,
    "persona" TEXT,
    "skillGap" TEXT,
    "aiSummary" TEXT,
    "fitScore" INTEGER,
    "needScore" INTEGER,
    "intentScore" INTEGER,
    "globalScore" INTEGER,
    "eligible" BOOLEAN,
    "recommendedProductId" TEXT,
    "interestConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "priceViewed" BOOLEAN NOT NULL DEFAULT false,
    "timingDays" INTEGER,
    "assignedSdrId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateEvent" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "toStatus" "CandidateStatus",
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_email_key" ON "Candidate"("email");

-- CreateIndex
CREATE INDEX "Candidate_status_idx" ON "Candidate"("status");

-- CreateIndex
CREATE INDEX "Candidate_globalScore_idx" ON "Candidate"("globalScore");

-- CreateIndex
CREATE INDEX "CandidateEvent_candidateId_createdAt_idx" ON "CandidateEvent"("candidateId", "createdAt");

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_recommendedProductId_fkey" FOREIGN KEY ("recommendedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_assignedSdrId_fkey" FOREIGN KEY ("assignedSdrId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateEvent" ADD CONSTRAINT "CandidateEvent_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateEvent" ADD CONSTRAINT "CandidateEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
