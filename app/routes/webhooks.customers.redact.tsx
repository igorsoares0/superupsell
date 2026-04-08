import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

/**
 * GDPR — customers/redact
 *
 * Shopify sends this 10 days after a customer data erasure request, asking
 * the app to delete the customer's data.
 *
 * SuperUpsell does not store any customer PII (see notes in
 * webhooks.customers.data_request.tsx), so there is nothing to delete.
 * We still validate HMAC and respond 200 to acknowledge.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(
    `[GDPR] ${topic} for ${shop} — no customer data to redact`,
    JSON.stringify({
      customer_id: (payload as any)?.customer?.id,
    }),
  );

  return new Response();
};
