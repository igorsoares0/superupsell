-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'add_to_cart';

-- AlterTable
ALTER TABLE "DailyMetric" ADD COLUMN     "addToCarts" INTEGER NOT NULL DEFAULT 0;
