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
    _sum: { impressions: true, conversions: true, revenue: true },
  });

  const impressions = agg._sum.impressions ?? 0;
  const conversions = agg._sum.conversions ?? 0;
  const revenue = Number(agg._sum.revenue ?? 0);
  const conversionRate =
    impressions > 0 ? ((conversions / impressions) * 100).toFixed(1) : "0.0";

  // Per-surface breakdown
  const bySurface = await prisma.dailyMetric.groupBy({
    by: ["surface"],
    where: { shop: session.shop, day: { gte: startDate }, ...surfaceFilter },
    _sum: { impressions: true, conversions: true, revenue: true },
  });

  const surfaceBreakdown = bySurface.map((row) => ({
    surface: row.surface,
    impressions: row._sum.impressions ?? 0,
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
  const dayMap = new Map<string, { impressions: number; conversions: number; revenue: number }>();
  for (const row of dailyRows) {
    const key = new Date(row.day).toISOString().split("T")[0];
    const existing = dayMap.get(key) || { impressions: 0, conversions: 0, revenue: 0 };
    existing.impressions += row.impressions;
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
    totals: { impressions, conversions, conversionRate, revenue },
    surfaceBreakdown,
    dailyTrend,
  };
};

const SURFACE_LABELS: Record<string, string> = {
  product_page: "Product Page",
  popup: "Popup",
  cart: "Cart",
};

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
      <s-section>
        <s-stack direction="inline" gap="large-200" align-items="center">
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
        </s-stack>
      </s-section>

      {/* KPI Cards */}
      <s-grid gridTemplateColumns="1fr 1fr 1fr 1fr" gap="base">
        <KpiCard title="Impressions" value={totals.impressions.toLocaleString()} />
        <KpiCard title="Conversions" value={totals.conversions.toLocaleString()} />
        <KpiCard title="Conversion Rate" value={`${totals.conversionRate}%`} />
        <KpiCard title="Revenue" value={`$${totals.revenue.toFixed(2)}`} />
      </s-grid>

      {/* Surface Breakdown */}
      {surfaceBreakdown.length > 0 && (
        <s-section heading="By surface">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e0e0e0", textAlign: "left" }}>
                  <th style={{ padding: "8px 12px" }}>Surface</th>
                  <th style={{ padding: "8px 12px" }}>Impressions</th>
                  <th style={{ padding: "8px 12px" }}>Conversions</th>
                  <th style={{ padding: "8px 12px" }}>Conv. Rate</th>
                  <th style={{ padding: "8px 12px" }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {surfaceBreakdown.map((row) => {
                  const rate =
                    row.impressions > 0
                      ? ((row.conversions / row.impressions) * 100).toFixed(1)
                      : "0.0";
                  return (
                    <tr key={row.surface} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "8px 12px" }}>
                        {SURFACE_LABELS[row.surface] || row.surface}
                      </td>
                      <td style={{ padding: "8px 12px" }}>{row.impressions.toLocaleString()}</td>
                      <td style={{ padding: "8px 12px" }}>{row.conversions.toLocaleString()}</td>
                      <td style={{ padding: "8px 12px" }}>{rate}%</td>
                      <td style={{ padding: "8px 12px" }}>${row.revenue.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </s-box>
        </s-section>
      )}

      {/* Daily Trend */}
      {dailyTrend.length > 0 && (
        <s-section heading="Daily trend">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e0e0e0", textAlign: "left" }}>
                  <th style={{ padding: "8px 12px" }}>Date</th>
                  <th style={{ padding: "8px 12px" }}>Impressions</th>
                  <th style={{ padding: "8px 12px" }}>Conversions</th>
                  <th style={{ padding: "8px 12px" }}>Conv. Rate</th>
                  <th style={{ padding: "8px 12px" }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {dailyTrend.map((row) => {
                  const rate =
                    row.impressions > 0
                      ? ((row.conversions / row.impressions) * 100).toFixed(1)
                      : "0.0";
                  return (
                    <tr key={row.day} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "8px 12px" }}>{row.day}</td>
                      <td style={{ padding: "8px 12px" }}>{row.impressions.toLocaleString()}</td>
                      <td style={{ padding: "8px 12px" }}>{row.conversions.toLocaleString()}</td>
                      <td style={{ padding: "8px 12px" }}>{rate}%</td>
                      <td style={{ padding: "8px 12px" }}>${row.revenue.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </s-box>
        </s-section>
      )}

      {/* Empty state */}
      {surfaceBreakdown.length === 0 && (
        <s-section>
          <s-box padding="large-400" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="base" align-items="center">
              <s-heading>No data yet</s-heading>
              <s-paragraph>
                Analytics data will appear here once your upsell widgets start receiving traffic.
              </s-paragraph>
            </s-stack>
          </s-box>
        </s-section>
      )}
    </s-page>
  );
}

function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <s-box padding="large-300" borderWidth="base" borderRadius="base">
      <s-stack direction="block" gap="small-200">
        <s-text tone="neutral">
          {title}
        </s-text>
        <s-heading>{value}</s-heading>
      </s-stack>
    </s-box>
  );
}
