-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "usedAt" TIMESTAMP(3),
ADD COLUMN     "usedById" TEXT;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
