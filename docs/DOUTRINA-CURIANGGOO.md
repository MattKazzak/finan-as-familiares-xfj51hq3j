# DOUTRINA DO CURIANGGOO — documento de referência para agentes

Versão do app: **v0.0.704** (ref `3cfe3ac`, 17/11/2026).

> **Sobre este repositório**: é um espelho do código do projeto no Skip. **Ele fica atrás.** Em 16/11/2026 o espelho estava 4 dias defasado: `app-version.ts` dizia 0.0.658 quando o real era 0.682, e `transactions.ts` ainda não tinha o filtro `includeProjected` — um auditor que confiou no espelho reportou 3 bugs já corrigidos. **Sempre peça a versão exata ao Apollo antes de reportar bug em arquivo que possa estar velho.**

---

## 1. O que é o Curiangoo

SaaS de finanças pessoais **familiares**, mobile-first, PWA. Método dos 3 Baldes, multi-família (até 5 membros), Copilot de voz em português. Preço: R$ 19,90/mês ou R$ 149,90/ano.

**Missão educativa** (ordem do dono): o app tem que ensinar finanças pessoais. O usuário-alvo é amador. Toda tela ensina algo.

**Não é** consultoria de investimento, não recomenda compra/venda, não é regulado pela CVM ou pelo Bacen.

---

## 2. Doutrina financeira (decidida pelo dono em 16/11/2026)

| Pergunta | Resposta |
|---|---|
| Quando o gasto entra na conta? | **Regime de caixa** — quando o dinheiro se move |
| Compra no cartão é despesa quando? | **Na data da compra** |

**Regime MISTO, intencional.** Dinheiro, pix e débito entram em caixa. Crédito entra em competência. É o padrão de mercado (Mobills, YNAB, Copilot Money).

### A consequência, resolvida em 17/11

O "Saldo Total da Família" **não é o saldo bancário**: já desconta compras no cartão que o banco ainda não debitou. **A partir de v0.0.698 o app explica isso no próprio card**, com três números:

```
Saldo Total da Família ........ R$ 14.518,40   ← já descontando o cartão
Já inclui no cartão ........... R$ 10.524,50   ← compras no crédito (todas, histórico)
Na conta ...................... R$ 25.042,90   ← saldo consolidado + cartão
```

Fórmula: `na_conta = saldo_consolidado + total_credit_cents`. O bloco só renderiza quando há crédito (`creditOpenCents > 0`).

**Fonte**: RPC `get_family_totals` ganhou o campo `total_credit_cents` (migração `family_totals_credit_split`).

**Proteção contra contagem dupla**: o importador OFX/PDF marca pagamento de fatura como **não-despesa** (`isNonExpense`).

---

## 3. Regra de domínio: a cadeia de classificação

```
subcategoria  →  categoria  →  balde
Aluguel & Condomínio  →  Moradia  →  Essenciais
```

- O usuário (e a IA) escolhem **subcategoria**, no máximo **categoria**.
- O **balde nunca é escolhido** — é herdado. `transactions` não tem `budget_bucket`; o elo vive em `transaction_categories.budget_bucket`.
- **Receitas não têm balde** (`budget_bucket` NULL).

### Onde cada elo é decidido

| Elo | Fonte de verdade |
|---|---|
| Árvore que **semeia** a família | **Migração SQL** (RPC `activate_family_onboarding_plan`); fallback `CANONICAL_CATEGORIES` |
| Percentuais dos baldes | `src/types/budget-presets.ts` |
| O que a UI deixa mudar | `src/components/categories/*` |
| Sementes das edge functions | `supabase/functions/_shared/brazilian-seeds.ts` |

> ⚠️ **`src/services/onboarding.ts` NÃO é a fonte da árvore.** `STANDARDIZED_CATEGORIES_TREE` é **legado**: existe teste (`catalog-consistency.test.ts:114`) que proíbe seu uso como semente. *(Correção apontada pelo Caio, aceita.)*

**Contagem real no banco (Família Demo)**: **19 categorias** (15 despesa + 4 receita) e **117 subcategorias**.

---

## 4. Os 3 Baldes — nomes padronizados

**O primeiro balde se chama "Essenciais" em TODO o app** (v0.0.700). Antes a Home, o onboarding e o tour diziam "Necessidades" enquanto Orçamentos, FAQ e categorias diziam "Essenciais". Se encontrar "Necessidades" numa tela, é bug.

| Modelo | Essenciais | Estilo de Vida | Futuro & Metas |
|---|---|---|---|
| **50/30/20** (padrão) | 50% | 30% | 20% |
| **60/25/15** | 60% | 25% | 15% |
| 70/20/10 | 70% | 20% | 10% |

**Origem**: 50/30/20 popularizada por Elizabeth Warren em *All Your Worth* (2005). **Boa prática de divulgação, não norma contábil.**

**Doutrina do balde Futuro = PAGUE-SE PRIMEIRO.** Fatia fixa de renda, separada antes do consumo. **Não é** "o que sobra". O FAQ dizia o contrário — corrigido em v0.0.684.

> ✅ **RESOLVIDO v0.0.694**: duas definições do modelo de 60% (60/20/20 na UI × 60/25/15 no RPC) e o RPC **reescrevia 60/20/20 para 50/30/20 em silêncio**. Decisão do dono: **60/25/15**. Migração `normalize_budget_model_60_25_15` + CHECK `families_budget_model_check`.

---

## 5. Lei de responsabilidade

