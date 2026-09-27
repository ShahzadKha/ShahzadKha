-- AlterTable
ALTER TABLE "EmailSequence" ADD COLUMN     "kind" "SequenceKind" NOT NULL DEFAULT 'NURTURE',
ALTER COLUMN "track" DROP NOT NULL;
