-- AlterTable
ALTER TABLE "User" ADD COLUMN     "linkedinProfileUrl" TEXT;

-- CreateTable
CREATE TABLE "ApprovalInvite" (
    "id" TEXT NOT NULL,
    "ticketRequestId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalInvite_ticketRequestId_key" ON "ApprovalInvite"("ticketRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalInvite_tokenHash_key" ON "ApprovalInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "ApprovalInvite_expiresAt_idx" ON "ApprovalInvite"("expiresAt");

-- AddForeignKey
ALTER TABLE "ApprovalInvite" ADD CONSTRAINT "ApprovalInvite_ticketRequestId_fkey" FOREIGN KEY ("ticketRequestId") REFERENCES "TicketRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

