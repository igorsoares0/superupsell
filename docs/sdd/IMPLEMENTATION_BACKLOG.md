# Implementation Backlog - SuperUpsell

Backlog orientado a entregas incrementais para execucao com IA.

## Fase 1 - Fundacao

### BL-001 Navegacao e rotas base

- Criar paginas: Home, 4 editores, Analytics, Billing.
- Atualizar nav do app.

### BL-002 Migracao para PostgreSQL

- Ajustar Prisma datasource.
- Criar migracoes iniciais.

### BL-003 Modelos de dominio

- Implementar modelos de oferta, alvo, produtos, analytics e billing.

## Fase 2 - Core de upsell

### BL-010 CRUD de oferta por superficie

- Loaders/actions para criar, editar e ativar/desativar.

### BL-011 Editor com preview em tempo real

- Componente de formulario + preview sincronizado.

### BL-012 Render storefront

- Evoluir Theme Extension/App Embed para renderizar oferta real.

## Fase 3 - Desconto e checkout

### BL-020 Discount Function produtiva

- Trocar exemplo por logica baseada em oferta ativa e alvo.

### BL-021 Integracao cart/checkout

- Garantir aplicacao e mensageria do desconto no fluxo de compra.

## Fase 4 - Analytics e Billing

### BL-030 Tracking de eventos

- Instrumentar eventos de impressao, clique, conversao e receita.

### BL-031 Dashboard de analytics

- Agregar e exibir metricas principais.

### BL-032 Billing API

- Implementar trial e assinatura mensal.

## Fase 5 - Hardening

### BL-040 Testes e robustez

- Cobrir cenarios criticos e limites de validacao.

### BL-041 Performance e observabilidade

- Melhorar latencia de editor e tracking de erros.

## Dependencias chave

- BL-002 antes de BL-010
- BL-003 antes de BL-010
- BL-020 depende de BL-010
- BL-031 depende de BL-030
- BL-032 pode rodar em paralelo com BL-030
