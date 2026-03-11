# Technical Spec - SuperUpsell

## 1) Baseline atual (repositorio)

- App: Shopify React Router template
- UI: Polaris Web Components
- Auth/Admin API: `@shopify/shopify-app-react-router`
- DB atual: Prisma + SQLite (`prisma/schema.prisma`)
- Extensoes:
  - `extensions/discount-function` (Rust/WASM, exemplos de desconto)
  - `extensions/superupsell` (Theme extension com bloco de stars)

## 2) Estado alvo

Arquitetura modular com 5 blocos:

1. Admin App (React Router): paginas Home, 4 Editores, Analytics, Billing
2. API layer interna (actions/loaders): CRUD de ofertas, publicacao, metricas
3. Persistencia (Prisma + PostgreSQL): ofertas, regras, eventos, agregados
4. Storefront surfaces (Theme Extension + App Embed): render de widgets
5. Discount Engine (Shopify Function Rust): aplicacao de desconto por regra

## 3) Estrutura de rotas sugerida

- `/app` home
- `/app/upsells/product-page`
- `/app/upsells/popup`
- `/app/upsells/cart`
- `/app/upsells/checkout`
- `/app/analytics`
- `/app/billing`

## 4) Contratos internos (alto nivel)

- `GET /app/...` loaders retornam estado do editor + entidades relacionadas.
- `POST /app/...` actions para criar/atualizar/ativar oferta.
- `GET /app/analytics` retorna metricas agregadas por superficie e periodo.
- `POST /app/billing/subscribe` cria/valida assinatura.

## 5) Persistencia

- Migrar datasource Prisma de SQLite para PostgreSQL.
- Adicionar modelos de dominio de oferta e analytics (ver `DATA_MODEL_AND_EVENTS.md`).
- Indices em campos de busca frequente:
  - `shop`, `surface`, `isActive`
  - `createdAt` para agregacao temporal

## 6) Theme App Extension / App Embed

- Reaproveitar extension `superupsell` como base.
- Implementar blocos/snippets por superficie quando aplicavel.
- App embed deve consumir configuracao da oferta ativa por contexto.

## 7) Discount Function (Rust)

- Substituir logica de exemplo por regra baseada em oferta ativa.
- Parametros de desconto devem vir de configuracao persistida.
- Suportar mensagem customizada (`discount_label`) no resultado.

## 8) Billing

- Implementar fluxo de trial e assinatura mensal via Billing API.
- Persistir estado de assinatura por loja para gate de funcionalidade.

## 9) Riscos tecnicos

- Checkout surface pode exigir extensao especifica alem de theme/embed.
- Sincronismo entre config do editor e render do storefront.
- Confiabilidade de tracking de conversao em eventos assincronos.
