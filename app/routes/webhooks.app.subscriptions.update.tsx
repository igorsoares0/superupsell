import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const chargeId = payload?.app_subscription?.admin_graphql_api_id as string | undefined;
  const shopifyStatus = payload?.app_subscription?.status as string | undefined;

  // Map Shopify subscription status to our enum
  const statusMap: Record<string, "trialing" | "active" | "canceled" | "past_due"> = {
    ACTIVE: "active",
    CANCELLED: "canceled",
    FROZEN: "past_due",
    PENDING: "trialing",
    DECLINED: "canceled",
    EXPIRED: "canceled",
  };
  const status = statusMap[shopifyStatus ?? ""] ?? "canceled";

  // Upsert subscription record per shop
  await db.billingSubscription.upsert({
    where: { shop },
    create: {
      shop,
      planCode: "pro_monthly",
      status,
      shopifyChargeId: chargeId ?? null,
    },
    update: {
      status,
      shopifyChargeId: chargeId ?? null,
      updatedAt: new Date(),
    },
  });

  return new Response();
};
