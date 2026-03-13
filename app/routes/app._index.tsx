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
    key: "product_page",
    title: "Product Page",
    description: "Show offers on product pages to encourage add-ons.",
    href: "/app/upsells/product-page/new",
  },
  {
    key: "popup",
    title: "Popup",
    description: "Trigger a popup when customers add items to cart.",
    href: "/app/upsells/popup/new",
  },
  {
    key: "cart",
    title: "Cart Page",
    description: "Present offers in the cart before checkout.",
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

  const activeCount = offers.filter((o: any) => o.isActive).length;

  return (
    <div ref={containerRef}>
      <s-page heading="SuperUpsell">
        {/* Stats row */}
        {offers.length > 0 && (
          <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
            <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E3E5E7", padding: "16px 20px" }}>
              <s-stack direction="block" gap="small-100">
                <s-text tone="subdued" variant="bodySm">Total offers</s-text>
                <s-text variant="headingLg">{offers.length}</s-text>
              </s-stack>
            </div>
            <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E3E5E7", padding: "16px 20px" }}>
              <s-stack direction="block" gap="small-100">
                <s-text tone="subdued" variant="bodySm">Active</s-text>
                <s-text variant="headingLg" tone="success">{activeCount}</s-text>
              </s-stack>
            </div>
            <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E3E5E7", padding: "16px 20px" }}>
              <s-stack direction="block" gap="small-100">
                <s-text tone="subdued" variant="bodySm">Inactive</s-text>
                <s-text variant="headingLg">{offers.length - activeCount}</s-text>
              </s-stack>
            </div>
          </s-grid>
        )}

        {/* Surface cards */}
        <div style={{ marginTop: "12px" }} />
        <s-section heading="Create new offer">
          <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
            {SURFACES.map((surface) => (
              <div
                key={surface.key}
                style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E3E5E7", padding: "20px" }}
              >
                <s-stack direction="block" gap="base">
                  <s-stack direction="block" gap="small-200">
                    <s-text variant="headingMd">{surface.title}</s-text>
                    <s-text tone="subdued" variant="bodySm">
                      {surface.description}
                    </s-text>
                  </s-stack>
                  <s-button variant="primary" href={surface.href}>
                    Create offer
                  </s-button>
                </s-stack>
              </div>
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
                        <s-badge>{SURFACE_LABELS[offer.surface]}</s-badge>
                      </s-table-cell>
                      <s-table-cell>
                        <s-badge tone={offer.isActive ? "success" : undefined}>
                          {offer.isActive ? "Active" : "Inactive"}
                        </s-badge>
                      </s-table-cell>
                      <s-table-cell>
                        <s-text variant="bodyMd">{offer.discountPercentage}%</s-text>
                      </s-table-cell>
                      <s-table-cell>
                        <s-text tone="subdued">
                          {offer.products.length} product
                          {offer.products.length !== 1 ? "s" : ""}
                        </s-text>
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
            <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E3E5E7", padding: "48px 24px", textAlign: "center" }}>
              <s-stack direction="block" gap="base" align-items="center">
                <s-text variant="headingMd">No offers yet</s-text>
                <s-text tone="subdued">
                  Get started by creating your first upsell offer above.
                </s-text>
              </s-stack>
            </div>
          </s-section>
        )}
      </s-page>
    </div>
  );
}
