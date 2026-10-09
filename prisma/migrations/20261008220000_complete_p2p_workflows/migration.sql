BEGIN;
-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_ownerId_fkey";

-- DropIndex
DROP INDEX "Asset_ownerId_idx";

-- DropIndex
DROP INDEX "AssetMessage_assetId_idx";

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "moderatorSeenAt" TIMESTAMP(3),
ADD COLUMN     "ownerSeenAt" TIMESTAMP(3),
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "lenderId" TEXT,
ADD COLUMN     "lenderSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RequestBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submissionKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationNotice" (
    "id" TEXT NOT NULL,
    "thread" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "lastMessageId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigestNotice" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,

    CONSTRAINT "DigestNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RequestBatch_userId_submissionKey_key" ON "RequestBatch"("userId", "submissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationNotice_thread_recipientId_key" ON "ConversationNotice"("thread", "recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "DigestNotice_recipientId_dayKey_key" ON "DigestNotice"("recipientId", "dayKey");

-- CreateIndex
CREATE INDEX "Asset_ownerId_status_idx" ON "Asset"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Asset_status_submittedAt_idx" ON "Asset"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "AssetMessage_assetId_createdAt_idx" ON "AssetMessage"("assetId", "createdAt");

-- CreateIndex
CREATE INDEX "Request_lenderId_status_idx" ON "Request"("lenderId", "status");

-- CreateIndex
CREATE INDEX "Request_batchId_idx" ON "Request"("batchId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "RequestBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestBatch" ADD CONSTRAINT "RequestBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationNotice" ADD CONSTRAINT "ConversationNotice_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigestNotice" ADD CONSTRAINT "DigestNotice_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Le proposte già inviate mantengono una data utile nella coda.
UPDATE "Asset" SET "submittedAt" = "createdAt" WHERE "status" = 'PENDING';
-- Una richiesta personale precedente senza responsabile richiede verifica esplicita.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM "RequestItem" ri JOIN "Asset" a ON a."id" = ri."assetId" WHERE a."ownerId" IS NOT NULL) THEN
  RAISE EXCEPTION 'Verificare i prestiti personali preesistenti prima della migrazione P2P';
 END IF;
END $$;
COMMIT;
