-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "streamId" TEXT;

-- CreateTable
CREATE TABLE "rss_poem_streams" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "rssUrl" TEXT NOT NULL,
    "maxParticipants" INTEGER NOT NULL,
    "minParticipants" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "timeOfDay" TEXT NOT NULL,
    "autoPublish" BOOLEAN NOT NULL DEFAULT false,
    "lastItemGuid" TEXT,
    "lastItemPublishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rss_poem_streams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rss_stream_collaborators" (
    "id" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInvitedAt" TIMESTAMP(3),

    CONSTRAINT "rss_stream_collaborators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rss_poem_streams_slug_key" ON "rss_poem_streams"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "rss_stream_collaborators_streamId_email_key" ON "rss_stream_collaborators"("streamId", "email");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "rss_poem_streams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rss_stream_collaborators" ADD CONSTRAINT "rss_stream_collaborators_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "rss_poem_streams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
