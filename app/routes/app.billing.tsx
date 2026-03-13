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

const FEATURES = [
  "Unlimited upsell offers",
  "Product page, cart & popup surfaces",
  "Automatic discounts",
  "Analytics dashboard",
  "Full visual customization",
];

export default function Billing() {
  const { hasActivePayment, subscription } =
    useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isBusy = navigation.state !== "idle";

  const subscribeRef = useRef<any>(null);
  const cancelRef = useRef<any>(null);

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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {/* Plan card */}
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid #E3E5E7",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <s-stack direction="block" gap="large-200">
            <s-stack direction="block" gap="small-200">
              <s-badge tone="info">Current plan</s-badge>
              <s-text variant="headingLg">SuperUpsell Pro</s-text>
            </s-stack>

            <div style={{ display: "flex", alignItems: "baseline", gap: "2px" }}>
              <span style={{ fontSize: "36px", fontWeight: 700, color: "#202223", letterSpacing: "-1px" }}>
                $12.99
              </span>
              <span style={{ fontSize: "14px", color: "#6D7175" }}>/month</span>
            </div>

            <s-text tone="subdued">
              14-day free trial included. No charge until the trial ends.
            </s-text>

            <div style={{ borderTop: "1px solid #E3E5E7", paddingTop: "16px" }}>
              <s-stack direction="block" gap="small-200">
                {FEATURES.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="8" fill="#E4F5E9" />
                      <path d="M5 8l2 2 4-4" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <s-text variant="bodySm">{f}</s-text>
                  </div>
                ))}
              </s-stack>
            </div>
          </s-stack>
        </div>

        {/* Status card */}
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid #E3E5E7",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <s-stack direction="block" gap="large-200">
            <s-text variant="headingMd">Subscription Status</s-text>

            {hasActivePayment ? (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    backgroundColor: "#E4F5E9",
                    borderRadius: "8px",
                    padding: "12px 16px",
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="10" fill="#059669" />
                    <path d="M6 10l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <s-text variant="bodySm">
                    Your subscription is active.{subscription?.test ? " (test mode)" : ""}
                  </s-text>
                </div>

                <div style={{ borderTop: "1px solid #E3E5E7", paddingTop: "16px" }}>
                  <s-stack direction="block" gap="small-200">
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <s-text tone="subdued" variant="bodySm">Plan</s-text>
                      <s-text variant="bodySm">{subscription?.name ?? "SuperUpsell Pro"}</s-text>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <s-text tone="subdued" variant="bodySm">Status</s-text>
                      <s-badge tone="success">Active</s-badge>
                    </div>
                    {subscription?.test && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <s-text tone="subdued" variant="bodySm">Mode</s-text>
                        <s-badge>Test</s-badge>
                      </div>
                    )}
                  </s-stack>
                </div>

                <div style={{ marginTop: "auto", paddingTop: "8px" }}>
                  <s-button
                    ref={cancelRef}
                    variant="tertiary"
                    tone="critical"
                    {...(isBusy ? { loading: true } : {})}
                  >
                    Cancel subscription
                  </s-button>
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    backgroundColor: "#FFF4E4",
                    borderRadius: "8px",
                    padding: "12px 16px",
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="10" fill="#B98900" />
                    <text x="10" y="14.5" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold">!</text>
                  </svg>
                  <s-text variant="bodySm">
                    No active subscription. Subscribe to access all features.
                  </s-text>
                </div>

                <div style={{ marginTop: "auto", paddingTop: "8px" }}>
                  <s-button
                    ref={subscribeRef}
                    variant="primary"
                    {...(isBusy ? { loading: true } : {})}
                  >
                    Start 14-day free trial
                  </s-button>
                </div>
              </>
            )}
          </s-stack>
        </div>
      </div>
    </s-page>
  );
}
