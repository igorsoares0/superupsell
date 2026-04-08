import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * GDPR — shop/redact
 *
 * Shopify sends this 48 hours after a shop uninstalls the app. We must
 * delete ALL data associated with that shop.
 *
 * Tables with shop-scoped data:
 *  - AnalyticsEvent        (shop column)
 *  - DailyMetric           (shop column)
 *  - UpsellOffer           (shop column) — cascades to UpsellOfferTarget / UpsellOfferProduct
 *  - BillingSubscription   (shop column, unique)
 *  - Session               (shop column)
 *
 * We wrap in a transaction so a partial failure doesn't leave orphaned rows.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`[GDPR] ${topic} for ${shop} — deleting all shop data`);

  await db.$transaction([
    // Delete events first so the UpsellOffer delete doesn't have to SetNull them
    db.analyticsEvent.deleteMany({ where: { shop } }),
    // UpsellOffer cascades to UpsellOfferTarget and UpsellOfferProduct
    db.upsellOffer.deleteMany({ where: { shop } }),
    db.dailyMetric.deleteMany({ where: { shop } }),
    db.billingSubscription.deleteMany({ where: { shop } }),
    db.session.deleteMany({ where: { shop } }),
  ]);

  return new Response();
};
