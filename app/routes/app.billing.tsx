import { useEffect, useRef } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation, useActionData, useNavigate } from "react-router";
import { authenticate, PLAN_NAME, getIsTest } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing: _billing, admin } = await authenticate.admin(request);
  const billing = _billing as any;

  const isTest = await getIsTest(admin);
  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: [PLAN_NAME],
    isTest,
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
  const { billing: _billing, admin } = await authenticate.admin(request);
  const billing = _billing as any;
  const formData = await request.formData();
  const intent = formData.get("intent");

  // Note: subscribe flow lives in app.billing.subscribe.tsx (loader-only)
  // because billing.request's 401 reauthorize response is only intercepted
  // by the Shopify adapter when thrown from a loader, not an action.

  if (intent === "cancel") {
    const subscriptionId = formData.get("subscriptionId") as string;
    if (!subscriptionId) {
      return { error: "No active subscription found." };
    }
    try {
      const isTest = await getIsTest(admin);
      await billing.cancel({
        subscriptionId,
        isTest,
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
  const navigate = useNavigate();
  const navigation = useNavigation();
  const isBusy = navigation.state !== "idle";

  const containerRef = useRef<HTMLDivElement>(null);
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const subscriptionIdRef = useRef(subscription?.id);
  subscriptionIdRef.current = subscription?.id;

  // Surface a toast when the cancel action returns successfully so the user
  // gets explicit confirmation instead of the page silently re-rendering.
  useEffect(() => {
    if (actionData?.cancelled) {
      shopify.toast.show("Subscription cancelled");
    }
  }, [actionData]);

  // Use event delegation (not refs) so that BOTH subscribe buttons work —
  // React only keeps the last ref assignment when two elements share the same
  // ref, so a ref-based approach silently drops the first button.
  // composedPath() is required because Polaris web components wrap their
  // clickable targets inside a Shadow DOM.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e: Event) => {
      const path = e.composedPath();
      const actionEl = path.find(
        (el) =>
          el instanceof HTMLElement && el.hasAttribute("data-billing-action"),
      ) as HTMLElement | undefined;
      if (!actionEl) return;

      const action = actionEl.getAttribute("data-billing-action");

      if (action === "subscribe") {
        // Use React Router navigation (not window.location.href) so the
        // request goes through the embedded app's authenticated fetch
        // (session token in Authorization header). A hard navigation drops
        // the App Bridge session token and falls back to the session cookie,
        // which Safari/Chrome block as third-party in the iframe — landing
        // the merchant on the standalone /auth/login page instead of the
        // Shopify charge approval screen.
        const search = window.location.search;
        navigateRef.current(`/app/billing/subscribe${search}`);
        return;
      }
      if (action === "open-cancel-modal") {
        shopify.modal.show("cancel-confirm-modal");
        return;
      }
      if (action === "confirm-cancel") {
        shopify.modal.hide("cancel-confirm-modal");
        const data = new FormData();
        data.set("intent", "cancel");
        const subId = subscriptionIdRef.current;
        if (subId) data.set("subscriptionId", subId);
        submitRef.current(data, { method: "POST" });
        return;
      }
    };

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, []);

  return (
    <div ref={containerRef}>
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
                data-billing-action="subscribe"
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
                  data-billing-action="open-cancel-modal"
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
                  data-billing-action="subscribe"
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
                data-billing-action="confirm-cancel"
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
    </div>
  );
}
