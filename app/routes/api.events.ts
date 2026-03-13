import type { ActionFunctionArgs } from "react-router";
import prisma from "../db.server";
import type { Surface, EventType } from "@prisma/client";

const VALID_EVENTS: EventType[] = ["impression", "click", "conversion"];
const VALID_SURFACES: Surface[] = [
  "product_page",
  "popup",
  "cart",
];

/**
 * POST /api/events
 * Receives analytics events from the storefront via App Proxy.
 * Shopify adds ?shop=xxx automatically.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  if (!shop) {
    return Response.json({ error: "missing shop" }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const events = Array.isArray(body) ? body : [body];

  for (const evt of events) {
    const eventType = evt.eventType as EventType;
    const surface = evt.surface as Surface;
    const offerId = evt.offerId as string | undefined;

    if (!VALID_EVENTS.includes(eventType)) continue;
    if (!VALID_SURFACES.includes(surface)) continue;
    if (!offerId) continue;

    // Write raw event
    await prisma.analyticsEvent.create({
      data: {
        shop,
        offerId,
        surface,
        eventType,
        metadata: evt.productId
          ? { productId: evt.productId, variantId: evt.variantId }
          : undefined,
      },
    });

    // Update daily aggregate
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (eventType === "impression" || eventType === "conversion") {
      await prisma.dailyMetric.upsert({
        where: { shop_surface_day: { shop, surface, day: today } },
        update:
          eventType === "impression"
            ? { impressions: { increment: 1 } }
            : { conversions: { increment: 1 } },
        create: {
          shop,
          surface,
          day: today,
          impressions: eventType === "impression" ? 1 : 0,
          conversions: eventType === "conversion" ? 1 : 0,
          revenue: 0,
        },
      });
    }
  }

  return Response.json({ ok: true });
};
