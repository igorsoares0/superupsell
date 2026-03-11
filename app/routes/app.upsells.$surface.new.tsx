import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useActionData, redirect } from "react-router";
import { authenticate } from "../shopify.server";
import {
  parseSurfaceSlug,
  surfaceLabel,
  parseOfferFormData,
  validateOfferData,
  createOffer,
} from "../models/offer.server";
import { OfferForm } from "../components/OfferForm";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const surface = parseSurfaceSlug(params.surface!);
  if (!surface) throw new Response("Invalid surface", { status: 404 });

  return { label: surfaceLabel(surface), slug: params.surface! };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const surface = parseSurfaceSlug(params.surface!);
  if (!surface) throw new Response("Invalid surface", { status: 404 });

  const formData = await request.formData();
  const data = parseOfferFormData(formData);

  const errors = validateOfferData(data);
  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  await createOffer(session.shop, surface, data);
  return redirect(`/app/upsells/${params.surface}`);
};

export default function NewOffer() {
  const { label, slug } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <OfferForm
      surfaceLabel={label}
      surfaceSlug={slug}
      errors={(actionData as any)?.errors}
    />
  );
}
