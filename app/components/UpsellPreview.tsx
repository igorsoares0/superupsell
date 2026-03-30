import { useState, type CSSProperties } from "react";

type UpsellProduct = {
  productId: string;
  title?: string;
  imageUrl?: string;
  price?: number;
  variantIds?: string[];
};

type FormState = {
  titleText: string;
  buttonText: string;
  buttonColor: string;
  buttonTextColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  cardBackgroundColor: string;
  discountBgColor: string;
  discountTextColor: string;
  titleSize: number;
  textSize: number;
  buttonSize: number;
  cornerRadius: number;
  discountPercentage: number;
  discountLabel: string;
  showVariants: boolean;
  showImage: boolean;
  layout: string;
  cardMode: string;
  showButton: boolean;
  bundleWithMainProduct: boolean;
};

type Props = {
  form: FormState;
  products: UpsellProduct[];
};

const PLACEHOLDER_PRODUCTS: UpsellProduct[] = [
  { productId: "p1", title: "White cap", price: 29.99 },
  { productId: "p2", title: "Running Shoes", price: 59.99 },
];

export function UpsellPreview({ form, products }: Props) {
  const items = products.length > 0 ? products : PLACEHOLDER_PRODUCTS;
  const buttonTextColor = form.buttonTextColor || "#FFFFFF";
  const textColor = form.textColor || "#1A1A1A";
  const radius = form.cornerRadius;
  const isCheckbox = form.cardMode === "checkbox";

  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(items.map((p) => p.productId)),
  );

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const btnStyle: CSSProperties = {
    backgroundColor: form.buttonColor,
    color: buttonTextColor,
    border: "none",
    borderRadius: `${Math.max(radius - 4, 4)}px`,
    padding: "10px 20px",
    fontSize: `${form.buttonSize}px`,
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
    textAlign: "center",
    marginTop: "12px",
    boxSizing: "border-box",
  };

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
              color: textColor,
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
                  backgroundColor: form.discountBgColor || "#e53e3e",
                  color: form.discountTextColor || "#fff",
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
              buttonTextColor={buttonTextColor}
              textColor={textColor}
              isCheckbox={isCheckbox}
              checked={checked}
              onToggle={toggleCheck}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {items.map((p) => (
                <ProductCard
                  key={p.productId}
                  product={p}
                  form={form}
                  radius={radius}
                  buttonTextColor={buttonTextColor}
                  textColor={textColor}
                  isCheckbox={isCheckbox}
                  isChecked={checked.has(p.productId)}
                  onToggle={() => toggleCheck(p.productId)}
                />
              ))}
            </div>
          )}

          {/* Single button for checkbox mode */}
          {isCheckbox && form.showButton && (
            <div style={btnStyle}>
              {form.buttonText || "Add to cart"} ({checked.size})
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
  buttonTextColor,
  textColor,
  isCheckbox,
  checked,
  onToggle,
}: {
  items: UpsellProduct[];
  form: FormState;
  radius: number;
  buttonTextColor: string;
  textColor: string;
  isCheckbox: boolean;
  checked: Set<string>;
  onToggle: (id: string) => void;
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
        buttonTextColor={buttonTextColor}
        textColor={textColor}
        isCheckbox={isCheckbox}
        isChecked={checked.has(items[index].productId)}
        onToggle={() => onToggle(items[index].productId)}
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
  buttonTextColor,
  textColor,
  isCheckbox,
  isChecked,
  onToggle,
}: {
  product: UpsellProduct;
  form: FormState;
  radius: number;
  buttonTextColor: string;
  textColor: string;
  isCheckbox: boolean;
  isChecked: boolean;
  onToggle: () => void;
}) {
  const cardRadius = Math.max(radius - 2, 0);
  const imgRadius = Math.max(cardRadius - 2, 0);
  const originalPrice = product.price ?? 30.0;
  const discountedPrice = originalPrice * (1 - form.discountPercentage / 100);

  const card: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    border: `1px solid ${isCheckbox && isChecked ? form.buttonColor : form.borderColor}`,
    borderRadius: `${cardRadius}px`,
    padding: "10px 12px",
    backgroundColor: form.cardBackgroundColor || "#ffffff",
    cursor: isCheckbox ? "pointer" : undefined,
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
    <div style={card} onClick={isCheckbox ? onToggle : undefined}>
      {/* Checkbox */}
      {isCheckbox && (
        <div
          style={{
            width: "18px",
            height: "18px",
            minWidth: "18px",
            borderRadius: "4px",
            border: `2px solid ${isChecked ? form.buttonColor : "#ccc"}`,
            backgroundColor: isChecked ? form.buttonColor : "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isChecked && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6l2.5 2.5 4.5-5" stroke={buttonTextColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      )}

      {/* Image */}
      {form.showImage && (
        product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.title || "Product"}
            style={{
              width: 64,
              height: 64,
              minWidth: 64,
              objectFit: "contain",
              borderRadius: `${imgRadius}px`,
            }}
          />
        ) : (
          <div
            style={{
              width: "64px",
              height: "64px",
              minWidth: "64px",
              backgroundColor: "#f5f5f5",
              borderRadius: `${imgRadius}px`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
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
        )
      )}

      {/* Center: name, price, variant */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: `${form.textSize}px`,
            fontWeight: 500,
            color: textColor,
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
          <span style={{ fontWeight: 600, color: textColor }}>
            ${discountedPrice.toFixed(2)}
          </span>
          {form.discountPercentage > 0 && (
            <span
              style={{
                textDecoration: "line-through",
                color: "#999",
                fontSize: `${Math.max(form.textSize - 2, 10)}px`,
              }}
            >
              ${originalPrice.toFixed(2)}
            </span>
          )}
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

      {/* Right: add button (only in button mode) */}
      {!isCheckbox && (
        <div style={btn}>
          <span style={{ lineHeight: 1 }}>+</span>
          {form.buttonText || "Add"}
        </div>
      )}
    </div>
  );
}
