import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

// FR-110: Billing page
// Full implementation in BL-032
export default function Billing() {
  return (
    <s-page heading="Billing">
      <s-section heading="Subscription Plan">
        <s-paragraph>
          SuperUpsell offers a 14-day free trial. After the trial, the plan is
          USD 12.99 per month.
        </s-paragraph>
        <s-paragraph>
          Billing integration coming soon — BL-032
        </s-paragraph>
      </s-section>
    </s-page>
  );
}
