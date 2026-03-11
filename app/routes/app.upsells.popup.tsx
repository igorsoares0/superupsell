import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

// FR-070: Popup surface editor
// Full implementation in BL-010 (CRUD) and BL-011 (editor + preview)
export default function PopupUpsell() {
  return (
    <s-page heading="Popup Upsell">
      <s-link slot="breadcrumb-actions" href="/app">
        Home
      </s-link>
      <s-section heading="Editor">
        <s-paragraph>
          Configure popup upsell offers that appear when customers add items to
          cart. Editor coming soon.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}
