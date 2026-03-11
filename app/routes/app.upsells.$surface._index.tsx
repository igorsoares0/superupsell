import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import {
  parseSurfaceSlug,
  surfaceLabel,
  getOffersBySurface,
  toggleOfferActive,
  deleteOffer,
} from "../models/offer.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const surface = parseSurfaceSlug(params.surface!);
  if (!surface) throw new Response("Invalid surface", { status: 404 });

  const offers = await getOffersBySurface(session.shop, surface);
  return { offers, surface, label: surfaceLabel(surface), slug: params.surface! };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const offerId = formData.get("offerId") as string;

  switch (intent) {
    case "toggle":
      await toggleOfferActive(offerId, session.shop);
      break;
    case "delete":
      await deleteOffer(offerId, session.shop);
      break;
  }

  return { ok: true };
};

export default function OfferList() {
  const { offers, label, slug } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const handleToggle = (offerId: string) => {
    fetcher.submit(
      { intent: "toggle", offerId },
      { method: "POST" },
    );
  };

  const handleDelete = (offerId: string) => {
    fetcher.submit(
      { intent: "delete", offerId },
      { method: "POST" },
    );
  };

  return (
    <s-page heading={`${label} Upsell`}>
      <s-link slot="breadcrumb-actions" href="/app">
        Home
      </s-link>
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => navigate(`/app/upsells/${slug}/new`)}
      >
        Create offer
      </s-button>

      {offers.length === 0 ? (
        <s-section heading="No offers yet">
          <s-paragraph>
            Create your first {label.toLowerCase()} upsell offer to get
            started.
          </s-paragraph>
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
                      onClick={() => handleToggle(offer.id)}
                    >
                      {offer.isActive ? "Deactivate" : "Activate"}
                    </s-button>
                    <s-button
                      variant="tertiary"
                      tone="critical"
                      onClick={() => handleDelete(offer.id)}
                    >
                      Delete
                    </s-button>
                  </s-stack>
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      )}
    </s-page>
  );
}
