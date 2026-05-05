import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  BillingInterval,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

export const PLAN_NAME = "SuperUpsell Pro";

// Detects whether billing calls should use isTest:true. Shopify's review team
// installs on a Partner Test Store (partnerDevelopment=true), where the
// platform forces subscriptions to test mode regardless of the flag passed in
// billing.request — so billing.check must mirror that or it returns
// hasActivePayment:false and the UI never reflects the approved subscription.
// BILLING_TEST_MODE=true env var forces test mode for local/staging testing.
export async function getIsTest(
  admin: { graphql: (query: string) => Promise<Response> },
): Promise<boolean> {
  if (process.env.BILLING_TEST_MODE === "true") return true;
  try {
    const res = await admin.graphql(
      `#graphql
      query ShopBillingMode { shop { plan { partnerDevelopment } } }`,
    );
    const { data } = await res.json();
    if (data?.shop?.plan?.partnerDevelopment) return true;
  } catch (err) {
    console.error("getIsTest: failed to detect shop plan", err);
  }
  return false;
}

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  billing: {
    [PLAN_NAME]: {
      lineItems: [
        {
          amount: 12.99,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
      trialDays: 14,
    },
  },
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
