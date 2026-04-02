import { useEffect, useRef } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  getAllOffers,
  toggleOfferActive,
  deleteOffer,
  syncOfferMetafield,
  syncDiscountFunction,
} from "../models/offer.server";
import type { Surface } from "@prisma/client";

const SURFACE_SLUGS: Record<string, string> = {
  product_page: "product-page",
  popup: "popup",
  cart: "cart",
};

const SURFACE_LABELS: Record<string, string> = {
  product_page: "Product Page",
  popup: "Popup",
  cart: "Cart",
};

const SURFACE_ICONS: Record<string, string> = {
  product_page: "product",
  popup: "maximize",
  cart: "cart",
} as const;

const SURFACES = [
  {
    key: "product_page",
    title: "Product Page",
    description: "Show offers on product pages to encourage add-ons.",
    href: "/app/upsells/product-page/new",
    icon: "product",
  },
  {
    key: "popup",
    title: "Popup",
    description: "Trigger a popup when customers add items to cart.",
    href: "/app/upsells/popup/new",
    icon: "maximize",
  },
  {
    key: "cart",
    title: "Cart Page",
    description: "Present offers in the cart before checkout.",
    href: "/app/upsells/cart/new",
    icon: "cart",
  },
] as const;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const offers = await getAllOffers(session.shop);
  return { offers };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent");
  const offerId = formData.get("offerId") as string;
  const offerSurface = formData.get("surface") as Surface;

  let knownDiscountId: string | null = null;

  switch (intent) {
    case "toggle":
      await toggleOfferActive(offerId, session.shop);
      break;
    case "delete": {
      const doomed = await prisma.upsellOffer.findFirst({
        where: { id: offerId, shop: session.shop },
        select: { shopifyDiscountId: true },
      });
      knownDiscountId = doomed?.shopifyDiscountId ?? null;
      await deleteOffer(offerId, session.shop);
      break;
    }
  }

  if (offerSurface) {
    await syncOfferMetafield(admin, session.shop, offerSurface);
  }
  await syncDiscountFunction(admin, session.shop, knownDiscountId);

  return { ok: true };
};

