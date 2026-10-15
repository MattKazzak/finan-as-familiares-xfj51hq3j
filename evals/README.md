# Evals do Curiangoo Copilot

Golden set de 40 casos cobrindo as 9 classes do router de intenções da voice-parse.

## Para que serve

Qualquer mudança no system prompt, no modelo ou na lógica da voice-parse DEVE rodar este suite antes de deployar. É o que impede regredir a IA no escuro (ex: "falso churrasco" voltar, confirmação da Classe 5 reaproveitar valor antigo, saudação virar transação).

## Como rodar

Precisa de um usuário de teste real no Supabase (recomendo criar `teste@curiangoo.com` exclusivo para evals):

```bash
SUPABASE_URL=https://evcxjxuakiyjerujntli.supabase.co \
SUPABASE_ANON_KEY=<anon key> \
TEST_EMAIL=teste@curiangoo.com \
TEST_PASSWORD=<senha> \
node evals/run-copilot-evals.mjs
```

Rodar um caso só (útil ao corrigir uma regressão):

```bash
CASE=c15 node evals/run-copilot-evals.mjs
```

Ver as respostas da IA em detalhe:

```bash
VERBOSE=1 node evals/run-copilot-evals.mjs
```

## Estrutura dos casos

Cada caso tem 1+ turnos encadeados. O contexto (`contexto_anterior`) é montado automaticamente a partir da resposta do turno anterior — igual o app faz. Expectativas validadas por turno:

- `status` — status do protocolo (sucesso, falta_valor, clarificacao, consulta, acao_executada, invalido)
- `classe` — router.classe (1-9)
- `acao` — ajustar_valor, mudar_mes, desfazer...
- `tipo` — receita
- `valor` — valor numérico com tolerância de 1%
- `categoria_contem` — substring na categoria proposta

## Custo

Cada caso custa 1 chamada de gpt-4o-mini por turno (~40-60 chamadas no suite completo). Com rate limit de 30/10min, o suite completo roda em ~2 rodadas. Não rodar em loop.

## Manutenção

- Novo bug de classificação descoberto em produção → adicionar caso aqui + corrigir prompt.
- Caso falhando após mudança de prompt → é regressão; NÃO deployar até investigar.
- Casos canônicos que NÃO podem falhar nunca: c10 (slot-filling), c16 (R43), c13 (falso churrasco), c23 (saudação).
