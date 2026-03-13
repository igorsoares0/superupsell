-- CreateEnum
CREATE TYPE "CardMode" AS ENUM ('button', 'checkbox');

-- AlterTable
ALTER TABLE "UpsellOffer" ADD COLUMN "cardMode" "CardMode" NOT NULL DEFAULT 'button';
