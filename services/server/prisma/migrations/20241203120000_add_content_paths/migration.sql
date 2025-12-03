-- Add JSONB column to store selected RSS content paths
ALTER TABLE "rss_poem_streams"
ADD COLUMN IF NOT EXISTS "contentPaths" JSONB;
