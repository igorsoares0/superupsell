import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

/**
 * GDPR — customers/data_request
 *
 * Shopify sends this when a merchant (or storefront customer via the merchant)
 * asks for a copy of the customer's data stored by the app.
 *
 * SuperUpsell does not store any customer PII:
 *  - UpsellOffer is shop-scoped (no customer reference)
 *  - AnalyticsEvent only stores shop + product/variant ids, no customer id/email/ip
 *  - Session is Shopify's merchant OAuth session, not customer data
 *
 * So there's nothing to return. We still validate HMAC via authenticate.webhook
 * and respond 200 to acknowledge receipt.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(
    `[GDPR] ${topic} for ${shop} — no customer data stored`,
    JSON.stringify({
      customer_id: (payload as any)?.customer?.id,
      orders_requested: (payload as any)?.orders_requested,
    }),
  );

  return new Response();
};
