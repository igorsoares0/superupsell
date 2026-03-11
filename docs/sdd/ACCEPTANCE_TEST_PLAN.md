# Acceptance and Test Plan - SuperUpsell

## 1) Criterios de aceite por modulo

## AC-001 Home

- Dado que o usuario abre `/app`, quando carregar a pagina, entao deve ver 4 cards de superficies de upsell.

## AC-010 Editor (comum)

- Dado que o usuario edita campos de configuracao, quando alterar qualquer campo, entao o preview deve refletir imediatamente.
- Dado `target_mode = collections`, quando salvar sem colecao, entao deve apresentar erro de validacao.
- Dado `discount_percentage` invalido, quando salvar, entao deve bloquear persistencia e exibir erro.

## AC-020 Ativacao

- Dado uma oferta ativa, quando storefront carregar contexto elegivel, entao o widget deve renderizar.
- Dado uma oferta inativa, quando storefront carregar, entao widget nao deve renderizar.

## AC-030 Discount Function

- Dado oferta ativa com desconto, quando condicao de alvo for atendida, entao desconto deve ser aplicado.
- Mensagem de desconto no checkout/cart deve usar `discount_label`.

## AC-040 Analytics

- Dado eventos de impressao e conversao, quando abrir pagina de analytics, entao metricas devem bater com agregados persistidos.

## AC-050 Billing

- Dado loja nova, quando instalar app, entao trial de 14 dias deve iniciar.
- Dado trial expirado sem pagamento, quando acessar funcionalidade premium, entao app deve bloquear conforme regra.

## 2) Estrategia de teste

- Unitarios:
  - validacoes de formulario
  - mapeamento de regras de alvo
  - calculos de metricas
- Integracao:
  - loaders/actions + banco
  - fluxo de assinatura billing
- Funcao Rust:
  - testes de entrada/saida por cenario
- E2E:
  - criacao de oferta ate visualizacao no storefront
  - ciclo trial -> assinatura

## 3) Test matrix (minimo)

- Surface x estado (ativa/inativa)
- Target mode x validade de selecao
- Discount % limites (1, 100, fora do range)
- Com/sem variantes
- Com/sem imagem

## 4) Quality gates

- Todos os criterios AC-xxx relevantes da entrega aprovados.
- Sem erro de typecheck/lint no codigo alterado.
- Testes existentes impactados executados com sucesso.
