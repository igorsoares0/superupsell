import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authenticate, PLAN_NAME, BILLING_TEST_MODE } from "../shopify.server";

/**
 * Dedicated route that initiates the Shopify billing approval flow.
 *
 * Why a loader-only route:
 *   billing.request() throws a 401 Response carrying
 *   X-Shopify-API-Request-Failure-Reauthorize-Url. The @shopify/shopify-app-
 *   react-router adapter only intercepts this Response and converts it into
 *   an App Bridge top-level redirect when it's thrown from a LOADER. When
 *   thrown from an action, it just bubbles up to React Router's error
 *   boundary and renders "401 Unauthorized" as page content.
 *
 * Flow:
 *   1. User clicks "Start 14-day free trial" in /app/billing
 *   2. Client navigates to /app/billing/subscribe (preserving query string)
 *   3. This loader runs: billing.require fails (no active payment) and calls
 *      onFailure -> billing.request, which throws the 401 Response
 *   4. Adapter catches the throw, detects the reauthorize header, and emits
 *      an App Bridge top-level redirect to Shopify's charge approval screen
 *   5. Merchant approves -> Shopify redirects back to returnUrl (/app/billing)
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing: _billing } = await authenticate.admin(request);
  const billing = _billing as any;

  // If they already have an active subscription, skip the request entirely
  // and bounce back to the billing page so they don't get shown the approval
  // screen for a plan they already own.
  const { hasActivePayment } = await billing.check({
    plans: [PLAN_NAME],
    isTest: BILLING_TEST_MODE,
  });
  if (hasActivePayment) {
    const search = new URL(request.url).search;
    throw redirect(`/app/billing${search}`);
  }

  const origin = new URL(request.url).origin;

  await billing.require({
    plans: [PLAN_NAME],
    isTest: BILLING_TEST_MODE,
    onFailure: async () =>
      billing.request({
        plan: PLAN_NAME,
        isTest: BILLING_TEST_MODE,
        returnUrl: `${origin}/app/billing`,
      }),
  });

  // Unreachable in practice — billing.require throws when onFailure resolves.
  return null;
};
