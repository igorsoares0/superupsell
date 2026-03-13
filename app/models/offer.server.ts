import prisma from "../db.server";
import type { Surface, TargetMode, Layout } from "@prisma/client";
import { Prisma } from "@prisma/client";

// ─── Surface slug ↔ enum mapping ───

const SURFACE_FROM_SLUG: Record<string, Surface> = {
  "product-page": "product_page",
  popup: "popup",
  cart: "cart",
};

const SLUG_FROM_SURFACE: Record<Surface, string> = {
  product_page: "product-page",
  popup: "popup",
  cart: "cart",
};

const SURFACE_LABELS: Record<Surface, string> = {
  product_page: "Product Page",
  popup: "Popup",
  cart: "Cart",
};

export function parseSurfaceSlug(slug: string): Surface | null {
  return SURFACE_FROM_SLUG[slug] ?? null;
}

export function surfaceToSlug(surface: Surface): string {
  return SLUG_FROM_SURFACE[surface];
}

export function surfaceLabel(surface: Surface): string {
  return SURFACE_LABELS[surface];
}

// ─── Serialization (Decimal → number, Date → string for loaders) ───

export function serializeOffer(offer: any) {
  return {
    ...offer,
    discountPercentage: Number(offer.discountPercentage),
    createdAt:
      offer.createdAt instanceof Date
        ? offer.createdAt.toISOString()
        : offer.createdAt,
    updatedAt:
      offer.updatedAt instanceof Date
        ? offer.updatedAt.toISOString()
        : offer.updatedAt,
  };
}

// ─── Validation (FR-030, AC-010) ───

export function validateOfferData(
  data: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.upsellName || String(data.upsellName).trim() === "") {
    errors.upsellName = "Offer name is required";
  }

  if (!data.discountLabel || String(data.discountLabel).trim() === "") {
    errors.discountLabel = "Discount label is required";
  }

  const pct = Number(data.discountPercentage);
  if (isNaN(pct) || pct <= 0 || pct > 100) {
    errors.discountPercentage =
      "Discount percentage must be between 0.01 and 100";
  }

  const targetMode = String(data.targetMode);
  if (targetMode === "collections" || targetMode === "specific_products") {
    const targets = data.targets as any[] | undefined;
    if (!targets || targets.length === 0) {
      errors.targets =
        targetMode === "collections"
          ? "Select at least one collection"
          : "Select at least one target product";
    }
  }

  const products = data.upsellProducts as any[] | undefined;
  if (!products || products.length === 0) {
    errors.upsellProducts = "Select at least one upsell product";
  }

  return errors;
}

// ─── Parse FormData → plain object ───

export function parseOfferFormData(formData: FormData): Record<string, any> {
  const data: Record<string, any> = {};

  for (const key of [
    "upsellName",
    "discountLabel",
    "targetMode",
    "layout",
    "titleText",
    "buttonText",
    "buttonColor",
    "backgroundColor",
    "borderColor",
  ]) {
    data[key] = formData.get(key) ?? "";
  }

  data.discountPercentage = Number(formData.get("discountPercentage")) || 0;
  data.titleSize = Number(formData.get("titleSize")) || 18;
  data.textSize = Number(formData.get("textSize")) || 14;
  data.buttonSize = Number(formData.get("buttonSize")) || 14;
  data.cornerRadius = Number(formData.get("cornerRadius")) || 8;

  data.showVariants = formData.get("showVariants") === "true";
  data.showImage = formData.get("showImage") === "true";
  data.isActive = formData.get("isActive") === "true";

  try {
    data.targets = JSON.parse((formData.get("targets") as string) || "[]");
  } catch {
    data.targets = [];
  }
  try {
    data.upsellProducts = JSON.parse(
      (formData.get("upsellProducts") as string) || "[]",
    );
  } catch {
    data.upsellProducts = [];
  }

  return data;
}

// ─── Queries ───

