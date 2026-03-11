# Data Model and Events - SuperUpsell

## 1) Modelagem proposta (Prisma)

### UpsellOffer

- `id` (string, pk)
- `shop` (string, index)
- `surface` (enum)
- `upsellName` (string)
- `discountLabel` (string)
- `isActive` (boolean)
- `targetMode` (enum)
- `discountPercentage` (decimal)
- `showVariants` (boolean)
- `showImage` (boolean)
- `layout` (enum)
- `titleText` (string)
- `buttonText` (string)
- `buttonColor` (string)
- `backgroundColor` (string)
- `borderColor` (string)
- `titleSize` (int)
- `textSize` (int)
- `buttonSize` (int)
- `cornerRadius` (int)
- `createdAt`, `updatedAt`

### UpsellOfferTarget

- `id` (string, pk)
- `offerId` (fk -> UpsellOffer)
- `targetType` (collection | product)
- `targetId` (string)

### UpsellOfferProduct

- `id` (string, pk)
- `offerId` (fk -> UpsellOffer)
- `productId` (string)
- `variantIds` (json/string opcional)
- `position` (int)

### AnalyticsEvent

- `id` (string, pk)
- `shop` (string, index)
- `offerId` (fk opcional)
- `surface` (enum)
- `eventType` (impression | conversion | revenue)
- `amount` (decimal opcional)
- `currency` (string opcional)
- `metadata` (json opcional)
- `createdAt` (index)

### DailyMetric

- `id` (string, pk)
- `shop` (string, index)
- `surface` (enum)
- `day` (date, index)
- `impressions` (int)
- `conversions` (int)
- `revenue` (decimal)

### BillingSubscription

- `id` (string, pk)
- `shop` (string, unique)
- `planCode` (string)
- `status` (trialing | active | canceled | past_due)
- `trialEndsAt` (datetime)
- `currentPeriodEndsAt` (datetime opcional)
- `shopifyChargeId` (string opcional)
- `createdAt`, `updatedAt`

## 2) Eventos minimos para analytics

- `upsell_impression`
- `upsell_click`
- `upsell_conversion`
- `upsell_revenue`

## 3) Derivacoes

- `conversion_rate = conversions / impressions` (se impressions > 0)
- `total_revenue = soma(revenue)` no periodo

## 4) Regras de qualidade de dados

- Nao registrar evento sem `shop`.
- `upsell_revenue` exige `amount > 0`.
- Eventos duplicados devem ser deduplicados por chave idempotente quando aplicavel.