export default function Home() {
  const { offers } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const containerRef = useRef<HTMLDivElement>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e: Event) => {
      const path = e.composedPath();
      const actionEl = path.find(
        (el) =>
          el instanceof HTMLElement && el.hasAttribute("data-offer-action"),
      ) as HTMLElement | undefined;
      if (!actionEl) return;

      const action = actionEl.getAttribute("data-offer-action");
      const offerId = actionEl.getAttribute("data-offer-id");
      const surface = actionEl.getAttribute("data-offer-surface");
      if (!offerId) return;

      if (action === "toggle") {
        fetcherRef.current.submit(
          { intent: "toggle", offerId, surface: surface ?? "" },
          { method: "POST" },
        );
      }
      if (action === "delete") {
        fetcherRef.current.submit(
          { intent: "delete", offerId, surface: surface ?? "" },
          { method: "POST" },
        );
      }
    };

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, []);

  const activeCount = offers.filter((o: any) => o.isActive).length;

  return (
    <div ref={containerRef}>
      <s-page heading="SuperUpsell">
        {/* Metrics row */}
        {offers.length > 0 && (
          <s-section padding="base">
            <s-grid
              gridTemplateColumns="@container (inline-size <= 400px) 1fr, 1fr auto 1fr auto 1fr"
              gap="small"
            >
              <s-clickable
                paddingBlock="small-400"
                paddingInline="small-100"
                borderRadius="base"
              >
                <s-grid gap="small-300">
                  <s-stack direction="inline" gap="small-200" align-items="center">
                    <s-icon type="list-bulleted" color="subdued" size="small" />
                    <s-heading>Total offers</s-heading>
                  </s-stack>
                  <s-text>{offers.length}</s-text>
                </s-grid>
              </s-clickable>
              <s-divider direction="block" />
              <s-clickable
                paddingBlock="small-400"
                paddingInline="small-100"
                borderRadius="base"
              >
                <s-grid gap="small-300">
                  <s-stack direction="inline" gap="small-200" align-items="center">
                    <s-icon type="check-circle" tone="success" size="small" />
                    <s-heading>Active</s-heading>
                  </s-stack>
                  <s-stack direction="inline" gap="small-200">
                    <s-text>{activeCount}</s-text>
                    {activeCount > 0 && (
                      <s-badge tone="success" icon="check-circle">Running</s-badge>
                    )}
                  </s-stack>
                </s-grid>
              </s-clickable>
              <s-divider direction="block" />
              <s-clickable
                paddingBlock="small-400"
                paddingInline="small-100"
                borderRadius="base"
              >
                <s-grid gap="small-300">
                  <s-stack direction="inline" gap="small-200" align-items="center">
                    <s-icon type="x-circle" color="subdued" size="small" />
                    <s-heading>Inactive</s-heading>
                  </s-stack>
                  <s-text>{offers.length - activeCount}</s-text>
                </s-grid>
              </s-clickable>
            </s-grid>
          </s-section>
        )}

        {/* Create new offer */}
        <s-section heading="Create new offer">
          <s-grid
            gridTemplateColumns="@container (inline-size <= 500px) 1fr, 1fr 1fr 1fr"
            gap="base"
          >
            {SURFACES.map((surface) => (
              <s-box
                key={surface.key}
                padding="large-200"
                border="base"
                border-radius="base"
              >
                <s-stack direction="block" gap="base">
                  <s-stack direction="inline" gap="base" align-items="center">
                    <s-box padding="small-200" background="subdued" border-radius="base">
                      <s-icon type={surface.icon} />
                    </s-box>
                    <s-stack direction="block" gap="small-100">
                      <s-heading>{surface.title}</s-heading>
                      <s-text color="subdued">{surface.description}</s-text>
                    </s-stack>
                  </s-stack>
                  <s-button variant="primary" icon="plus" href={surface.href}>
                    Create offer
                  </s-button>
                </s-stack>
              </s-box>
            ))}
          </s-grid>
        </s-section>

        {/* Offers table */}
        {offers.length > 0 ? (
          <s-section heading="Your offers">
            <s-table>
              <s-table-header-row>
                <s-table-header>Name</s-table-header>
                <s-table-header>Type</s-table-header>
                <s-table-header>Status</s-table-header>
                <s-table-header>Discount</s-table-header>
                <s-table-header>Products</s-table-header>
                <s-table-header>Actions</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {offers.map((offer: any) => {
                  const slug = SURFACE_SLUGS[offer.surface];
                  return (
                    <s-table-row key={offer.id}>
                      <s-table-cell>
                        <s-link href={`/app/upsells/${slug}/${offer.id}`}>
                          {offer.upsellName}
                        </s-link>
                      </s-table-cell>
                      <s-table-cell>
                        <s-badge icon={SURFACE_ICONS[offer.surface] as any}>
                          {SURFACE_LABELS[offer.surface]}
                        </s-badge>
                      </s-table-cell>
                      <s-table-cell>
                        <s-badge
                          tone={offer.isActive ? "success" : undefined}
                          icon={offer.isActive ? "check-circle" : "x-circle"}
                        >
                          {offer.isActive ? "Active" : "Inactive"}
                        </s-badge>
                      </s-table-cell>
                      <s-table-cell>
                        <s-badge icon="discount">{offer.discountPercentage}%</s-badge>
                      </s-table-cell>
                      <s-table-cell>
                        <s-text color="subdued">
                          {offer.products.length} product
                          {offer.products.length !== 1 ? "s" : ""}
                        </s-text>
                      </s-table-cell>
                      <s-table-cell>
                        <s-stack direction="inline" gap="small-200">
                          {offer.isActive ? (
                            <s-button
                              variant="secondary"
                              tone="critical"
                              icon="toggle-off"
                              data-offer-action="toggle"
                              data-offer-id={offer.id}
                              data-offer-surface={offer.surface}
                            >
                              Deactivate
                            </s-button>
                          ) : (
                            <s-button
                              variant="primary"
                              icon="toggle-on"
                              data-offer-action="toggle"
                              data-offer-id={offer.id}
                              data-offer-surface={offer.surface}
                            >
                              Activate
                            </s-button>
                          )}
                          <s-button
                            variant="tertiary"
                            tone="critical"
                            icon="delete"
                            data-offer-action="delete"
                            data-offer-id={offer.id}
                            data-offer-surface={offer.surface}
                          >
                            Delete
                          </s-button>
                        </s-stack>
                      </s-table-cell>
                    </s-table-row>
                  );
                })}
              </s-table-body>
            </s-table>
          </s-section>
        ) : (
          <s-section accessibilityLabel="Empty state section">
            <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
              <s-grid justifyItems="center" maxInlineSize="450px" gap="base">
                <s-stack align-items="center" direction="block" gap="small-200">
                  <s-icon type="discount" color="subdued" />
                  <s-heading>No offers yet</s-heading>
                  <s-paragraph color="subdued">
                    Create your first upsell offer to start boosting your revenue.
                  </s-paragraph>
                </s-stack>
                <s-button variant="primary" icon="plus" href="/app/upsells/product-page/new">
                  Create your first offer
                </s-button>
              </s-grid>
            </s-grid>
          </s-section>
        )}
      </s-page>
    </div>
  );
}
