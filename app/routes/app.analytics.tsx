import { useEffect, useRef } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import type { Surface } from "@prisma/client";

const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

const SURFACE_OPTIONS = [
  { value: "all", label: "All surfaces" },
  { value: "product_page", label: "Product Page" },
  { value: "popup", label: "Popup" },
  { value: "cart", label: "Cart" },
];

function getStartDate(period: string): Date {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  if (period === "today") return now;
  if (period === "7d") {
    now.setUTCDate(now.getUTCDate() - 6);
    return now;
  }
  // 30d
  now.setUTCDate(now.getUTCDate() - 29);
  return now;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const period = url.searchParams.get("period") || "30d";
  const surfaceParam = url.searchParams.get("surface") || "all";

  const startDate = getStartDate(period);
  const surfaceFilter: Partial<{ surface: Surface }> =
    surfaceParam !== "all" ? { surface: surfaceParam as Surface } : {};

  // Totals
  const agg = await prisma.dailyMetric.aggregate({
    where: { shop: session.shop, day: { gte: startDate }, ...surfaceFilter },
    _sum: { impressions: true, clicks: true, addToCarts: true, conversions: true, revenue: true },
  });

  const impressions = agg._sum.impressions ?? 0;
  const clicks = agg._sum.clicks ?? 0;
  const addToCarts = agg._sum.addToCarts ?? 0;
  const conversions = agg._sum.conversions ?? 0;
  const revenue = Number(agg._sum.revenue ?? 0);
  const conversionRate =
    impressions > 0 ? ((conversions / impressions) * 100).toFixed(1) : "0.0";

  // Per-surface breakdown
  const bySurface = await prisma.dailyMetric.groupBy({
    by: ["surface"],
    where: { shop: session.shop, day: { gte: startDate }, ...surfaceFilter },
    _sum: { impressions: true, clicks: true, addToCarts: true, conversions: true, revenue: true },
  });

  const surfaceBreakdown = bySurface.map((row) => ({
    surface: row.surface,
    impressions: row._sum.impressions ?? 0,
    clicks: row._sum.clicks ?? 0,
    addToCarts: row._sum.addToCarts ?? 0,
    conversions: row._sum.conversions ?? 0,
    revenue: Number(row._sum.revenue ?? 0),
  }));

  // Daily trend (last N days)
  const dailyRows = await prisma.dailyMetric.findMany({
    where: { shop: session.shop, day: { gte: startDate }, ...surfaceFilter },
    orderBy: { day: "desc" },
    take: 60,
  });

  // Group by day (sum across surfaces)
  const dayMap = new Map<string, { impressions: number; clicks: number; addToCarts: number; conversions: number; revenue: number }>();
  for (const row of dailyRows) {
    const key = new Date(row.day).toISOString().split("T")[0];
    const existing = dayMap.get(key) || { impressions: 0, clicks: 0, addToCarts: 0, conversions: 0, revenue: 0 };
    existing.impressions += row.impressions;
    existing.clicks += row.clicks;
    existing.addToCarts += row.addToCarts;
    existing.conversions += row.conversions;
    existing.revenue += Number(row.revenue);
    dayMap.set(key, existing);
  }
  const dailyTrend = Array.from(dayMap.entries())
    .map(([day, data]) => ({ day, ...data }))
    .sort((a, b) => b.day.localeCompare(a.day));

  return {
    period,
    surface: surfaceParam,
    totals: { impressions, clicks, addToCarts, conversions, conversionRate, revenue },
    surfaceBreakdown,
    dailyTrend,
  };
};

const SURFACE_LABELS: Record<string, string> = {
  product_page: "Product Page",
  popup: "Popup",
  cart: "Cart",
};

const SURFACE_ICONS: Record<string, string> = {
  product_page: "product",
  popup: "maximize",
  cart: "cart",
} as const;

