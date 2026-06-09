-- CreateEnum
CREATE TYPE "BookkeepingSoftware" AS ENUM ('ZOHO', 'QUICKBOOKS', 'XERO', 'SAGE');

-- CreateEnum
CREATE TYPE "BookkeepingBy" AS ENUM ('FIRM', 'CLIENT');

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "bookkeeping_by" "BookkeepingBy",
ADD COLUMN     "bookkeeping_software" "BookkeepingSoftware";
