import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, redirect, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing: _billing } = await authenticate.admin(request);
  const billing = _billing as any;

  // Soft gate: merchants without an active subscription land on /app/billing
  // instead of being shoved directly into Shopify's approval screen. They see
  // the plan details + features first, then opt in to the trial themselves.
  //
  // IMPORTANT: we must forward the query string (shop, host, embedded, ...)
  // so the /app/billing loader can re-authenticate inside the embedded iframe.
  // Dropping them sends the next request through /auth/login.
  //
  // billing.check() is called WITHOUT plans/isTest filters so it returns true
  // for ANY active subscription (test or live, any plan). Filtering caused the
  // previous Shopify rejection: on Partner Test Stores Shopify forces isTest
  // regardless of what we pass to billing.request, so a filtered check kept
  // returning hasActivePayment:false even after the merchant approved the
  // charge — locking them on /app/billing forever.
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/app/billing")) {
    const { hasActivePayment } = await billing.check();
    if (!hasActivePayment) {
      throw redirect(`/app/billing${url.search}`);
    }
  }

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Home</s-link>
        <s-link href="/app/analytics">Analytics</s-link>
        <s-link href="/app/billing">Billing</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