export default function Analytics() {
  const { period, surface, totals, surfaceBreakdown, dailyTrend } =
    useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const periodRef = useRef<any>(null);
  const surfaceRef = useRef<any>(null);
  const updateFilterRef = useRef((key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set(key, value);
    navigate(`?${params.toString()}`);
  });
  updateFilterRef.current = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set(key, value);
    navigate(`?${params.toString()}`);
  };

  useEffect(() => {
    const periodEl = periodRef.current;
    const surfaceEl = surfaceRef.current;
    if (periodEl) periodEl.value = period;
    if (surfaceEl) surfaceEl.value = surface;
  });

  useEffect(() => {
    const periodEl = periodRef.current;
    const surfaceEl = surfaceRef.current;

    const onPeriod = () => {
      requestAnimationFrame(() => {
        if (periodEl) updateFilterRef.current("period", periodEl.value);
      });
    };
    const onSurface = () => {
      requestAnimationFrame(() => {
        if (surfaceEl) updateFilterRef.current("surface", surfaceEl.value);
      });
    };

    periodEl?.addEventListener("change", onPeriod);
    surfaceEl?.addEventListener("change", onSurface);
    return () => {
      periodEl?.removeEventListener("change", onPeriod);
      surfaceEl?.removeEventListener("change", onSurface);
    };
  }, []);

  return (
    <s-page heading="Analytics">
      {/* Filters */}
      <s-box padding="large-200" border="base" border-radius="base">
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <s-select ref={periodRef} label="Period" value={period}>
            {PERIOD_OPTIONS.map((o) => (
              <s-option key={o.value} value={o.value}>
                {o.label}
              </s-option>
            ))}
          </s-select>

          <s-select ref={surfaceRef} label="Surface" value={surface}>
            {SURFACE_OPTIONS.map((o) => (
              <s-option key={o.value} value={o.value}>
                {o.label}
              </s-option>
            ))}
          </s-select>
        </s-grid>
      </s-box>

      {/* KPI Cards - Row 1 */}
      <s-section padding="base">
        <s-grid
          gridTemplateColumns="@container (inline-size <= 400px) 1fr, 1fr auto 1fr auto 1fr"
          gap="small"
        >
          <s-clickable paddingBlock="small-400" paddingInline="small-100" borderRadius="base">
            <s-grid gap="small-300">
              <s-stack direction="inline" gap="small-200" align-items="center">
                <s-icon type="view" color="subdued" size="small" />
                <s-heading>Impressions</s-heading>
              </s-stack>
              <s-text>{totals.impressions.toLocaleString()}</s-text>
            </s-grid>
          </s-clickable>
          <s-divider direction="block" />
          <s-clickable paddingBlock="small-400" paddingInline="small-100" borderRadius="base">
            <s-grid gap="small-300">
              <s-stack direction="inline" gap="small-200" align-items="center">
                <s-icon type="link" color="subdued" size="small" />
                <s-heading>Clicks</s-heading>
              </s-stack>
              <s-text>{totals.clicks.toLocaleString()}</s-text>
            </s-grid>
          </s-clickable>
          <s-divider direction="block" />
          <s-clickable paddingBlock="small-400" paddingInline="small-100" borderRadius="base">
            <s-grid gap="small-300">
              <s-stack direction="inline" gap="small-200" align-items="center">
                <s-icon type="cart" color="subdued" size="small" />
                <s-heading>Add to Cart</s-heading>
              </s-stack>
              <s-text>{totals.addToCarts.toLocaleString()}</s-text>
            </s-grid>
          </s-clickable>
        </s-grid>
      </s-section>

      {/* KPI Cards - Row 2 */}
      <s-section padding="base">
        <s-grid
          gridTemplateColumns="@container (inline-size <= 400px) 1fr, 1fr auto 1fr auto 1fr"
          gap="small"
        >
          <s-clickable paddingBlock="small-400" paddingInline="small-100" borderRadius="base">
            <s-grid gap="small-300">
              <s-stack direction="inline" gap="small-200" align-items="center">
                <s-icon type="order" color="subdued" size="small" />
                <s-heading>Orders</s-heading>
              </s-stack>
              <s-text>{totals.conversions.toLocaleString()}</s-text>
            </s-grid>
          </s-clickable>
          <s-divider direction="block" />
          <s-clickable paddingBlock="small-400" paddingInline="small-100" borderRadius="base">
            <s-grid gap="small-300">
              <s-stack direction="inline" gap="small-200" align-items="center">
                <s-icon type="arrow-up" tone="success" size="small" />
                <s-heading>Conv. Rate</s-heading>
              </s-stack>
              <s-stack direction="inline" gap="small-200">
                <s-text>{totals.conversionRate}%</s-text>
                {Number(totals.conversionRate) > 0 && (
                  <s-badge tone="success" icon="arrow-up">{totals.conversionRate}%</s-badge>
                )}
              </s-stack>
            </s-grid>
          </s-clickable>
          <s-divider direction="block" />
          <s-clickable paddingBlock="small-400" paddingInline="small-100" borderRadius="base">
            <s-grid gap="small-300">
              <s-stack direction="inline" gap="small-200" align-items="center">
                <s-icon type="money" color="subdued" size="small" />
                <s-heading>Revenue</s-heading>
              </s-stack>
              <s-text>${totals.revenue.toFixed(2)}</s-text>
            </s-grid>
          </s-clickable>
        </s-grid>
      </s-section>

      {/* Surface Breakdown */}
      {surfaceBreakdown.length > 0 && (
        <>
          <s-section heading="By surface">
            <s-table>
              <s-table-header-row>
                <s-table-header>Surface</s-table-header>
                <s-table-header>Impressions</s-table-header>
                <s-table-header>Clicks</s-table-header>
                <s-table-header>Add to Cart</s-table-header>
                <s-table-header>Orders</s-table-header>
                <s-table-header>Conv. Rate</s-table-header>
                <s-table-header>Revenue</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {surfaceBreakdown.map((row) => {
                  const rate =
                    row.impressions > 0
                      ? ((row.conversions / row.impressions) * 100).toFixed(1)
                      : "0.0";
                  return (
                    <s-table-row key={row.surface}>
                      <s-table-cell>
                        <s-badge icon={SURFACE_ICONS[row.surface] as any}>{SURFACE_LABELS[row.surface] || row.surface}</s-badge>
                      </s-table-cell>
                      <s-table-cell>{row.impressions.toLocaleString()}</s-table-cell>
                      <s-table-cell>{row.clicks.toLocaleString()}</s-table-cell>
                      <s-table-cell>{row.addToCarts.toLocaleString()}</s-table-cell>
                      <s-table-cell>{row.conversions.toLocaleString()}</s-table-cell>
                      <s-table-cell>{rate}%</s-table-cell>
                      <s-table-cell>${row.revenue.toFixed(2)}</s-table-cell>
                    </s-table-row>
                  );
                })}
              </s-table-body>
            </s-table>
          </s-section>
        </>
      )}

      {/* Daily Trend */}
      {dailyTrend.length > 0 && (
        <>
          <s-section heading="Daily trend">
            <s-table>
              <s-table-header-row>
                <s-table-header>Date</s-table-header>
                <s-table-header>Impressions</s-table-header>
                <s-table-header>Clicks</s-table-header>
                <s-table-header>Add to Cart</s-table-header>
                <s-table-header>Orders</s-table-header>
                <s-table-header>Conv. Rate</s-table-header>
                <s-table-header>Revenue</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {dailyTrend.map((row) => {
                  const rate =
                    row.impressions > 0
                      ? ((row.conversions / row.impressions) * 100).toFixed(1)
                      : "0.0";
                  return (
                    <s-table-row key={row.day}>
                      <s-table-cell>{row.day}</s-table-cell>
                      <s-table-cell>{row.impressions.toLocaleString()}</s-table-cell>
                      <s-table-cell>{row.clicks.toLocaleString()}</s-table-cell>
                      <s-table-cell>{row.addToCarts.toLocaleString()}</s-table-cell>
                      <s-table-cell>{row.conversions.toLocaleString()}</s-table-cell>
                      <s-table-cell>{rate}%</s-table-cell>
                      <s-table-cell>${row.revenue.toFixed(2)}</s-table-cell>
                    </s-table-row>
                  );
                })}
              </s-table-body>
            </s-table>
          </s-section>
        </>
      )}

      {/* Empty state */}
      {surfaceBreakdown.length === 0 && (
        <s-section accessibilityLabel="Empty analytics section">
          <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
            <s-grid justifyItems="center" maxInlineSize="450px" gap="base">
              <s-stack align-items="center" direction="block" gap="small-200">
                <s-icon type="view" color="subdued" />
                <s-heading>No data yet</s-heading>
                <s-paragraph color="subdued">
                  Analytics data will appear here once your upsell widgets start receiving traffic.
                </s-paragraph>
              </s-stack>
            </s-grid>
          </s-grid>
        </s-section>
      )}
    </s-page>
  );
}


