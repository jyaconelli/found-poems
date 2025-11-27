-- Rename SessionStatus enum value from ready to published
-- Postgres 10+ supports RENAME VALUE
ALTER TYPE "SessionStatus" RENAME VALUE 'ready' TO 'published';
