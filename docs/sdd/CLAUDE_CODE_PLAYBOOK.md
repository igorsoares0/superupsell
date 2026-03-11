# Claude Code Playbook - Spec-Driven Development

Guia pratico para executar o SuperUpsell em modo SDD usando Claude Code.

## 1) Regra principal

Sempre comecar pelas specs em `docs/sdd/`.  
Claude so implementa codigo quando houver referencia explicita a requisitos (FR/AC/BL).

## 2) Fluxo recomendado por ciclo

1. Ler specs relevantes (produto + funcional + tecnico + aceite).
2. Gerar plano tecnico da entrega atual.
3. Implementar em pequenos lotes.
4. Rodar typecheck/lint/testes impactados.
5. Validar criterios AC-xxx da entrega.
6. Atualizar docs se contrato mudou.

## 3) Prompt base para iniciar uma entrega

```text
Voce esta implementando o projeto SuperUpsell.
Use Spec-Driven Development.

Fontes obrigatorias:
- docs/sdd/PRODUCT_SPEC.md
- docs/sdd/FUNCTIONAL_SPEC.md
- docs/sdd/TECHNICAL_SPEC.md
- docs/sdd/ACCEPTANCE_TEST_PLAN.md
- docs/sdd/IMPLEMENTATION_BACKLOG.md

Escopo desta entrega:
- IDs: [BL-xxx, FR-xxx, AC-xxx]

Regras:
1) Nao implemente nada fora do escopo.
2) Antes de codar, resuma entendimento e plano.
3) Depois implemente com mudancas minimas e consistentes.
4) Rode validacoes necessarias.
5) Entregue checklist de AC-xxx com status.
```

## 4) Prompt para detalhar tarefas tecnicas

```text
Quebre o escopo [BL-xxx] em tarefas tecnicas executaveis.
Para cada tarefa, inclua:
- arquivos alvo
- risco
- teste necessario
- criterio de pronto
```

## 5) Prompt para revisao de aderencia a spec

```text
Revise as mudancas feitas e informe:
1) quais FR-xxx foram cobertos
2) quais AC-xxx foram validados
3) lacunas entre implementacao e spec
4) riscos tecnicos remanescentes
```

## 6) Checklist rapido antes de merge

- Escopo BL/FR/AC declarado no PR.
- Sem violacao das regras de validacao do formulario.
- Discount function com logica real e testes.
- Analytics com metrica coerente.
- Billing respeitando trial e plano mensal.
- Docs SDD atualizadas se houve mudanca de contrato.

## 7) Anti-patterns

- Codar primeiro e "ajustar spec depois".
- Misturar multiplas fases no mesmo PR sem necessidade.
- Ignorar open questions tecnicas da plataforma Shopify.
- Marcar criterio de aceite como concluido sem evidencias.
