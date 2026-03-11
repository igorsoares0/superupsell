-- CreateEnum
CREATE TYPE "Surface" AS ENUM ('product_page', 'popup', 'cart', 'checkout');

-- CreateEnum
CREATE TYPE "TargetMode" AS ENUM ('all_products', 'collections', 'specific_products');

-- CreateEnum
CREATE TYPE "Layout" AS ENUM ('vertical', 'slider');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('impression', 'click', 'conversion', 'revenue');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'canceled', 'past_due');

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UpsellOffer" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "surface" "Surface" NOT NULL,
    "upsellName" TEXT NOT NULL,
    "discountLabel" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "targetMode" "TargetMode" NOT NULL,
    "discountPercentage" DECIMAL(5,2) NOT NULL,
    "showVariants" BOOLEAN NOT NULL DEFAULT false,
    "showImage" BOOLEAN NOT NULL DEFAULT true,
    "layout" "Layout" NOT NULL DEFAULT 'vertical',
    "titleText" TEXT NOT NULL DEFAULT 'You may also like',
    "buttonText" TEXT NOT NULL DEFAULT 'Add to cart',
    "buttonColor" TEXT NOT NULL DEFAULT '#000000',
    "backgroundColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "borderColor" TEXT NOT NULL DEFAULT '#E0E0E0',
    "titleSize" INTEGER NOT NULL DEFAULT 18,
    "textSize" INTEGER NOT NULL DEFAULT 14,
    "buttonSize" INTEGER NOT NULL DEFAULT 14,
    "cornerRadius" INTEGER NOT NULL DEFAULT 8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UpsellOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UpsellOfferTarget" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,

    CONSTRAINT "UpsellOfferTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UpsellOfferProduct" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantIds" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UpsellOfferProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "offerId" TEXT,
    "surface" "Surface" NOT NULL,
    "eventType" "EventType" NOT NULL,
    "amount" DECIMAL(12,2),
    "currency" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyMetric" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "surface" "Surface" NOT NULL,
    "day" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "DailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingSubscription" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "planCode" TEXT NOT NULL DEFAULT 'pro_monthly',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodEndsAt" TIMESTAMP(3),
    "shopifyChargeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UpsellOffer_shop_surface_idx" ON "UpsellOffer"("shop", "surface");

-- CreateIndex
CREATE INDEX "UpsellOffer_shop_isActive_idx" ON "UpsellOffer"("shop", "isActive");

-- CreateIndex
CREATE INDEX "UpsellOfferTarget_offerId_idx" ON "UpsellOfferTarget"("offerId");

-- CreateIndex
CREATE INDEX "UpsellOfferProduct_offerId_idx" ON "UpsellOfferProduct"("offerId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_shop_surface_idx" ON "AnalyticsEvent"("shop", "surface");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

-- CreateIndex
CREATE INDEX "DailyMetric_shop_day_idx" ON "DailyMetric"("shop", "day");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMetric_shop_surface_day_key" ON "DailyMetric"("shop", "surface", "day");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSubscription_shop_key" ON "BillingSubscription"("shop");

-- AddForeignKey
ALTER TABLE "UpsellOfferTarget" ADD CONSTRAINT "UpsellOfferTarget_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "UpsellOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpsellOfferProduct" ADD CONSTRAINT "UpsellOfferProduct_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "UpsellOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "UpsellOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
