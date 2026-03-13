import { useEffect, useRef } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation } from "react-router";
import { authenticate, PLAN_NAME } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing: _billing } = await authenticate.admin(request);
  const billing = _billing as any;

  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: [PLAN_NAME],
    isTest: true,
  });

  const subscription = appSubscriptions?.[0] ?? null;

  return {
    hasActivePayment,
    subscription: subscription
      ? {
          id: subscription.id,
          name: subscription.name,
          test: subscription.test,
        }
      : null,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing: _billing } = await authenticate.admin(request);
  const billing = _billing as any;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "subscribe") {
    await billing.request({
      plan: PLAN_NAME,
      isTest: true,
    });
    // billing.request redirects to Shopify confirmation page — this line is not reached
  }

  if (intent === "cancel") {
    const subscriptionId = formData.get("subscriptionId") as string;
    if (subscriptionId) {
      await billing.cancel({
        subscriptionId,
        isTest: true,
        prorate: true,
      });
    }
    return { cancelled: true };
  }

  return null;
};

export default function Billing() {
  const { hasActivePayment, subscription } =
    useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isBusy = navigation.state !== "idle";

  const subscribeRef = useRef<any>(null);
  const cancelRef = useRef<any>(null);

  // Native click handlers for Polaris web component buttons
  useEffect(() => {
    const subEl = subscribeRef.current as HTMLElement | null;
    const canEl = cancelRef.current as HTMLElement | null;

    const onSubscribe = () => {
      const data = new FormData();
      data.set("intent", "subscribe");
      submit(data, { method: "POST" });
    };
    const onCancel = () => {
      const data = new FormData();
      data.set("intent", "cancel");
      if (subscription?.id) data.set("subscriptionId", subscription.id);
      submit(data, { method: "POST" });
    };

    subEl?.addEventListener("click", onSubscribe);
    canEl?.addEventListener("click", onCancel);
    return () => {
      subEl?.removeEventListener("click", onSubscribe);
      canEl?.removeEventListener("click", onCancel);
    };
  });

  return (
    <s-page heading="Billing">
      {/* Plan details */}
      <s-section heading="SuperUpsell Pro">
        <div
          style={{
            padding: "20px",
            border: "1px solid #e0e0e0",
            borderRadius: "8px",
            backgroundColor: "#fff",
          }}
        >
          <s-stack direction="block" gap="base">
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "4px",
              }}
            >
              <span style={{ fontSize: "32px", fontWeight: 700 }}>$12.99</span>
              <span style={{ fontSize: "14px", color: "#666" }}>/month</span>
            </div>

            <s-text tone="neutral">
              14-day free trial included. No charge until the trial ends.
            </s-text>

            <div style={{ marginTop: "8px" }}>
              <s-stack direction="block" gap="small-200">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "#22c55e" }}>&#10003;</span>
                  <span style={{ fontSize: "14px" }}>Unlimited upsell offers</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "#22c55e" }}>&#10003;</span>
                  <span style={{ fontSize: "14px" }}>Product page, cart &amp; popup surfaces</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "#22c55e" }}>&#10003;</span>
                  <span style={{ fontSize: "14px" }}>Automatic discounts</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "#22c55e" }}>&#10003;</span>
                  <span style={{ fontSize: "14px" }}>Analytics dashboard</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "#22c55e" }}>&#10003;</span>
                  <span style={{ fontSize: "14px" }}>Full visual customization</span>
                </div>
              </s-stack>
            </div>
          </s-stack>
        </div>
      </s-section>

      {/* Subscription status */}
      <s-section heading="Subscription Status">
        <div
          style={{
            padding: "20px",
            border: "1px solid #e0e0e0",
            borderRadius: "8px",
            backgroundColor: "#fff",
          }}
        >
          {hasActivePayment ? (
            <s-stack direction="block" gap="base">
              <s-banner tone="success">
                Your subscription is active.
                {subscription?.test ? " (test mode)" : ""}
              </s-banner>
              <s-button
                ref={cancelRef}
                variant="tertiary"
                tone="critical"
                {...(isBusy ? { loading: true } : {})}
              >
                Cancel subscription
              </s-button>
            </s-stack>
          ) : (
            <s-stack direction="block" gap="base">
              <s-banner tone="warning">
                You don&apos;t have an active subscription. Subscribe to access
                all features.
              </s-banner>
              <s-button
                ref={subscribeRef}
                variant="primary"
                {...(isBusy ? { loading: true } : {})}
              >
                Start 14-day free trial
              </s-button>
            </s-stack>
          )}
        </div>
      </s-section>
    </s-page>
  );
}
