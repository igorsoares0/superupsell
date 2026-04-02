import { useEffect, useRef } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  parseSurfaceSlug,
  surfaceLabel,
  getOffersBySurface,
  toggleOfferActive,
  deleteOffer,
  syncOfferMetafield,
  syncDiscountFunction,
} from "../models/offer.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const surface = parseSurfaceSlug(params.surface!);
  if (!surface) throw new Response("Invalid surface", { status: 404 });

  const offers = await getOffersBySurface(session.shop, surface);
  return {
    offers,
    surface,
    label: surfaceLabel(surface),
    slug: params.surface!,
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const surface = parseSurfaceSlug(params.surface!);
  if (!surface) throw new Response("Invalid surface", { status: 404 });

  const formData = await request.formData();
  const intent = formData.get("intent");
  const offerId = formData.get("offerId") as string;

  let knownDiscountId: string | null = null;

  switch (intent) {
    case "toggle":
      await toggleOfferActive(offerId, session.shop);
      break;
    case "delete": {
      // Capture discount ID before the row is deleted
      const doomed = await prisma.upsellOffer.findFirst({
        where: { id: offerId, shop: session.shop },
        select: { shopifyDiscountId: true },
      });
      knownDiscountId = doomed?.shopifyDiscountId ?? null;
      await deleteOffer(offerId, session.shop);
      break;
    }
  }

  // Rebuild the single consolidated discount and metafield
  await syncOfferMetafield(admin, session.shop, surface);
  await syncDiscountFunction(admin, session.shop, knownDiscountId);

  return { ok: true };
};

export default function OfferList() {
  const { offers, label, slug } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const containerRef = useRef<HTMLDivElement>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Native click handler — React 18 onClick doesn't work on s-button
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
      if (!offerId) return;

      if (action === "toggle") {
        fetcherRef.current.submit(
          { intent: "toggle", offerId },
          { method: "POST" },
        );
      }
      if (action === "delete") {
        fetcherRef.current.submit(
          { intent: "delete", offerId },
          { method: "POST" },
        );
      }
    };

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, []);

  return (
    <div ref={containerRef}>
      <s-page heading={`${label} Upsell`}>
        <s-link slot="breadcrumb-actions" href="/app">
          Home
        </s-link>
        <s-link slot="primary-action" href={`/app/upsells/${slug}/new`}>
          Create offer
        </s-link>

        {offers.length === 0 ? (
          <s-section accessibilityLabel="Empty state section">
            <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
              <s-grid justifyItems="center" maxInlineSize="450px" gap="base">
                <s-stack align-items="center" direction="block" gap="small-200">
                  <s-icon type="discount" color="subdued" />
                  <s-heading>No offers yet</s-heading>
                  <s-paragraph color="subdued">
                    Create your first {label.toLowerCase()} upsell offer to get started.
                  </s-paragraph>
                </s-stack>
                <s-button variant="primary" icon="plus" href={`/app/upsells/${slug}/new`}>
                  Create offer
                </s-button>
              </s-grid>
            </s-grid>
          </s-section>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Name</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Discount</s-table-header>
              <s-table-header>Products</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {offers.map((offer: any) => (
                <s-table-row key={offer.id}>
                  <s-table-cell>
                    <s-link href={`/app/upsells/${slug}/${offer.id}`}>
                      {offer.upsellName}
                    </s-link>
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
                    <s-button-group gap="base">
                      <s-button
                        variant="tertiary"
                        icon={offer.isActive ? "toggle-off" : "toggle-on"}
                        data-offer-action="toggle"
                        data-offer-id={offer.id}
                      >
                        {offer.isActive ? "Deactivate" : "Activate"}
                      </s-button>
                      <s-button
                        variant="tertiary"
                        tone="critical"
                        icon="delete"
                        data-offer-action="delete"
                        data-offer-id={offer.id}
                      >
                        Delete
                      </s-button>
                    </s-button-group>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-page>
    </div>
  );
}
