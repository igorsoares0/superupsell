import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

// FR-100: Analytics dashboard
// Full implementation in BL-030 (tracking) and BL-031 (dashboard)
export default function Analytics() {
  return (
    <s-page heading="Analytics">
      <s-section heading="Performance Overview">
        <s-paragraph>
          Track impressions, conversions, conversion rate, and total revenue
          across all upsell surfaces.
        </s-paragraph>
        <s-paragraph>
          Analytics dashboard coming soon — BL-030 / BL-031
        </s-paragraph>
      </s-section>
    </s-page>
  );
}
