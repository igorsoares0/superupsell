import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

const SURFACES = [
  {
    title: "Product Page Upsell",
    description:
      "Display upsell offers directly on the product page to encourage customers to add complementary items.",
    href: "/app/upsells/product-page",
  },
  {
    title: "Popup Upsell",
    description:
      "Show a popup offer when customers add a product to cart, suggesting related items with a discount.",
    href: "/app/upsells/popup",
  },
  {
    title: "Cart Upsell",
    description:
      "Present upsell offers in the cart page before checkout to increase average order value.",
    href: "/app/upsells/cart",
  },
] as const;

export default function Home() {
  return (
    <s-page heading="SuperUpsell">
      <s-section heading="Choose an upsell surface">
        <s-paragraph>
          Create and manage upsell offers across different surfaces of your
          store. Select a surface below to get started.
        </s-paragraph>
      </s-section>

      <s-grid gridTemplateColumns="1fr 1fr" gap="base">
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
              <s-link href={surface.href}>Manage →</s-link>
            </s-stack>
          </s-box>
        ))}
      </s-grid>
    </s-page>
  );
}
