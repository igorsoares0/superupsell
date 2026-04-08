import { useEffect, useRef } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "react-router";
import { authenticate, PLAN_NAME, BILLING_TEST_MODE } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing: _billing, admin } = await authenticate.admin(request);
  const billing = _billing as any;

  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: [PLAN_NAME],
    isTest: BILLING_TEST_MODE,
  });

  const subscription = appSubscriptions?.[0] ?? null;

  // billing.check() doesn't return trialDays/createdAt — query the Admin API
  // directly so we can show how many days are left in the free trial.
  let trialDaysLeft: number | null = null;
  let trialEndsAt: string | null = null;
  if (subscription) {
    try {
      const res = await admin.graphql(
        `#graphql
        query CurrentSubscriptionTrial {
          currentAppInstallation {
            activeSubscriptions {
              id
              trialDays
              createdAt
            }
          }
        }`,
      );
      const { data } = await res.json();
      const subs = data?.currentAppInstallation?.activeSubscriptions ?? [];
      const match =
        subs.find((s: any) => s.id === subscription.id) ?? subs[0] ?? null;
      if (match?.trialDays > 0 && match?.createdAt) {
        const created = new Date(match.createdAt).getTime();
        const end = created + match.trialDays * 24 * 60 * 60 * 1000;
        const now = Date.now();
        if (end > now) {
          trialDaysLeft = Math.ceil((end - now) / (24 * 60 * 60 * 1000));
          trialEndsAt = new Date(end).toISOString();
        }
      }
    } catch (err) {
      console.error("Failed to fetch trial info:", err);
    }
  }

  return {
    hasActivePayment,
    subscription: subscription
      ? {
          id: subscription.id,
          name: subscription.name,
          test: subscription.test,
        }
      : null,
    trialDaysLeft,
    trialEndsAt,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing: _billing, redirect } = await authenticate.admin(request);
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
      // billing.request throws a 401 Response carrying the charge approval
      // URL in X-Shopify-API-Request-Failure-Reauthorize-Url. Since this runs
      // in an action (not a loader), the adapter does NOT auto-convert it to
      // an App Bridge top-level redirect — we have to extract the URL and use
      // authenticate.admin's redirect() with target: "_top" ourselves.
      if (err instanceof Response) {
        const reauthorizeUrl = err.headers.get(
          "X-Shopify-API-Request-Failure-Reauthorize-Url",
        );
        if (reauthorizeUrl) {
          return redirect(reauthorizeUrl, { target: "_top" });
        }
      }
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
      // Cancel rarely triggers a reauthorize flow, but handle it defensively
      // the same way for symmetry.
      if (err instanceof Response) {
        const reauthorizeUrl = err.headers.get(
          "X-Shopify-API-Request-Failure-Reauthorize-Url",
        );
        if (reauthorizeUrl) {
          return redirect(reauthorizeUrl, { target: "_top" });
        }
      }
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
  const { hasActivePayment, subscription, trialDaysLeft, trialEndsAt } =
    useLoaderData<typeof loader>();
  const isInTrial = trialDaysLeft !== null && trialDaysLeft > 0;
  const trialEndLabel = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isBusy = navigation.state !== "idle";

  const subscribeRef = useRef<any>(null);
  const cancelRef = useRef<any>(null);
  const confirmCancelRef = useRef<any>(null);

  // Surface a toast when the cancel action returns successfully so the user
  // gets explicit confirmation instead of the page silently re-rendering.
  useEffect(() => {
    if (actionData?.cancelled) {
      shopify.toast.show("Subscription cancelled");
    }
  }, [actionData]);

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
      {actionData?.cancelled && (
        <s-banner tone="success">
          Your subscription has been cancelled.
        </s-banner>
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
                {isInTrial ? (
                  <s-banner tone="info">
                    You're on the free trial — {trialDaysLeft} day
                    {trialDaysLeft === 1 ? "" : "s"} remaining
                    {trialEndLabel ? ` (ends ${trialEndLabel})` : ""}.
                  </s-banner>
                ) : (
                  <s-banner tone="success">
                    Your subscription is active.{subscription?.test ? " (test mode)" : ""}
                  </s-banner>
                )}

                <s-box padding="base" border-radius="base" background="subdued">
                  <s-stack direction="block" gap="base">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "16px",
                      }}
                    >
                      <s-text type="strong">Plan</s-text>
                      <s-text>{subscription?.name ?? "SuperUpsell Pro"}</s-text>
                    </div>
                    <s-divider />
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "16px",
                      }}
                    >
                      <s-text type="strong">Status</s-text>
                      {isInTrial ? (
                        <s-badge tone="info" icon="clock">Free trial</s-badge>
                      ) : (
                        <s-badge tone="success" icon="check-circle">Active</s-badge>
                      )}
                    </div>
                    {isInTrial && (
                      <>
                        <s-divider />
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "16px",
                          }}
                        >
                          <s-text type="strong">Trial ends</s-text>
                          <s-text>
                            {trialEndLabel} ({trialDaysLeft} day
                            {trialDaysLeft === 1 ? "" : "s"} left)
                          </s-text>
                        </div>
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
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "16px",
                      }}
                    >
                      <s-text type="strong">Plan</s-text>
                      <s-text>SuperUpsell Pro</s-text>
                    </div>
                    <s-divider />
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "16px",
                      }}
                    >
                      <s-text type="strong">Status</s-text>
                      <s-badge tone="critical" icon="x-circle">Inactive</s-badge>
                    </div>
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