export async function getOffersBySurface(shop: string, surface: Surface) {
  const offers = await prisma.upsellOffer.findMany({
    where: { shop, surface },
    include: {
      products: { orderBy: { position: "asc" } },
      targets: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return offers.map(serializeOffer);
}

export async function getOfferById(id: string, shop: string) {
  const offer = await prisma.upsellOffer.findFirst({
    where: { id, shop },
    include: {
      products: { orderBy: { position: "asc" } },
      targets: true,
    },
  });
  return offer ? serializeOffer(offer) : null;
}

// ─── Metafield sync (BL-012) ───

const METAFIELD_NAMESPACE = "$app:superupsell";

/**
 * Sync the active offer for a surface to a Shop metafield.
 * The storefront reads this metafield in Liquid — no API calls needed.
 */
export async function syncOfferMetafield(
  admin: { graphql: Function },
  shop: string,
  surface: Surface,
) {
  // 1. Find the most recently updated active offer for this surface
  const offer = await prisma.upsellOffer.findFirst({
    where: { shop, surface, isActive: true },
    include: {
      products: { orderBy: { position: "asc" } },
      targets: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  // 2. Get Shop GID
  const shopRes = await admin.graphql(`{ shop { id } }`);
  const shopData = await shopRes.json();
  const shopGid = shopData.data.shop.id;

  // 3. If no active offer, write null to clear the metafield
  if (!offer) {
    await admin.graphql(
      `mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          metafields: [
            {
              ownerId: shopGid,
              namespace: METAFIELD_NAMESPACE,
              key: surface,
              value: "null",
              type: "json",
            },
          ],
        },
      },
    );
    return;
  }

  // 4. Fetch product handles from Shopify
  const productGids = offer.products.map((p) => p.productId);
  let handleMap = new Map<string, string>();

  if (productGids.length > 0) {
    const prodRes = await admin.graphql(
      `query getHandles($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product { id handle }
        }
      }`,
      { variables: { ids: productGids } },
    );
    const prodData = await prodRes.json();
    for (const node of prodData.data?.nodes ?? []) {
      if (node?.id && node?.handle) handleMap.set(node.id, node.handle);
    }
  }

  // 5. Build metafield JSON
  const value = {
    id: offer.id,
    isActive: true,
    titleText: offer.titleText,
    buttonText: offer.buttonText,
    buttonColor: offer.buttonColor,
    backgroundColor: offer.backgroundColor,
    borderColor: offer.borderColor,
    titleSize: offer.titleSize,
    textSize: offer.textSize,
    buttonSize: offer.buttonSize,
    cornerRadius: offer.cornerRadius,
    discountPercentage: Number(offer.discountPercentage),
    discountLabel: offer.discountLabel,
    showVariants: offer.showVariants,
    showImage: offer.showImage,
    layout: offer.layout,
    targetMode: offer.targetMode,
    targets: offer.targets.map((t) => ({
      targetType: t.targetType,
      targetId: t.targetId,
    })),
    products: offer.products.map((p) => ({
      handle: handleMap.get(p.productId) ?? "",
      position: p.position,
    })),
  };

  // 6. Write metafield
  await admin.graphql(
    `mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId: shopGid,
            namespace: METAFIELD_NAMESPACE,
            key: surface,
            value: JSON.stringify(value),
            type: "json",
          },
        ],
      },
    },
  );
}

// ─── Discount Function sync (BL-020) ───

const DISCOUNT_METAFIELD_KEY = "function-configuration";

/**
 * Find the discount function ID for our app.
 */
async function getDiscountFunctionId(
  admin: { graphql: Function },
): Promise<string | null> {
  const res = await admin.graphql(`{
    shopifyFunctions(first: 25) {
      nodes { id apiType }
    }
  }`);
  const data = await res.json();
  const fn = data.data?.shopifyFunctions?.nodes?.find(
    (n: any) => n.apiType === "discount",
  );
  return fn?.id ?? null;
}

/**
 * Sync the Shopify automatic discount for an offer.
 * Creates/updates/deletes the automatic discount linked to our function.
 * Called after create, update, or toggle.
 */
export async function syncDiscountFunction(
  admin: { graphql: Function },
  offerId: string,
) {
  const offer = await prisma.upsellOffer.findFirst({
    where: { id: offerId },
    include: { products: true },
  });
  if (!offer) return;

  const needsDiscount =
    offer.isActive &&
    Number(offer.discountPercentage) > 0 &&
    offer.products.length > 0;

  if (needsDiscount) {
    const config = JSON.stringify({
      percentage: Number(offer.discountPercentage),
      discountLabel: offer.discountLabel,
      productIds: offer.products.map((p) => p.productId),
    });

    if (offer.shopifyDiscountId) {
      // Update the existing discount's config metafield
      await admin.graphql(
        `mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields { id }
            userErrors { field message }
          }
        }`,
        {
          variables: {
            metafields: [
              {
                ownerId: offer.shopifyDiscountId,
                namespace: METAFIELD_NAMESPACE,
                key: DISCOUNT_METAFIELD_KEY,
                value: config,
                type: "json",
              },
            ],
          },
        },
      );
    } else {
      // Create a new automatic discount linked to our function
      const functionId = await getDiscountFunctionId(admin);
      if (!functionId) {
        console.error("SuperUpsell: discount function not found — deploy the extension first");
        return;
      }

      const res = await admin.graphql(
        `mutation discountCreate($discount: DiscountAutomaticAppInput!) {
          discountAutomaticAppCreate(automaticAppDiscount: $discount) {
            automaticAppDiscount { discountId }
            userErrors { field message }
          }
        }`,
        {
          variables: {
            discount: {
              title: `SuperUpsell: ${offer.upsellName}`,
              functionId,
              startsAt: new Date().toISOString(),
              discountClasses: ["PRODUCT"],
              combinesWith: {
                orderDiscounts: true,
                productDiscounts: true,
                shippingDiscounts: true,
              },
              metafields: [
                {
                  namespace: METAFIELD_NAMESPACE,
                  key: DISCOUNT_METAFIELD_KEY,
                  type: "json",
                  value: config,
                },
              ],
            },
          },
        },
      );
      const result = await res.json();
      const errors =
        result.data?.discountAutomaticAppCreate?.userErrors;
      if (errors?.length > 0) {
        console.error("SuperUpsell: discount create errors", errors);
        return;
      }

      const discountId =
        result.data?.discountAutomaticAppCreate?.automaticAppDiscount
          ?.discountId;
      if (discountId) {
        await prisma.upsellOffer.update({
          where: { id: offerId },
          data: { shopifyDiscountId: discountId },
        });
      }
    }
  } else {
    // Offer inactive or no discount — remove the Shopify discount if it exists
    if (offer.shopifyDiscountId) {
      await admin.graphql(
        `mutation discountDelete($id: ID!) {
          discountAutomaticDelete(id: $id) {
            deletedAutomaticDiscountId
            userErrors { field message }
          }
        }`,
        { variables: { id: offer.shopifyDiscountId } },
      );
      await prisma.upsellOffer.update({
        where: { id: offerId },
        data: { shopifyDiscountId: null },
      });
    }
  }
}

/**
 * Clean up the Shopify discount before deleting an offer from the DB.
 */
export async function cleanupDiscountForOffer(
  admin: { graphql: Function },
  offerId: string,
  shop: string,
) {
  const offer = await prisma.upsellOffer.findFirst({
    where: { id: offerId, shop },
    select: { shopifyDiscountId: true },
  });
  if (!offer?.shopifyDiscountId) return;

  await admin.graphql(
    `mutation discountDelete($id: ID!) {
      discountAutomaticDelete(id: $id) {
        deletedAutomaticDiscountId
        userErrors { field message }
      }
    }`,
    { variables: { id: offer.shopifyDiscountId } },
  );
}

// ─── Mutations ───

export async function createOffer(
  shop: string,
  surface: Surface,
  data: Record<string, any>,
) {
  const targets = (data.targets ?? []) as Array<{
    type: string;
    id: string;
  }>;
  const products = (data.upsellProducts ?? []) as Array<{
    productId: string;
    variantIds?: string[];
  }>;

  return prisma.upsellOffer.create({
    data: {
      shop,
      surface,
      upsellName: String(data.upsellName),
      discountLabel: String(data.discountLabel),
      targetMode: data.targetMode as TargetMode,
      discountPercentage: Number(data.discountPercentage),
      showVariants: data.showVariants === true,
      showImage: data.showImage !== false,
      layout: (data.layout as Layout) || "vertical",
      titleText: String(data.titleText || "You may also like"),
      buttonText: String(data.buttonText || "Add to cart"),
      buttonColor: String(data.buttonColor || "#000000"),
      backgroundColor: String(data.backgroundColor || "#FFFFFF"),
      borderColor: String(data.borderColor || "#E0E0E0"),
      titleSize: Number(data.titleSize) || 18,
      textSize: Number(data.textSize) || 14,
      buttonSize: Number(data.buttonSize) || 14,
      cornerRadius: Number(data.cornerRadius) || 8,
      isActive: data.isActive === true,
      targets: {
        create: targets.map((t) => ({
          targetType: t.type,
          targetId: t.id,
        })),
      },
      products: {
        create: products.map((p, i) => ({
          productId: p.productId,
          variantIds: p.variantIds ?? Prisma.JsonNull,
          position: i,
        })),
      },
    },
  });
}

export async function updateOffer(
  id: string,
  shop: string,
  data: Record<string, any>,
) {
  const existing = await prisma.upsellOffer.findFirst({
    where: { id, shop },
    select: { id: true },
  });
  if (!existing) throw new Response("Offer not found", { status: 404 });

  const targets = (data.targets ?? []) as Array<{
    type: string;
    id: string;
  }>;
  const products = (data.upsellProducts ?? []) as Array<{
    productId: string;
    variantIds?: string[];
  }>;

  return prisma.$transaction(async (tx) => {
    await tx.upsellOfferTarget.deleteMany({ where: { offerId: id } });
    await tx.upsellOfferProduct.deleteMany({ where: { offerId: id } });

    return tx.upsellOffer.update({
      where: { id },
      data: {
        upsellName: String(data.upsellName),
        discountLabel: String(data.discountLabel),
        targetMode: data.targetMode as TargetMode,
        discountPercentage: Number(data.discountPercentage),
        showVariants: data.showVariants === true,
        showImage: data.showImage !== false,
        layout: (data.layout as Layout) || "vertical",
        titleText: String(data.titleText),
        buttonText: String(data.buttonText),
        buttonColor: String(data.buttonColor),
        backgroundColor: String(data.backgroundColor),
        borderColor: String(data.borderColor),
        titleSize: Number(data.titleSize),
        textSize: Number(data.textSize),
        buttonSize: Number(data.buttonSize),
        cornerRadius: Number(data.cornerRadius),
        isActive: data.isActive === true,
        targets: {
          create: targets.map((t) => ({
            targetType: t.type,
            targetId: t.id,
          })),
        },
        products: {
          create: products.map((p, i) => ({
            productId: p.productId,
            variantIds: p.variantIds ?? Prisma.JsonNull,
            position: i,
          })),
        },
      },
    });
  });
}

export async function toggleOfferActive(id: string, shop: string) {
  const offer = await prisma.upsellOffer.findFirst({
    where: { id, shop },
    select: { isActive: true },
  });
  if (!offer) throw new Response("Offer not found", { status: 404 });

  return prisma.upsellOffer.update({
    where: { id },
    data: { isActive: !offer.isActive },
  });
}

export async function deleteOffer(id: string, shop: string) {
  const existing = await prisma.upsellOffer.findFirst({
    where: { id, shop },
    select: { id: true },
  });
  if (!existing) throw new Response("Offer not found", { status: 404 });

  return prisma.upsellOffer.delete({ where: { id } });
}
