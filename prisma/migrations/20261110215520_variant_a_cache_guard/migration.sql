-- Variant A: 60s fact cache + burst guard.
--
-- 1. Timestamps become timestamptz. Existing values were written by Prisma
--    as UTC wall-clock time into `timestamp` columns, so convert them with
--    AT TIME ZONE 'UTC'. (A bare SET DATA TYPE would reinterpret them in the
--    DB session time zone and shift every row.)
-- 2. users.fact_generation_started_at: "generation in progress" lease.
-- 3. Index for "latest fact for this user + movie" (cache check, fallback).

-- DropIndex
DROP INDEX "movie_facts_user_id_created_at_idx";

-- AlterTable
ALTER TABLE "movie_facts"
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "fact_generation_started_at" TIMESTAMPTZ(3),
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- CreateIndex
CREATE INDEX "movie_facts_user_id_movie_created_at_idx" ON "movie_facts"("user_id", "movie", "created_at" DESC);
