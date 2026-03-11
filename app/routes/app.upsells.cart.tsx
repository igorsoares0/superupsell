import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

// FR-080: Cart surface editor
// Full implementation in BL-010 (CRUD) and BL-011 (editor + preview)
export default function CartUpsell() {
  return (
    <s-page heading="Cart Upsell">
      <s-link slot="breadcrumb-actions" href="/app">
        Home
      </s-link>
      <s-section heading="Editor">
        <s-paragraph>
          Configure upsell offers that appear on the cart page. Editor coming
          soon.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}
