# Functional Spec - SuperUpsell

## Convencao

- FR = Functional Requirement
- NFR = Non-Functional Requirement

## FR-001 Home

- Exibir 4 cards: Produto, Popup, Carrinho, Checkout.
- Cada card navega para editor da superficie.

## FR-010 Modelo de oferta (comum as 4 superficies)

Campos obrigatorios:

- `surface` (product_page | popup | cart | checkout)
- `target_mode` (all_products | collections | specific_products)
- `upsell_name`
- `discount_label`
- `is_active`
- `discount_percentage`
- `show_variants`
- `show_image`
- `layout` (vertical | slider)
- `title_text`
- `button_text`
- `button_color`
- `background_color`
- `border_color`
- `title_size`
- `text_size`
- `button_size`
- `corner_radius`
- Lista de produtos de upsell

## FR-020 Regras de alvo

- `all_products`: aplica em todos os produtos.
- `collections`: requer ao menos 1 colecao selecionada.
- `specific_products`: requer ao menos 1 produto selecionado.

## FR-030 Regras de desconto

- `discount_percentage` deve ser > 0 e <= 100.
- `discount_label` e usado para mensagem no cart/checkout.
- Desconto aplicado por Shopify Discount Function em Rust.

## FR-040 Comportamento de edicao

- Layout da pagina:
  - Coluna esquerda: formulario de configuracao
  - Coluna direita: preview em tempo real
- Mudanca em qualquer campo deve refletir no preview sem reload.

## FR-050 Ativacao/desativacao

- Oferta ativa: elegivel para renderizacao e aplicacao de desconto.
- Oferta inativa: ignorada em renderizacao e motor de desconto.

## FR-060 Surface: Product Page

- Renderizar oferta via Theme App Extension/App Embed em pagina de produto.

## FR-070 Surface: Popup

- Renderizar oferta em formato popup no storefront.

## FR-080 Surface: Cart

- Renderizar oferta no carrinho.

## FR-090 Surface: Checkout

- Disponibilizar experiencia de upsell no checkout respeitando limites da plataforma Shopify.
- Se houver limitacao tecnica, degradar para aplicacao de desconto e mensageria no checkout.

## FR-100 Analytics

- Dashboard com:
  - impressoes
  - conversoes
  - taxa de conversao
  - receita total
- Metricas filtraveis por superficie e periodo (minimo: hoje, 7 dias, 30 dias).

## FR-110 Billing

- Integrar Billing API Shopify.
- Trial de 14 dias.
- Apos trial: USD 12.99 por mes.
- Bloquear funcionalidades premium apos cancelamento (conforme politica definida).

## NFR-001 Persistencia

- Banco principal: PostgreSQL.

## NFR-002 Performance

- Preview deve responder em tempo percebido como imediato.
- Render de widget nao deve bloquear carregamento principal da pagina.

## NFR-003 Observabilidade

- Eventos criticos devem ter logs e trilha de erro visivel.
