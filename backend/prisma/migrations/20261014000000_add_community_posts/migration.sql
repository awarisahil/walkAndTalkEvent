-- CreateEnum
CREATE TYPE "CommunityMediaType" AS ENUM ('PHOTO', 'VIDEO', 'INSTAGRAM');

-- CreateTable
CREATE TABLE "CommunityPost" (
    "id" TEXT NOT NULL,
    "mediaType" "CommunityMediaType" NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "caption" TEXT,
    "eventId" TEXT,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunityPost_eventId_idx" ON "CommunityPost"("eventId");

-- CreateIndex
CREATE INDEX "CommunityPost_mediaType_idx" ON "CommunityPost"("mediaType");

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

