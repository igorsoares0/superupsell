import type { CSSProperties } from "react";

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
  { productId: "p1", title: "Classic Sneakers" },
  { productId: "p2", title: "Running Shoes" },
];

const MOCK_PRICE = 49.99;

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
  const discountedPrice =
    MOCK_PRICE * (1 - form.discountPercentage / 100);
  const buttonTextColor = getContrastColor(form.buttonColor || "#000000");

  const container: CSSProperties = {
    backgroundColor: form.backgroundColor,
    border: `1px solid ${form.borderColor}`,
    borderRadius: `${form.cornerRadius}px`,
    padding: "20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  };

  const title: CSSProperties = {
    fontSize: `${form.titleSize}px`,
    fontWeight: 600,
    marginBottom: "16px",
    color: "#1a1a1a",
  };

  const productList: CSSProperties = {
    display: form.layout === "slider" ? "flex" : "flex",
    flexDirection: form.layout === "slider" ? "row" : "column",
    gap: "12px",
    overflowX: form.layout === "slider" ? "auto" : undefined,
  };

  const productCard: CSSProperties = {
    flex: form.layout === "slider" ? "0 0 160px" : undefined,
    border: `1px solid ${form.borderColor}`,
    borderRadius: `${Math.max(form.cornerRadius - 2, 0)}px`,
    padding: "12px",
    backgroundColor: "#ffffff",
  };

  const imagePlaceholder: CSSProperties = {
    width: "100%",
    height: form.layout === "slider" ? "100px" : "120px",
    backgroundColor: "#f0f0f0",
    borderRadius: `${Math.max(form.cornerRadius - 4, 0)}px`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#999",
    fontSize: "12px",
    marginBottom: "8px",
  };

  const productName: CSSProperties = {
    fontSize: `${form.textSize}px`,
    fontWeight: 500,
    color: "#333",
    marginBottom: "4px",
  };

  const priceRow: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "8px",
    fontSize: `${Math.max(form.textSize - 2, 10)}px`,
  };

  const btn: CSSProperties = {
    backgroundColor: form.buttonColor,
    color: buttonTextColor,
    border: "none",
    borderRadius: `${Math.max(form.cornerRadius - 4, 2)}px`,
    padding: "8px 16px",
    fontSize: `${form.buttonSize}px`,
    fontWeight: 500,
    cursor: "pointer",
    width: "100%",
    textAlign: "center",
  };

  const variantRow: CSSProperties = {
    display: "flex",
    gap: "4px",
    marginBottom: "8px",
  };

  const variantChip: CSSProperties = {
    fontSize: "11px",
    padding: "2px 8px",
    border: "1px solid #ccc",
    borderRadius: "12px",
    color: "#666",
  };

  const discountBadge: CSSProperties = {
    display: "inline-block",
    backgroundColor: "#e53e3e",
    color: "#fff",
    fontSize: "11px",
    fontWeight: 600,
    padding: "2px 6px",
    borderRadius: "4px",
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
        <div style={container}>
          <div style={title}>{form.titleText || "You may also like"}</div>

          {form.discountLabel && form.discountPercentage > 0 && (
            <div style={{ marginBottom: "12px" }}>
              <span style={discountBadge}>
                {form.discountLabel} — {form.discountPercentage}% off
              </span>
            </div>
          )}

          <div style={productList}>
            {items.map((p) => (
              <div key={p.productId} style={productCard}>
                {form.showImage && (
                  <div style={imagePlaceholder}>
                    <svg
                      width="32"
                      height="32"
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
                <div style={productName}>
                  {p.title || "Product"}
                </div>
                {form.showVariants && (
                  <div style={variantRow}>
                    <span style={variantChip}>S</span>
                    <span style={variantChip}>M</span>
                    <span style={variantChip}>L</span>
                  </div>
                )}
                <div style={priceRow}>
                  <span
                    style={{
                      textDecoration: "line-through",
                      color: "#999",
                    }}
                  >
                    ${MOCK_PRICE.toFixed(2)}
                  </span>
                  <span style={{ fontWeight: 600, color: "#1a1a1a" }}>
                    ${discountedPrice.toFixed(2)}
                  </span>
                </div>
                <div style={btn}>
                  {form.buttonText || "Add to cart"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
