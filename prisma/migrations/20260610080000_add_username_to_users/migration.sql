-- Add username column as nullable first
ALTER TABLE "users" ADD COLUMN "username" TEXT;

-- Backfill: set username = email for all existing users
UPDATE "users" SET "username" = "email" WHERE "username" IS NULL;

-- Make it NOT NULL now that all rows have a value
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;

-- Add unique constraint
ALTER TABLE "users" ADD CONSTRAINT "users_username_key" UNIQUE ("username");

-- Make email nullable (no longer required for auth)
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
