import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import type { Surface } from "@prisma/client";

/**
 * POST /webhooks/orders/paid
 *
 * When an order is paid, check if any line items match products from
 * active upsell offers. If so, record real conversion + revenue.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (!payload || !shop) return new Response();

  const lineItems = (payload as any).line_items;
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return new Response();
  }

  // Build a set of Shopify product GIDs from the order line items
  const orderProductGids = new Set<string>();
  const lineItemsByGid = new Map<
    string,
    { price: number; quantity: number; variantId: string }
  >();

  for (const item of lineItems) {
    if (!item.product_id) continue;
    const gid = `gid://shopify/Product/${item.product_id}`;
    orderProductGids.add(gid);
    // Accumulate in case multiple line items for same product
    const existing = lineItemsByGid.get(gid);
    const itemPrice =
      parseFloat(item.price) * (item.quantity || 1) -
      parseFloat(item.total_discount || "0");
    if (existing) {
      existing.price += itemPrice;
      existing.quantity += item.quantity || 1;
    } else {
      lineItemsByGid.set(gid, {
        price: itemPrice,
        quantity: item.quantity || 1,
        variantId: String(item.variant_id || ""),
      });
    }
  }

  // Find active offers for this shop that contain any of these products
  const matchingOfferProducts = await prisma.upsellOfferProduct.findMany({
    where: {
      productId: { in: Array.from(orderProductGids) },
      offer: { shop, isActive: true },
    },
    include: {
      offer: { select: { id: true, surface: true } },
    },
  });

  if (matchingOfferProducts.length === 0) return new Response();

  // Deduplicate: one conversion per offer per order
  const seen = new Set<string>();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (const op of matchingOfferProducts) {
    const offerId = op.offer.id;
    if (seen.has(offerId)) continue;
    seen.add(offerId);

    const surface = op.offer.surface;
    const lineItem = lineItemsByGid.get(op.productId);
    const revenue = lineItem?.price ?? 0;

    // Write raw analytics event
    await prisma.analyticsEvent.create({
      data: {
        shop,
        offerId,
        surface,
        eventType: "conversion",
        amount: revenue > 0 ? revenue : undefined,
        metadata: {
          orderId: (payload as any).id,
          productId: op.productId,
          variantId: lineItem?.variantId,
        },
      },
    });

    // Update daily aggregate
    await prisma.dailyMetric.upsert({
      where: { shop_surface_day: { shop, surface, day: today } },
      update: {
        conversions: { increment: 1 },
        revenue: { increment: revenue > 0 ? revenue : 0 },
      },
      create: {
        shop,
        surface,
        day: today,
        impressions: 0,
        clicks: 0,
        addToCarts: 0,
        conversions: 1,
        revenue: revenue > 0 ? revenue : 0,
      },
    });
  }

  return new Response();
};
