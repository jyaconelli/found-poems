/*
  Warnings:

  - You are about to drop the `PublishedPoem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SessionInvite` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SourceText` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Word` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PublishedPoem" DROP CONSTRAINT "PublishedPoem_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_sourceId_fkey";

-- DropForeignKey
ALTER TABLE "SessionInvite" DROP CONSTRAINT "SessionInvite_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "Word" DROP CONSTRAINT "Word_sessionId_fkey";

-- DropTable
DROP TABLE "PublishedPoem";

-- DropTable
DROP TABLE "Session";

-- DropTable
DROP TABLE "SessionInvite";

-- DropTable
DROP TABLE "SourceText";

-- DropTable
DROP TABLE "Word";

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "words" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "actorId" TEXT,
    "hiddenAt" TIMESTAMP(3),

    CONSTRAINT "words_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_invites" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "session_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_texts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_texts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "published_poems" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "published_poems_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "session_invites_token_key" ON "session_invites"("token");

-- CreateIndex
CREATE UNIQUE INDEX "published_poems_sessionId_key" ON "published_poems"("sessionId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "source_texts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "words" ADD CONSTRAINT "words_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_invites" ADD CONSTRAINT "session_invites_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_poems" ADD CONSTRAINT "published_poems_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
