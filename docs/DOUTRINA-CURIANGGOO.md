# DOUTRINA DO CURIANGGOO — documento de referência para agentes

Versão do app: **v0.0.700** (ref `1f7f4e6`, 17/11/2026).

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

O "Saldo Total da Família" **não é o saldo bancário**: já desconta compras no cartão que o banco ainda não debitou. **A partir de v0.0.700 o app explica isso no próprio card**, com três números:

```
Saldo Total da Família ........ R$ 14.518,40   ← já descontando o cartão
Já inclui no cartão ........... R$ 10.524,50   ← compras no crédito (todas, histórico)
Na conta ...................... R$ 25.042,90   ← saldo consolidado + cartão
```

Fórmula: `na_conta = saldo_consolidado + total_credit_cents`. O bloco só renderiza quando há crédito (`creditOpenCents > 0`) — em família sem cartão não aparece ruído.

**Fonte**: RPC `get_family_totals` ganhou o campo `total_credit_cents` (migração `family_totals_credit_split`). Nada é inventado: os três números derivam do mesmo conjunto de lançamentos (`status <> 'projected'`).

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

> ⚠️ **`src/services/onboarding.ts` NÃO é a fonte da árvore.** `STANDARDIZED_CATEGORIES_TREE` é **legado**: existe teste (`catalog-consistency.test.ts:114`) que proíbe seu uso como semente. As duas árvores divergem em 5 categorias. *(Correção apontada pelo Caio, aceita.)*

**Contagem real no banco (Família Demo)**: **19 categorias** (15 despesa + 4 receita) e **117 subcategorias**.

---

## 4. Os 3 Baldes — nomes padronizados

**O primeiro balde se chama "Essenciais" em TODO o app** (padronizado em 17/11/2026, v0.0.700). Antes a Home, o onboarding e o tour diziam "Necessidades" enquanto Orçamentos, FAQ e categorias diziam "Essenciais" — duas palavras para o mesmo balde. Se você encontrar "Necessidades" em alguma tela, é bug.

| Modelo | Essenciais | Estilo de Vida | Futuro & Metas |
|---|---|---|---|
| **50/30/20** (padrão) | 50% | 30% | 20% |
| **60/25/15** | 60% | 25% | 15% |
| 70/20/10 | 70% | 20% | 10% |

**Origem**: 50/30/20 popularizada por Elizabeth Warren em *All Your Worth* (2005). **Boa prática de divulgação, não norma contábil, nem consenso acadêmico.**

**Doutrina do balde Futuro = PAGUE-SE PRIMEIRO.** Fatia fixa de renda, separada antes do consumo. **Não é** "o que sobra no fim do mês". O FAQ dizia o contrário — corrigido em v0.0.684.

> ✅ **RESOLVIDO (16/11, v0.0.694)**: existiam **duas** definições do modelo de 60% (60/20/20 na UI × 60/25/15 no RPC), e o RPC **reescrevia 60/20/20 para 50/30/20 em silêncio** (provado com begin/rollback: R$ 8.500 → Essenciais de 5.100 caía para 4.250). Decisão do dono: **60/25/15**. Preset, tipos, teste, diálogo e categorias unificados; migração `normalize_budget_model_60_25_15` + CHECK `families_budget_model_check` (banco rejeita 60_20_20). Bundle com zero refs.

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

Toda afirmação de norma, número, data ou estudo vem com **título + URL**. Sem fonte → marcar "não verificado".

---

## 7. Achados abertos (estado em 17/11/2026)

| # | Achado | Severidade | Quem decide |
|---|---|---|---|
| 1 | `ApplyBudgetModelDialog` já abre no modelo da família, mas o fluxo de reaplicar preset não avisa que vai **recalcular todos os tetos** | MÉDIO | Matheus |
| 2 | Home e Orçamentos divergem por design (tx sem categoria) e não avisam | MÉDIO | Matheus |
| 3 | ~~Saldo não explicava o cartão~~ | CRÍTICO | **CORRIGIDO v0.0.700** |
| 4 | ~~60/20/20 × 60/25/15~~ | CRÍTICO | **CORRIGIDO v0.0.694** |
| 5 | ~~Editor de categoria fixava 50/30/20~~ | ALTO | **CORRIGIDO v0.0.691** |
| 6 | ~~FAQ dizia "o que sobra pro futuro"~~ | ALTO | **CORRIGIDO v0.0.684** |
| 7 | ~~"Necessidades" × "Essenciais"~~ | MÉDIO | **CORRIGIDO v0.0.700** |

---

## 8. Dataset de auditoria (Família Demo)

- **id**: `ec2a79d9-8e69-4cb7-82b6-2dbf6bfb89c6`
- Login: `demo@curiangoo.com` · 161 transações · 3 metas · 4 investimentos · renda R$ 8.500,00 · modelo 50/30/20
- **Números de referência provados (17/11/2026, `status <> 'projected'`)**:
  - Receitas totais: **R$ 51.496,00**
  - Despesas totais: **R$ 36.977,60** (das quais **R$ 10.524,50** no cartão de crédito)
  - Saldo consolidado (o que o app mostra): **R$ 14.518,40**
  - Na conta (consolidado + cartão): **R$ 25.042,90**
  - Despesas pagas de fato (pix/dinheiro/débito): R$ 26.453,10

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
| Disse que "Na conta" era R$ 17.090,50 | Errado: somou só o crédito de 30 dias. O certo é R$ 25.042,90 (crédito do histórico inteiro) |
| Disse que o app usava "Essenciais" em todo lugar | Falso: Home, onboarding e tour diziam "Necessidades" — corrigido em v0.0.700 |
| Referenciou `onboarding.ts` como fonte da árvore | É legado; corrigido neste documento |