- **Matheus (dono)**: decide **qual** regra o app usa. Preço, feature, visual, rumo.
- **Caio (revisor de doutrina)**: diz se a regra está **certa**, com fonte. Não decide produto.
- **Apollo (engenharia)**: implementa, prova e publica.

---

## 6. Hierarquia de fontes (nunca inverter)

1. **Norma brasileira**: NBC TG / CPC, Bacen, CVM, CDC.
2. **Literatura acadêmica** revisada por pares.
3. **Boa prática de mercado** consolidada (com nome e origem).
4. **Convenção de produto**.

Toda afirmação de norma, número, data ou estudo vem com **título + URL**. Sem fonte → "não verificado".

---

## 7. Achados — estado em 17/11/2026

**Nenhum achado aberto.**

| # | Achado | Severidade | Estado |
|---|---|---|---|
| 1 | Saldo não explicava o cartão | CRÍTICO | CORRIGIDO v0.0.698 |
| 2 | 60/20/20 × 60/25/15 (reescrita silenciosa) | CRÍTICO | CORRIGIDO v0.0.694 |
| 3 | Editor de categoria fixava 50/30/20 | ALTO | CORRIGIDO v0.0.691 |
| 4 | FAQ dizia "o que sobra pro futuro" | ALTO | CORRIGIDO v0.0.684 |
| 5 | "Necessidades" × "Essenciais" | MÉDIO | CORRIGIDO v0.0.700 |
| 6 | Aplicar modelo sobrescrevia tetos em silêncio | ALTO | CORRIGIDO v0.0.704 |
| 7 | Home × Orçamentos divergiam em tx sem categoria | MÉDIO | CORRIGIDO v0.0.703 |

### Como os dois últimos foram fechados

**#6 — Aplicar modelo (v0.0.704)**: o passo 3 do `ApplyBudgetModelDialog` agora mostra, com número, **quais tetos vão mudar**: `categoria · R$ atual → R$ novo`, ordenado pela maior diferença. Recebe `currentLimitsByCatId` do `WalletModals` (mesma precedência do Orçamentos: override do mês vence teto padrão; teto de subcategoria é somado quando existe). Sem esse dado (ex.: Perfil), o diálogo não inventa diff — apenas não mostra a lista.

**#7 — Sem categoria (v0.0.703)**: categoria é opcional em Nova Transação. Esses lançamentos não pertencem a nenhuma linha de categoria, então ficavam **fora** de `totalSpent` e o Orçamentos somava menos que a Home. Agora:
- `uncategorizedSpentCents` entra em `totalSpent` (o mês fecha igual nas duas telas — Demo: **R$ 6.394,60** nas duas);
- aparece uma linha âmbar **"Sem categoria"** com o valor e atalho para o Extrato, só quando maior que zero;
- a Home já mostrava em "Outros" — as duas telas passaram a responder a mesma pergunta com o mesmo número.

---

## 8. Dataset de auditoria (Família Demo)

- **id**: `ec2a79d9-8e69-4cb7-82b6-2dbf6bfb89c6`
- Login: `demo@curiangoo.com` · 161 transações · 3 metas · 4 investimentos · renda R$ 8.500,00 · modelo 50/30/20
- **Números de referência provados (17/11/2026, `status <> 'projected'`)**:
  - Receitas totais: **R$ 51.496,00**
  - Despesas totais: **R$ 36.977,60** (das quais **R$ 10.524,50** no cartão)
  - Saldo consolidado (o que o app mostra): **R$ 14.518,40**
  - Na conta (consolidado + cartão): **R$ 25.042,90**
  - Novembro/2026: despesas **R$ 6.394,60** (mesmo número na Home e em Orçamentos)

**Acesso ao banco**: agentes não recebem credencial. Pedir o número ao Apollo.

---

## 9. Anti AI Slop — regras do relatório

Todo achado tem os quatro campos:

1. **Regra** — o que deveria acontecer, com fonte.
2. **Evidência** — tela, número, data, versão do app.
3. **Divergência** — o que destoa.
4. **Correção** — o que fica no lugar.

Severidade por **dano ao usuário**: CRÍTICO (duas telas respondem diferente à mesma pergunta, ou o app esconde um negativo) · ALTO (número certo, texto ensina errado) · MÉDIO (escolha não rotulada) · BAIXO (clareza).

Proibido: "considere melhorar", "seria interessante". Proibido propor feature. Obrigatório dizer "isto está certo" quando estiver.

---

## 10. Falsos positivos já cometidos (para não repetir)

| Reportado | Por que era falso |
|---|---|
| Patrimônio soma `projected` | Espelho sem o commit de 16/11; o código real exclui por padrão |
| Patrimônio esconde negativo com `Math.max(0, …)` | Corrigido em 16/11; o `Math.max` restante é só da barra visual |
| `onboarding.ts` é a fonte da árvore | É legado; a fonte é a migração SQL |

**Lição**: antes de reportar, confirmar a versão do arquivo. O espelho engana.

---

## 11. Erros do próprio Apollo (registrados por honestidade)

| Erro | Correção |
|---|---|
| Disse que "Na conta" era R$ 17.090,50 | Errado: somou só o crédito de 30 dias. O certo é R$ 25.042,90 (histórico inteiro) |
| Disse que o app usava "Essenciais" em todo lugar | Falso: Home, onboarding e tour diziam "Necessidades" — corrigido em v0.0.700 |
| Referenciou `onboarding.ts` como fonte da árvore | É legado; corrigido neste documento |
| Publicou v0.0.703 sem o bloco JSX do aviso de sobrescrita | O patch reportou sucesso mas só a declaração entrou. Pegou por grep no bundle servido. Corrigido em v0.0.704 |
