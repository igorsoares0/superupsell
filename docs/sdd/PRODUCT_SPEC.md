# Product Spec - SuperUpsell

## 1) Problema

Lojas Shopify precisam aumentar ticket medio e taxa de conversao com ofertas de upsell/cross-sell contextualizadas em varios pontos da jornada de compra.

## 2) Visao do produto

SuperUpsell permite criar ofertas em quatro superficies:

1. Pagina de produto
2. Popup
3. Carrinho
4. Checkout

Cada superficie compartilha o mesmo editor base de regra, desconto e design, com preview em tempo real.

## 3) Objetivos

- Permitir criacao rapida de ofertas por superficie.
- Aplicar desconto consistente no cart/checkout via Shopify Function (Rust).
- Medir desempenho com analytics de impressao, conversao e receita.
- Monetizar via Billing API da Shopify (14 dias trial, depois USD 12.99/mes).

## 4) Escopo in

- Home com 4 cards de navegacao para os editores.
- Editor de upsell para as 4 superficies com configuracoes:
  - Selecao de alvo: todos, colecoes especificas, produtos especificos
  - Nome do upsell
  - Nome do desconto exibido no cart/checkout
  - Ativar/desativar
  - Produtos do upsell
  - Mostrar variantes (sim/nao)
  - Percentual de desconto
  - Design (layout, titulo, texto botao, cores, tamanhos, corner radius, imagem)
  - Preview ao vivo (config esquerda, preview direita)
- Analytics page com: impressoes, conversoes, taxa de conversao, receita total
- Billing page com plano unico
- Uso de Theme App Extension + App Embed (widget)
- Uso de Shopify Discount Function em Rust
- Persistencia principal em PostgreSQL

## 5) Escopo out (nesta versao)

- Experimentos A/B nativos
- Motor de recomendacao por IA
- Multi-plano de assinatura
- Segmentacao por audiencia avancada (alem de produto/colecao)

## 6) Regras de negocio macro

- Oferta pode existir em rascunho, ativa ou inativa.
- Oferta inativa nunca deve renderizar no storefront.
- Percentual de desconto deve respeitar limites configurados (ver FR em `FUNCTIONAL_SPEC.md`).
- Eventos de analytics devem ser rastreados por superficie.

## 7) Open questions

- "Upsell no checkout" sera entregue via qual superficie tecnica (checkout extension, app embed suportado, ou apenas regra de desconto)?  
- Preco em multipla moeda: calcular receita em moeda da loja ou normalizar?
- Limite de quantidade de ofertas ativas por superficie?
