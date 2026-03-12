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
} from "../models/offer.server";
import { OfferForm } from "../components/OfferForm";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const surface = parseSurfaceSlug(params.surface!);
  if (!surface) throw new Response("Invalid surface", { status: 404 });

  const offer = await getOfferById(params.id!, session.shop);
  if (!offer) throw new Response("Offer not found", { status: 404 });

  return { offer, label: surfaceLabel(surface), slug: params.surface! };
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
