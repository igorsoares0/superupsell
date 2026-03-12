import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useActionData, redirect } from "react-router";
import { authenticate } from "../shopify.server";
import {
  parseSurfaceSlug,
  surfaceLabel,
  getOfferById,
  parseOfferFormData,
  validateOfferData,
  updateOffer,
  syncOfferMetafield,
  syncDiscountFunction,
} from "../models/offer.server";
import { OfferForm } from "../components/OfferForm";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const surface = parseSurfaceSlug(params.surface!);
  if (!surface) throw new Response("Invalid surface", { status: 404 });

  const offer = await getOfferById(params.id!, session.shop);
  if (!offer) throw new Response("Offer not found", { status: 404 });

  // Enrich products and targets with titles/images from Shopify
  const allIds = [
    ...offer.products.map((p) => p.productId),
    ...offer.targets.map((t) => t.targetId),
  ];

  const nodeMap = new Map<string, { title: string; imageUrl?: string }>();
  if (allIds.length > 0) {
    try {
      const res = await admin.graphql(
        `query GetNodes($ids: [ID!]!) {
          nodes(ids: $ids) {
            id
            ... on Product { title, featuredImage { url } }
            ... on Collection { title, image { url } }
          }
        }`,
        { variables: { ids: allIds } },
      );
      const { data } = await res.json();
      for (const node of data?.nodes ?? []) {
        if (node?.id) {
          nodeMap.set(node.id, {
            title: node.title ?? node.id,
            imageUrl: node.featuredImage?.url ?? node.image?.url,
          });
        }
      }
    } catch {
      // If enrichment fails, we still show raw IDs
    }
  }

  const enrichedOffer = {
    ...offer,
    products: offer.products.map((p) => ({
      ...p,
      title: nodeMap.get(p.productId)?.title,
      imageUrl: nodeMap.get(p.productId)?.imageUrl,
    })),
    targets: offer.targets.map((t) => ({
      ...t,
      title: nodeMap.get(t.targetId)?.title,
      imageUrl: nodeMap.get(t.targetId)?.imageUrl,
    })),
  };

  return { offer: enrichedOffer, label: surfaceLabel(surface), slug: params.surface! };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const surface = parseSurfaceSlug(params.surface!);
  if (!surface) throw new Response("Invalid surface", { status: 404 });

  const formData = await request.formData();
  const data = parseOfferFormData(formData);

  const errors = validateOfferData(data);
  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  await updateOffer(params.id!, session.shop, data);
  await syncOfferMetafield(admin, session.shop, surface);
  await syncDiscountFunction(admin, params.id!);
  return redirect(`/app/upsells/${params.surface}`);
};

export default function EditOffer() {
  const { offer, label, slug } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <OfferForm
      offer={offer}
      surfaceLabel={label}
      surfaceSlug={slug}
      errors={(actionData as any)?.errors}
    />
  );
}
