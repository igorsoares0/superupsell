import { useState, type CSSProperties } from "react";

type UpsellProduct = {
  productId: string;
  title?: string;
  variantIds?: string[];
};

type FormState = {
  titleText: string;
  buttonText: string;
  buttonColor: string;
  backgroundColor: string;
  borderColor: string;
  titleSize: number;
  textSize: number;
  buttonSize: number;
  cornerRadius: number;
  discountPercentage: number;
  discountLabel: string;
  showVariants: boolean;
  showImage: boolean;
  layout: string;
};

type Props = {
  form: FormState;
  products: UpsellProduct[];
};

const PLACEHOLDER_PRODUCTS: UpsellProduct[] = [
  { productId: "p1", title: "White cap" },
  { productId: "p2", title: "Running Shoes" },
];

const MOCK_PRICE = 30.0;

function getContrastColor(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000000" : "#FFFFFF";
  } catch {
    return "#FFFFFF";
  }
}

export function UpsellPreview({ form, products }: Props) {
  const items = products.length > 0 ? products : PLACEHOLDER_PRODUCTS;
  const discountedPrice = MOCK_PRICE * (1 - form.discountPercentage / 100);
  const buttonTextColor = getContrastColor(form.buttonColor || "#000000");
  const radius = form.cornerRadius;

  return (
    <div>
      <div
        style={{
          padding: "12px 16px",
          backgroundColor: "#f6f6f7",
          borderRadius: "8px 8px 0 0",
          borderBottom: "1px solid #e1e3e5",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: "13px", color: "#6d7175" }}>
          LIVE PREVIEW
        </span>
      </div>
      <div
        style={{
          padding: "24px",
          backgroundColor: "#fafafa",
          borderRadius: "0 0 8px 8px",
          border: "1px solid #e1e3e5",
          borderTop: "none",
        }}
      >
        {/* Container */}
        <div
          style={{
            backgroundColor: form.backgroundColor,
            border: `1px solid ${form.borderColor}`,
            borderRadius: `${radius}px`,
            padding: "16px",
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          {/* Title */}
          <div
            style={{
              fontSize: `${form.titleSize}px`,
              fontWeight: 600,
              color: "#1a1a1a",
              marginBottom: "12px",
            }}
          >
            {form.titleText || "You may also like"}
          </div>

          {/* Discount badge */}
          {form.discountLabel && form.discountPercentage > 0 && (
            <div style={{ marginBottom: "12px" }}>
              <span
                style={{
                  display: "inline-block",
                  backgroundColor: "#e53e3e",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                }}
              >
                {form.discountLabel} — {form.discountPercentage}% off
              </span>
            </div>
          )}

          {/* Product list */}
          {form.layout === "slider" ? (
            <SliderContainer
              items={items}
              form={form}
              radius={radius}
              mockPrice={MOCK_PRICE}
              discountedPrice={discountedPrice}
              buttonTextColor={buttonTextColor}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {items.map((p) => (
                <ProductCard
                  key={p.productId}
                  product={p}
                  form={form}
                  radius={radius}
                  mockPrice={MOCK_PRICE}
                  discountedPrice={discountedPrice}
                  buttonTextColor={buttonTextColor}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SliderContainer({
  items,
  form,
  radius,
  mockPrice,
  discountedPrice,
  buttonTextColor,
}: {
  items: UpsellProduct[];
  form: FormState;
  radius: number;
  mockPrice: number;
  discountedPrice: number;
  buttonTextColor: string;
}) {
  const [index, setIndex] = useState(0);
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  return (
    <div style={{ position: "relative" }}>
      {hasPrev && (
        <ArrowButton direction="left" onClick={() => setIndex(index - 1)} />
      )}
      <ProductCard
        key={items[index].productId}
        product={items[index]}
        form={form}
        radius={radius}
        mockPrice={mockPrice}
        discountedPrice={discountedPrice}
        buttonTextColor={buttonTextColor}
      />
      {hasNext && (
        <ArrowButton direction="right" onClick={() => setIndex(index + 1)} />
      )}
      {items.length > 1 && (
        <div style={{ textAlign: "center", marginTop: "8px", fontSize: "12px", color: "#888" }}>
          {index + 1} / {items.length}
        </div>
      )}
    </div>
  );
}

function ArrowButton({
  direction,
  onClick,
}: {
  direction: "left" | "right";
  onClick: () => void;
}) {
  const isLeft = direction === "left";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: "absolute",
        top: "50%",
        [isLeft ? "left" : "right"]: "-12px",
        transform: "translateY(-50%)",
        zIndex: 2,
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        border: "1px solid #ddd",
        backgroundColor: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "16px",
        color: "#333",
        padding: 0,
      }}
      aria-label={isLeft ? "Previous" : "Next"}
    >
      {isLeft ? "‹" : "›"}
    </button>
  );
}

function ProductCard({
  product,
  form,
  radius,
  mockPrice,
  discountedPrice,
  buttonTextColor,
}: {
  product: UpsellProduct;
  form: FormState;
  radius: number;
  mockPrice: number;
  discountedPrice: number;
  buttonTextColor: string;
}) {
  const cardRadius = Math.max(radius - 2, 0);

  const card: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    border: `1px solid ${form.borderColor}`,
    borderRadius: `${cardRadius}px`,
    padding: "10px 12px",
    backgroundColor: "#ffffff",
  };

  const imgBox: CSSProperties = {
    width: "64px",
    height: "64px",
    minWidth: "64px",
    backgroundColor: "#f5f5f5",
    borderRadius: `${Math.max(cardRadius - 2, 0)}px`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  };

  const btn: CSSProperties = {
    backgroundColor: form.buttonColor,
    color: buttonTextColor,
    border: "none",
    borderRadius: `${Math.max(cardRadius - 2, 2)}px`,
    padding: "6px 12px",
    fontSize: `${form.buttonSize}px`,
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    flexShrink: 0,
  };

  return (
    <div style={card}>
      {/* Left: image */}
      {form.showImage && (
        <div style={imgBox}>
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ccc"
            strokeWidth="1.5"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>
      )}

      {/* Center: name, price, variant */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: `${form.textSize}px`,
            fontWeight: 500,
            color: "#1a1a1a",
            marginBottom: "2px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {product.title || "Product"}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: `${Math.max(form.textSize - 1, 10)}px`,
            marginBottom: form.showVariants ? "6px" : 0,
          }}
        >
          <span style={{ fontWeight: 600, color: "#1a1a1a" }}>
            ${discountedPrice.toFixed(2)}
          </span>
          <span
            style={{
              textDecoration: "line-through",
              color: "#999",
              fontSize: `${Math.max(form.textSize - 2, 10)}px`,
            }}
          >
            ${mockPrice.toFixed(2)}
          </span>
        </div>

        {/* Variant selector */}
        {form.showVariants && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              border: "1px solid #ccc",
              borderRadius: "4px",
              padding: "3px 8px",
              fontSize: "12px",
              color: "#666",
              gap: "4px",
            }}
          >
            <span style={{ color: "#999" }}>▾</span>
          </div>
        )}
      </div>

      {/* Right: add button */}
      <div style={btn}>
        <span style={{ lineHeight: 1 }}>+</span>
        {form.buttonText || "Add"}
      </div>
    </div>
  );
}
