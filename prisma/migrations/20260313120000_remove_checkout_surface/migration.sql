-- Delete any rows that reference the checkout surface
DELETE FROM "DailyMetric" WHERE "surface" = 'checkout';
DELETE FROM "AnalyticsEvent" WHERE "surface" = 'checkout';
DELETE FROM "UpsellOffer" WHERE "surface" = 'checkout';

-- Remove the checkout value from the Surface enum
ALTER TYPE "Surface" RENAME TO "Surface_old";
CREATE TYPE "Surface" AS ENUM ('product_page', 'popup', 'cart');
ALTER TABLE "UpsellOffer" ALTER COLUMN "surface" TYPE "Surface" USING ("surface"::text::"Surface");
ALTER TABLE "DailyMetric" ALTER COLUMN "surface" TYPE "Surface" USING ("surface"::text::"Surface");
ALTER TABLE "AnalyticsEvent" ALTER COLUMN "surface" TYPE "Surface" USING ("surface"::text::"Surface");
DROP TYPE "Surface_old";
