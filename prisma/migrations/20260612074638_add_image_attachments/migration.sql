-- AlterTable
ALTER TABLE "diary_entries" ADD COLUMN     "image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "job_comments" ADD COLUMN     "image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[];
