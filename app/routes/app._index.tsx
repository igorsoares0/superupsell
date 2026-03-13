import { useEffect, useRef } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import {
  getAllOffers,
  toggleOfferActive,
  deleteOffer,
  syncOfferMetafield,
  syncDiscountFunction,
  cleanupDiscountForOffer,
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

const SURFACES = [
  {
    title: "Product Page Upsell",
    description:
      "Display upsell offers directly on the product page to encourage customers to add complementary items.",
    href: "/app/upsells/product-page/new",
  },
  {
    title: "Popup Upsell",
    description:
      "Show a popup offer when customers add a product to cart, suggesting related items with a discount.",
    href: "/app/upsells/popup/new",
  },
  {
    title: "Cart Upsell",
    description:
      "Present upsell offers in the cart page before checkout to increase average order value.",
    href: "/app/upsells/cart/new",
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

  switch (intent) {
    case "toggle":
      await toggleOfferActive(offerId, session.shop);
      await syncDiscountFunction(admin, offerId);
      break;
    case "delete":
      await cleanupDiscountForOffer(admin, offerId, session.shop);
      await deleteOffer(offerId, session.shop);
      break;
  }

  if (offerSurface) {
    await syncOfferMetafield(admin, session.shop, offerSurface);
  }

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

  return (
    <div ref={containerRef}>
      <s-page heading="SuperUpsell">
        <s-section heading="Create a new upsell">
          <s-paragraph>
            Select an upsell type below to create a new offer.
          </s-paragraph>
        </s-section>

        <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
          {SURFACES.map((surface) => (
            <s-box
              key={surface.href}
              padding="large-300"
              borderWidth="base"
              borderRadius="base"
            >
              <s-stack direction="block" gap="base">
                <s-heading>{surface.title}</s-heading>
                <s-paragraph>{surface.description}</s-paragraph>
                <s-link href={surface.href}>Create →</s-link>
              </s-stack>
            </s-box>
          ))}
        </s-grid>

        {/* Offers list */}
        {offers.length > 0 ? (
          <s-section heading="Your upsell offers">
            <s-table>
              <s-table-header-row>
                <s-table-header>Name</s-table-header>
                <s-table-header>Surface</s-table-header>
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
                        <s-badge>{SURFACE_LABELS[offer.surface]}</s-badge>
                      </s-table-cell>
                      <s-table-cell>
                        <s-badge tone={offer.isActive ? "success" : undefined}>
                          {offer.isActive ? "Active" : "Inactive"}
                        </s-badge>
                      </s-table-cell>
                      <s-table-cell>{offer.discountPercentage}%</s-table-cell>
                      <s-table-cell>
                        {offer.products.length} product
                        {offer.products.length !== 1 ? "s" : ""}
                      </s-table-cell>
                      <s-table-cell>
                        <s-stack direction="inline" gap="small-100">
                          <s-button
                            variant="tertiary"
                            data-offer-action="toggle"
                            data-offer-id={offer.id}
                            data-offer-surface={offer.surface}
                          >
                            {offer.isActive ? "Deactivate" : "Activate"}
                          </s-button>
                          <s-button
                            variant="tertiary"
                            tone="critical"
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
          <s-section>
            <s-box padding="large-400" borderWidth="base" borderRadius="base">
              <s-stack direction="block" gap="base" align-items="center">
                <s-heading>No offers yet</s-heading>
                <s-paragraph>
                  Create your first upsell offer by selecting a surface above.
                </s-paragraph>
              </s-stack>
            </s-box>
          </s-section>
        )}
      </s-page>
    </div>
  );
}
