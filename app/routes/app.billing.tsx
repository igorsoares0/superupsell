import { useEffect, useRef } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "react-router";
import { authenticate, PLAN_NAME, BILLING_TEST_MODE } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing: _billing } = await authenticate.admin(request);
  const billing = _billing as any;

  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: [PLAN_NAME],
    isTest: BILLING_TEST_MODE,
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
    try {
      await billing.request({
        plan: PLAN_NAME,
        isTest: BILLING_TEST_MODE,
      });
    } catch (err) {
      console.error("Billing request failed:", err);
      return { error: "Failed to initiate subscription. Please try again." };
    }
  }

  if (intent === "cancel") {
    const subscriptionId = formData.get("subscriptionId") as string;
    if (!subscriptionId) {
      return { error: "No active subscription found." };
    }
    try {
      await billing.cancel({
        subscriptionId,
        isTest: BILLING_TEST_MODE,
        prorate: true,
      });
      return { cancelled: true };
    } catch (err) {
      console.error("Billing cancel failed:", err);
      return { error: "Failed to cancel subscription. Please try again." };
    }
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
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isBusy = navigation.state !== "idle";

  const subscribeRef = useRef<any>(null);
  const cancelRef = useRef<any>(null);
  const confirmCancelRef = useRef<any>(null);

  useEffect(() => {
    const subEl = subscribeRef.current as HTMLElement | null;
    const canEl = cancelRef.current as HTMLElement | null;
    const confirmEl = confirmCancelRef.current as HTMLElement | null;

    const onSubscribe = () => {
      const data = new FormData();
      data.set("intent", "subscribe");
      submit(data, { method: "POST" });
    };
    const onOpenCancelModal = () => {
      shopify.modal.show("cancel-confirm-modal");
    };
    const onConfirmCancel = () => {
      shopify.modal.hide("cancel-confirm-modal");
      const data = new FormData();
      data.set("intent", "cancel");
      if (subscription?.id) data.set("subscriptionId", subscription.id);
      submit(data, { method: "POST" });
    };

    subEl?.addEventListener("click", onSubscribe);
    canEl?.addEventListener("click", onOpenCancelModal);
    confirmEl?.addEventListener("click", onConfirmCancel);
    return () => {
      subEl?.removeEventListener("click", onSubscribe);
      canEl?.removeEventListener("click", onOpenCancelModal);
      confirmEl?.removeEventListener("click", onConfirmCancel);
    };
  });

  return (
    <s-page heading="Billing">
      {actionData?.error && (
        <s-banner tone="critical">{actionData.error}</s-banner>
      )}
      <s-grid gridTemplateColumns="@container (inline-size <= 500px) 1fr, 1fr 1fr" gap="base">
        {/* Plan card */}
        <s-box padding="large-200" borderWidth="base" borderColor="base" border-radius="base" background="base">
          <s-stack direction="block" gap="large-200">
            <s-stack direction="block" gap="small-200">
              <s-badge tone="info" icon="star-filled">Current plan</s-badge>
              <s-heading>SuperUpsell Pro</s-heading>
            </s-stack>

            <s-stack direction="inline" gap="small-200" align-items="baseline">
              <s-heading>$12.99</s-heading>
              <s-text>/month</s-text>
            </s-stack>

            <s-box padding="small-200" border-radius="base" background="subdued">
              <s-stack direction="inline" gap="small-200" align-items="center">
                <s-icon type="check-circle" tone="info" size="small" />
                <s-text>14-day free trial included. No charge until the trial ends.</s-text>
              </s-stack>
            </s-box>

            <s-divider />
            <s-text type="strong">What's included:</s-text>
            <s-stack direction="block" gap="small-200">
              {FEATURES.map((f) => (
                <s-stack key={f} direction="inline" gap="small-200" align-items="center">
                  <s-icon type="check-circle" tone="success" size="small" />
                  <s-text>{f}</s-text>
                </s-stack>
              ))}
            </s-stack>

            {!hasActivePayment && (
              <s-button
                ref={subscribeRef}
                variant="primary"
                icon="star-filled"
                {...(isBusy ? { loading: true } : {})}
              >
                Start 14-day free trial
              </s-button>
            )}
          </s-stack>
        </s-box>

        {/* Status card */}
        <s-box padding="large-200" borderWidth="base" borderColor="base" border-radius="base" background="base">
          <s-stack direction="block" gap="large-200">
            <s-stack direction="inline" gap="small-200" align-items="center">
              <s-icon type="order" size="small" />
              <s-heading>Subscription Status</s-heading>
            </s-stack>

            {hasActivePayment ? (
              <>
                <s-banner tone="success">
                  Your subscription is active.{subscription?.test ? " (test mode)" : ""}
                </s-banner>

                <s-box padding="base" border-radius="base" background="subdued">
                  <s-stack direction="block" gap="base">
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base" align-items="center">
                      <s-text type="strong">Plan</s-text>
                      <s-text align="end">{subscription?.name ?? "SuperUpsell Pro"}</s-text>
                    </s-grid>
                    <s-divider />
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base" align-items="center" justifyItems="end">
                      <s-text type="strong" style={{ justifySelf: "start" }}>Status</s-text>
                      <s-badge tone="success" icon="check-circle">Active</s-badge>
                    </s-grid>
                    {subscription?.test && (
                      <>
                        <s-divider />
                        <s-grid gridTemplateColumns="1fr 1fr" gap="base" align-items="center" justifyItems="end">
                          <s-text type="strong" style={{ justifySelf: "start" }}>Mode</s-text>
                          <s-badge tone="warning">Test</s-badge>
                        </s-grid>
                      </>
                    )}
                  </s-stack>
                </s-box>

                <s-button
                  ref={cancelRef}
                  variant="tertiary"
                  tone="critical"
                  icon="x-circle"
                  {...(isBusy ? { loading: true } : {})}
                >
                  Cancel subscription
                </s-button>
              </>
            ) : (
              <>
                <s-banner tone="warning">
                  No active subscription. Subscribe to unlock all features.
                </s-banner>

                <s-box padding="base" border-radius="base" background="subdued">
                  <s-stack direction="block" gap="base">
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base" align-items="center">
                      <s-text type="strong">Plan</s-text>
                      <s-text align="end">SuperUpsell Pro</s-text>
                    </s-grid>
                    <s-divider />
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base" align-items="center" justifyItems="end">
                      <s-text type="strong" style={{ justifySelf: "start" }}>Status</s-text>
                      <s-badge tone="critical" icon="x-circle">Inactive</s-badge>
                    </s-grid>
                  </s-stack>
                </s-box>

                <s-button
                  ref={subscribeRef}
                  variant="primary"
                  icon="star-filled"
                  {...(isBusy ? { loading: true } : {})}
                >
                  Start 14-day free trial
                </s-button>
              </>
            )}
          </s-stack>
        </s-box>
      </s-grid>

      <s-modal id="cancel-confirm-modal">
        <s-box padding="large-200">
          <s-stack direction="block" gap="large-200">
            <s-text>
              Are you sure you want to cancel your subscription? You will lose
              access to all premium features at the end of the current billing
              period.
            </s-text>
            <s-stack direction="inline" gap="base" align-items="center">
              <s-button
                ref={confirmCancelRef}
                variant="primary"
                tone="critical"
              >
                Yes, cancel subscription
              </s-button>
            </s-stack>
          </s-stack>
        </s-box>
      </s-modal>
    </s-page>
  );
}
