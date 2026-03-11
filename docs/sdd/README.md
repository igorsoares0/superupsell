# SuperUpsell Spec-Driven Development (SDD)

Este diretorio contem a base de especificacao para desenvolver o app com IA (Claude Code) sem perder consistencia entre produto, arquitetura e testes.

## Objetivo

Transformar `upsell reqs.md` em um conjunto executavel de specs:

- O que construir (produto e comportamento)
- Como construir (arquitetura e contratos)
- Como validar (aceite e testes)
- Em que ordem construir (backlog por fases)

## Ordem de leitura recomendada

1. `PRODUCT_SPEC.md`
2. `FUNCTIONAL_SPEC.md`
3. `TECHNICAL_SPEC.md`
4. `DATA_MODEL_AND_EVENTS.md`
5. `ACCEPTANCE_TEST_PLAN.md`
6. `IMPLEMENTATION_BACKLOG.md`
7. `CLAUDE_CODE_PLAYBOOK.md`

## Estado atual vs estado alvo

- Estado atual: template Shopify React Router com exemplos (home, pagina adicional), theme extension simples (stars) e discount function de exemplo.
- Estado alvo: produto SuperUpsell completo com 4 superficies de upsell, analytics, billing Shopify e persistencia em PostgreSQL.

## Regras de trabalho SDD

- Nenhum codigo novo sem referencia clara a um requisito (ID FR-xxx ou NFR-xxx).
- Toda entrega deve incluir criterio de aceite e cobertura de teste.
- Mudancas de escopo devem atualizar primeiro as specs e depois o codigo.
- Quando houver ambiguidade da plataforma Shopify, registrar em "Open Questions" e bloquear implementacao dependente.

## Definition of Done por feature

- Requisito funcional implementado e testado.
- Criterios de aceite da feature validados.
- Instrumentacao de analytics aplicada.
- Documentacao tecnica atualizada se houver mudanca de contrato.
