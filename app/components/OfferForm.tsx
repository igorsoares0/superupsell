import { useState, useEffect, useRef, useCallback } from "react";
import { useSubmit, useNavigation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { UpsellPreview } from "./UpsellPreview";

type Target = { type: string; id: string; title?: string; imageUrl?: string };
type UpsellProduct = {
  productId: string;
  title?: string;
  imageUrl?: string;
  variantIds?: string[];
};

export type SerializedOffer = {
  id: string;
  upsellName: string;
  discountLabel: string;
  targetMode: string;
  discountPercentage: number;
  showVariants: boolean;
  showImage: boolean;
  layout: string;
  titleText: string;
  buttonText: string;
  buttonColor: string;
  backgroundColor: string;
  borderColor: string;
  titleSize: number;
  textSize: number;
  buttonSize: number;
  cornerRadius: number;
  isActive: boolean;
  targets: Array<{ id: string; targetType: string; targetId: string; title?: string; imageUrl?: string }>;
  products: Array<{
    id: string;
    productId: string;
    variantIds: string[] | null;
    position: number;
    title?: string;
    imageUrl?: string;
  }>;
};

type Props = {
  offer?: SerializedOffer;
  surfaceLabel: string;
  surfaceSlug: string;
  errors?: Record<string, string>;
};

const DEFAULTS = {
  upsellName: "",
  discountLabel: "",
  targetMode: "all_products",
  discountPercentage: 10,
  showVariants: false,
  showImage: true,
  layout: "vertical",
  titleText: "You may also like",
  buttonText: "Add to cart",
  buttonColor: "#000000",
  backgroundColor: "#FFFFFF",
  borderColor: "#E0E0E0",
  titleSize: 18,
  textSize: 14,
  buttonSize: 14,
  cornerRadius: 8,
  isActive: false,
};

const NUMBER_FIELDS = new Set([
  "discountPercentage",
  "titleSize",
  "textSize",
  "buttonSize",
  "cornerRadius",
]);

const BOOLEAN_FIELDS = new Set(["isActive", "showVariants", "showImage"]);

/** Attach a native click listener to a ref, avoiding React synthetic events
 *  which don't work on Polaris web components in React 18. */
function useNativeClick(
  ref: React.RefObject<any>,
  handler: () => void,
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const el = ref.current as HTMLElement | null;
    if (!el) return;
    const listener = () => handlerRef.current();
    el.addEventListener("click", listener);
    return () => el.removeEventListener("click", listener);
  }, [ref]);
}

/** Attach a native change listener to an <s-switch> ref.
 *  The change event has composed:false so it doesn't cross Shadow DOM,
 *  but <s-switch> re-dispatches a click on the host — we toggle on click. */
function useSwitchToggle(
  ref: React.RefObject<any>,
  setter: (checked: boolean) => void,
) {
  const setterRef = useRef(setter);
  setterRef.current = setter;

  useEffect(() => {
    const el = ref.current as HTMLElement | null;
    if (!el) return;
    const listener = () => {
      // After click, the web component updates its checked property
      requestAnimationFrame(() => {
        setterRef.current((el as any).checked);
      });
    };
    el.addEventListener("click", listener);
    return () => el.removeEventListener("click", listener);
  }, [ref]);
}

export function OfferForm({
  offer,
  surfaceLabel: surfLabel,
  surfaceSlug,
  errors = {},
}: Props) {
  const submit = useSubmit();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const formRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<any>(null);
  const pickProductsRef = useRef<any>(null);
  const pickTargetsRef = useRef<any>(null);
  const isActiveRef = useRef<any>(null);
  const showVariantsRef = useRef<any>(null);
  const showImageRef = useRef<any>(null);
  const targetModeRef = useRef<any>(null);
  const layoutRef = useRef<any>(null);

  const isEditing = Boolean(offer?.id);
  const isSaving = navigation.state === "submitting";

  // ─── Form state ───
  const [form, setForm] = useState(() => ({
    upsellName: offer?.upsellName ?? DEFAULTS.upsellName,
    discountLabel: offer?.discountLabel ?? DEFAULTS.discountLabel,
    targetMode: offer?.targetMode ?? DEFAULTS.targetMode,
    discountPercentage:
      offer?.discountPercentage ?? DEFAULTS.discountPercentage,
    showVariants: offer?.showVariants ?? DEFAULTS.showVariants,
    showImage: offer?.showImage ?? DEFAULTS.showImage,
    layout: offer?.layout ?? DEFAULTS.layout,
    titleText: offer?.titleText ?? DEFAULTS.titleText,
    buttonText: offer?.buttonText ?? DEFAULTS.buttonText,
    buttonColor: offer?.buttonColor ?? DEFAULTS.buttonColor,
    backgroundColor: offer?.backgroundColor ?? DEFAULTS.backgroundColor,
    borderColor: offer?.borderColor ?? DEFAULTS.borderColor,
    titleSize: offer?.titleSize ?? DEFAULTS.titleSize,
    textSize: offer?.textSize ?? DEFAULTS.textSize,
    buttonSize: offer?.buttonSize ?? DEFAULTS.buttonSize,
    cornerRadius: offer?.cornerRadius ?? DEFAULTS.cornerRadius,
    isActive: offer?.isActive ?? DEFAULTS.isActive,
  }));

  const [selectedProducts, setSelectedProducts] = useState<UpsellProduct[]>(
    () =>
      offer?.products.map((p) => ({
        productId: p.productId,
        title: p.title,
        imageUrl: p.imageUrl,
        variantIds: p.variantIds ?? undefined,
      })) ?? [],
  );

  const [selectedTargets, setSelectedTargets] = useState<Target[]>(
    () =>
      offer?.targets.map((t) => ({
        type: t.targetType,
        id: t.targetId,
        title: t.title,
        imageUrl: t.imageUrl,
      })) ?? [],
  );

  // ─── Event delegation for Polaris web component inputs ───
  useEffect(() => {
    const container = formRef.current;
    if (!container) return;

    const handleInput = (e: Event) => {
      const target = e.target as HTMLElement;
      const field = target.getAttribute("data-field");
      if (!field || BOOLEAN_FIELDS.has(field)) return;
      const value = (target as any).value;
      if (NUMBER_FIELDS.has(field)) {
        setForm((prev) => ({ ...prev, [field]: Number(value) || 0 }));
      } else {
        setForm((prev) => ({ ...prev, [field]: value }));
      }
    };

    const handleChange = (e: Event) => {
      const target = e.target as HTMLElement;
      const field = target.getAttribute("data-field");
      if (!field) return;
      if (BOOLEAN_FIELDS.has(field)) {
        setForm((prev) => ({ ...prev, [field]: (target as any).checked }));
      } else {
        setForm((prev) => ({ ...prev, [field]: (target as any).value }));
      }
    };

    container.addEventListener("input", handleInput);
    container.addEventListener("change", handleChange);
    return () => {
      container.removeEventListener("input", handleInput);
      container.removeEventListener("change", handleChange);
    };
  }, []);

  // ─── Resource pickers ───
  const pickProducts = useCallback(async () => {
    const selected = await shopify.resourcePicker({
      type: "product",
      action: "select",
      multiple: true,
    });
    if (selected) {
      setSelectedProducts((prev) => {
        const existingIds = new Set(prev.map((p) => p.productId));
        const newItems = selected
          .filter((p: any) => !existingIds.has(p.id))
          .map((p: any) => ({
            productId: p.id,
            title: p.title,
            imageUrl: p.images?.[0]?.originalSrc || p.featuredImage?.url,
            variantIds: p.variants?.map((v: any) => v.id),
          }));
        return [...prev, ...newItems];
      });
    }
  }, [shopify]);

  const pickTargets = useCallback(async () => {
    const type =
      form.targetMode === "collections" ? "collection" : "product";
    const selected = await shopify.resourcePicker({
      type,
      action: "select",
      multiple: true,
    });
    if (selected) {
      setSelectedTargets((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const newItems = selected
          .filter((r: any) => !existingIds.has(r.id))
          .map((r: any) => ({
            type,
            id: r.id,
            title: r.title,
            imageUrl: r.image?.originalSrc || r.images?.[0]?.originalSrc || r.featuredImage?.url,
          }));
        return [...prev, ...newItems];
      });
    }
  }, [shopify, form.targetMode]);

  // ─── Submit ───
  const handleSave = useCallback(() => {
    const data = new FormData();
    data.set("intent", isEditing ? "update" : "create");

    data.set("upsellName", form.upsellName);
    data.set("discountLabel", form.discountLabel);
    data.set("targetMode", form.targetMode);
    data.set("layout", form.layout);
    data.set("titleText", form.titleText);
    data.set("buttonText", form.buttonText);
    data.set("buttonColor", form.buttonColor);
    data.set("backgroundColor", form.backgroundColor);
    data.set("borderColor", form.borderColor);

    data.set("discountPercentage", String(form.discountPercentage));
    data.set("titleSize", String(form.titleSize));
    data.set("textSize", String(form.textSize));
    data.set("buttonSize", String(form.buttonSize));
    data.set("cornerRadius", String(form.cornerRadius));

    data.set("showVariants", String(form.showVariants));
    data.set("showImage", String(form.showImage));
    data.set("isActive", String(form.isActive));

    data.set("targets", JSON.stringify(selectedTargets));
    data.set("upsellProducts", JSON.stringify(selectedProducts));

    submit(data, { method: "POST" });
  }, [form, selectedProducts, selectedTargets, isEditing, submit]);

  // ─── Native click handlers (React 18 onClick doesn't work on s-button) ───
  useNativeClick(saveRef, handleSave);
  useNativeClick(pickProductsRef, pickProducts);

  // pickTargets button is conditionally rendered, so useNativeClick (which only
  // binds on mount) misses it. Re-bind whenever targetMode changes.
  const pickTargetsHandlerRef = useRef(pickTargets);
  pickTargetsHandlerRef.current = pickTargets;
  useEffect(() => {
    const el = pickTargetsRef.current as HTMLElement | null;
    if (!el) return;
    const listener = () => pickTargetsHandlerRef.current();
    el.addEventListener("click", listener);
    return () => el.removeEventListener("click", listener);
  }, [form.targetMode]);
  useSwitchToggle(isActiveRef, (v) => setForm((prev) => ({ ...prev, isActive: v })));
  useSwitchToggle(showVariantsRef, (v) => setForm((prev) => ({ ...prev, showVariants: v })));
  useSwitchToggle(showImageRef, (v) => setForm((prev) => ({ ...prev, showImage: v })));

  // Direct listeners for <s-select> (change event has composed:false in Shadow DOM)
  useEffect(() => {
    const tmEl = targetModeRef.current;
    const lyEl = layoutRef.current;
    const onTargetMode = () => {
      requestAnimationFrame(() => {
        if (tmEl) setForm((prev) => ({ ...prev, targetMode: tmEl.value }));
      });
    };
    const onLayout = () => {
      requestAnimationFrame(() => {
        if (lyEl) setForm((prev) => ({ ...prev, layout: lyEl.value }));
      });
    };
    tmEl?.addEventListener("change", onTargetMode);
    lyEl?.addEventListener("change", onLayout);
    return () => {
      tmEl?.removeEventListener("change", onTargetMode);
      lyEl?.removeEventListener("change", onLayout);
    };
  }, []);

  // ─── Render ───
  return (
    <div ref={formRef}>
      <s-page heading={`${isEditing ? "Edit" : "New"} ${surfLabel} Upsell`}>
        <s-link
          slot="breadcrumb-actions"
          href={`/app/upsells/${surfaceSlug}`}
        >
          {surfLabel} Offers
        </s-link>
        <s-button
          ref={saveRef}
          slot="primary-action"
          variant="primary"
          {...(isSaving ? { loading: true } : {})}
        >
          Save
        </s-button>

        {/* FR-040: split layout — form left, preview right */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "24px",
            alignItems: "start",
          }}
        >
          {/* ─── Left column: form ─── */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            {/* Basic Settings */}
            <div style={{ padding: "20px", border: "1px solid #e0e0e0", borderRadius: "8px", backgroundColor: "#fff" }}>
              <s-stack direction="block" gap="base">
                <s-heading>Basic Settings</s-heading>
                <s-text-field
                  label="Offer name"
                  data-field="upsellName"
                  value={form.upsellName}
                />
                {errors.upsellName && (
                  <s-banner tone="critical">{errors.upsellName}</s-banner>
                )}

                <s-text-field
                  label="Discount label"
                  data-field="discountLabel"
                  value={form.discountLabel}
                />
                {errors.discountLabel && (
                  <s-banner tone="critical">{errors.discountLabel}</s-banner>
                )}

                <s-number-field
                  label="Discount percentage"
                  data-field="discountPercentage"
                  value={String(form.discountPercentage)}
                  min={1}
                  max={100}
                  step={1}
                />
                {errors.discountPercentage && (
                  <s-banner tone="critical">
                    {errors.discountPercentage}
                  </s-banner>
                )}

                <s-switch
                  ref={isActiveRef}
                  label="Active"
                  checked={form.isActive || undefined}
                />
              </s-stack>
            </div>

            {/* Target Mode */}
            <div style={{ padding: "20px", border: "1px solid #e0e0e0", borderRadius: "8px", backgroundColor: "#fff" }}>
              <s-stack direction="block" gap="base">
                <s-heading>Target Products</s-heading>
                <s-select
                  ref={targetModeRef}
                  label="Apply to"
                  data-field="targetMode"
                  value={form.targetMode}
                >
                  <s-option value="all_products">All products</s-option>
                  <s-option value="collections">
                    Specific collections
                  </s-option>
                  <s-option value="specific_products">
                    Specific products
                  </s-option>
                </s-select>

                {(form.targetMode === "collections" ||
                  form.targetMode === "specific_products") && (
                  <>
                    <s-button ref={pickTargetsRef}>
                      Select{" "}
                      {form.targetMode === "collections"
                        ? "collections"
                        : "products"}{" "}
                      ({selectedTargets.length} selected)
                    </s-button>
                    {selectedTargets.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {selectedTargets.map((t) => (
                          <ResourceItem
                            key={t.id}
                            title={t.title || t.id}
                            imageUrl={t.imageUrl}
                            onRemove={() =>
                              setSelectedTargets((prev) =>
                                prev.filter((x) => x.id !== t.id),
                              )
                            }
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
                {errors.targets && (
                  <s-banner tone="critical">{errors.targets}</s-banner>
                )}
              </s-stack>
            </div>

            {/* Upsell Products */}
            <div style={{ padding: "20px", border: "1px solid #e0e0e0", borderRadius: "8px", backgroundColor: "#fff" }}>
              <s-stack direction="block" gap="base">
                <s-heading>Upsell Products</s-heading>
                <s-button ref={pickProductsRef}>
                  Select upsell products ({selectedProducts.length} selected)
                </s-button>
                {selectedProducts.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {selectedProducts.map((p) => (
                      <ResourceItem
                        key={p.productId}
                        title={p.title || p.productId}
                        imageUrl={p.imageUrl}
                        onRemove={() =>
                          setSelectedProducts((prev) =>
                            prev.filter((x) => x.productId !== p.productId),
                          )
                        }
                      />
                    ))}
                  </div>
                )}
                {errors.upsellProducts && (
                  <s-banner tone="critical">
                    {errors.upsellProducts}
                  </s-banner>
                )}
              </s-stack>
            </div>

            {/* Display Options */}
            <div style={{ padding: "20px", border: "1px solid #e0e0e0", borderRadius: "8px", backgroundColor: "#fff" }}>
              <s-stack direction="block" gap="base">
                <s-heading>Display Options</s-heading>
                <s-select
                  ref={layoutRef}
                  label="Layout"
                  data-field="layout"
                  value={form.layout}
                >
                  <s-option value="vertical">Vertical</s-option>
                  <s-option value="slider">Slider</s-option>
                </s-select>

                <s-switch
                  ref={showVariantsRef}
                  label="Show product variants"
                  checked={form.showVariants || undefined}
                />

                <s-switch
                  ref={showImageRef}
                  label="Show product image"
                  checked={form.showImage || undefined}
                />
              </s-stack>
            </div>

            {/* Design */}
            <div style={{ padding: "20px", border: "1px solid #e0e0e0", borderRadius: "8px", backgroundColor: "#fff" }}>
              <s-stack direction="block" gap="base">
                <s-heading>Design</s-heading>
                <s-text-field
                  label="Title text"
                  data-field="titleText"
                  value={form.titleText}
                />
                <s-text-field
                  label="Button text"
                  data-field="buttonText"
                  value={form.buttonText}
                />

                <s-stack direction="inline" gap="base">
                  <s-color-field
                    label="Button color"
                    data-field="buttonColor"
                    value={form.buttonColor}
                  />
                  <s-color-field
                    label="Background"
                    data-field="backgroundColor"
                    value={form.backgroundColor}
                  />
                  <s-color-field
                    label="Border"
                    data-field="borderColor"
                    value={form.borderColor}
                  />
                </s-stack>

                <s-stack direction="inline" gap="base">
                  <s-number-field
                    label="Title size"
                    data-field="titleSize"
                    value={String(form.titleSize)}
                    min={10}
                    max={48}
                  />
                  <s-number-field
                    label="Text size"
                    data-field="textSize"
                    value={String(form.textSize)}
                    min={10}
                    max={36}
                  />
                </s-stack>

                <s-stack direction="inline" gap="base">
                  <s-number-field
                    label="Button size"
                    data-field="buttonSize"
                    value={String(form.buttonSize)}
                    min={10}
                    max={36}
                  />
                  <s-number-field
                    label="Corner radius"
                    data-field="cornerRadius"
                    value={String(form.cornerRadius)}
                    min={0}
                    max={50}
                  />
                </s-stack>
              </s-stack>
            </div>
          </div>

          {/* ─── Right column: live preview ─── */}
          <div style={{ position: "sticky", top: "16px" }}>
            <UpsellPreview form={form} products={selectedProducts} />
          </div>
        </div>
      </s-page>
    </div>
  );
}

function ResourceItem({
  title,
  imageUrl,
  onRemove,
}: {
  title: string;
  imageUrl?: string;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 10px",
        border: "1px solid #e0e0e0",
        borderRadius: "8px",
        backgroundColor: "#fafafa",
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={title}
          style={{
            width: 40,
            height: 40,
            objectFit: "cover",
            borderRadius: 6,
            border: "1px solid #e0e0e0",
          }}
        />
      ) : (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 6,
            backgroundColor: "#e0e0e0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            color: "#888",
          }}
        >
          N/A
        </div>
      )}
      <span style={{ flex: 1, fontSize: "13px", fontWeight: 500 }}>
        {title}
      </span>
      <button
        type="button"
        onClick={onRemove}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "18px",
          color: "#888",
          padding: "2px 6px",
          borderRadius: 4,
          lineHeight: 1,
        }}
        aria-label={`Remove ${title}`}
      >
        &times;
      </button>
    </div>
  );
}
