# DOUTRINA DO CURIANGGOO — documento de referência para agentes

Documento de referência para o revisor de doutrina financeira (Caio) e qualquer agente que precise auditar o app. Versão do app no momento da escrita: **v0.0.684** (ref `109a53d`, 16/11/2026).

> **Sobre este repositório**: é um espelho do código do projeto no Skip. **Ele fica atrás.** Em 16/11/2026 o espelho estava 4 dias defasado: `app-version.ts` dizia 0.0.658 quando o real era 0.682, e `transactions.ts` ainda não tinha o filtro `includeProjected` — um auditor que confiou no espelho reportou 3 bugs já corrigidos. **Sempre peça a versão exata ao Apollo antes de reportar bug em arquivo que possa estar velho.**

---

## 1. O que é o Curiangoo

SaaS de finanças pessoais **familiares**, mobile-first, PWA. Método dos 3 Baldes, multi-família (até 5 membros), Copilot de voz em português. Preço: R$ 19,90/mês ou R$ 149,90/ano.

**Missão educativa** (ordem do dono): o app tem que ensinar finanças pessoais. O usuário-alvo é amador. Toda tela ensina algo. Educação financeira é critério de decisão de UX.

**Não é** consultoria de investimento, não recomenda compra/venda, não é regulado pela CVM ou pelo Bacen. É um caderno inteligente de contas.

---

## 2. Doutrina financeira (decidida pelo dono em 16/11/2026)

| Pergunta | Resposta |
|---|---|
| Quando o gasto entra na conta? | **Regime de caixa** — quando o dinheiro se move |
| Compra no cartão é despesa quando? | **Na data da compra** |

**A combinação é um regime MISTO, intencional.** Dinheiro, pix e débito entram em caixa. Crédito entra em competência. É o padrão de mercado (Mobills, YNAB, Copilot Money).

**Consequência obrigatória**: o "Saldo Total da Família" **não é o saldo da conta bancária**. Ele já desconta compras no crédito ainda não pagas. Se a tela apresenta esse número sem rotular o que ele é, o usuário compara com o extrato e conclui que o app erra. **Achado CRÍTICO aberto — nº 1.**

**Proteção contra contagem dupla**: o importador de OFX/PDF marca a linha de pagamento de fatura como **não-despesa** (`isNonExpense`). Detectores: `pagamentodefatura`, `pagamentorecebido`, `pagamentoefetuado`, `pagtodefatura`, `quitacaodefatura`, `pagamentocartao`, `pagtoantecipado`, `pagamentotitulo`, `pagamentominimo`, `pagamentoparcial`. Sem isso, a compra contaria duas vezes.

---

## 3. Regra de domínio: a cadeia de classificação

O sistema é uma **taxonomia de três níveis com herança**:

```
subcategoria  →  categoria  →  balde
Aluguel & Condomínio  →  Moradia  →  Essenciais
```

- O usuário (e a IA) escolhem **subcategoria**, no máximo **categoria**.
- O **balde nunca é escolhido** — é herdado da categoria. `transactions` não tem coluna `budget_bucket`; o elo vive em `transaction_categories.budget_bucket`.
- **Receitas não têm balde** (`budget_bucket` NULL), por definição.

### Onde cada elo é decidido — ATENÇÃO, esta lista foi corrigida

| Elo | Fonte de verdade |
|---|---|
| Árvore que **semeia** a família | **Migração SQL** `server_onboarding_plan_rpc` / `onboarding_subcategories_catalog_116` (RPC `activate_family_onboarding_plan`); fallback em `CANONICAL_CATEGORIES` |
| Percentuais dos baldes | `src/types/budget-presets.ts` |
| O que a UI deixa o usuário mudar | `src/components/categories/*` |
| Sementes das edge functions | `supabase/functions/_shared/brazilian-seeds.ts` |

> ⚠️ **`src/services/onboarding.ts` NÃO é a fonte da árvore.** `STANDARDIZED_CATEGORIES_TREE` é **legado**: existe teste (`src/services/__tests__/catalog-consistency.test.ts:114`) que proíbe expressamente seu uso como fonte de semeadura. As duas árvores já divergem em 5 categorias (Saúde, Dívidas, Restaurantes, Lazer, Compras). Auditar código morto é falso positivo. *(Correção apontada pelo Caio em 16/11, verificada e aceita.)*

**Contagem real no banco (Família Demo)**: **19 categorias** (15 despesa + 4 receita) e **117 subcategorias**. Se outra fonte disser 118, conte duas vezes a mesma.

---

## 4. Os 3 Baldes

| Modelo | Essenciais | Estilo de Vida | Futuro |
|---|---|---|---|
| **50/30/20** (padrão) | 50% | 30% | 20% |
| 60/25/15 | 60% | 25% | 15% |
| 70/20/10 | 70% | 20% | 10% |

**Origem**: 50/30/20 foi popularizada por Elizabeth Warren em *All Your Worth* (2005). É **boa prática de divulgação, não norma contábil, nem consenso acadêmico**.

**Doutrina do balde Futuro = PAGUE-SE PRIMEIRO.** Fatia fixa de renda, separada antes do consumo. **Não é** "o que sobra no fim do mês". As duas doutrinas são incompatíveis. O FAQ dizia "o que sobra pro futuro" — corrigido em v0.0.684.

> ⚠️ **CONTRADIÇÃO ABERTA (nº 2)**: o RPC vigente aceita **`50_30_20 | 60_25_15 | 70_20_10`**. Qualquer outro valor cai no `ELSE` e é **reescrito para 50/30/20 em silêncio**. `budget-presets.ts` oferece **60/20/20** — uma família que escolher esse modelo no diálogo de orçamento perde a escolha e cai em 50/30/20 sem aviso. Em R$ 8.500, Essenciais vai de R$ 5.100 para R$ 4.250 (−R$ 850). *Achado do Caio, confirmado no corpo da função.*

---

## 5. Lei de responsabilidade: o que é de quem

- **Matheus (dono)**: decide **qual** regra o app usa. Preço, feature, visual, rumo.
- **Caio (revisor de doutrina)**: diz se a regra está **certa**, com fonte. Não decide produto.
- **Apollo (engenharia)**: implementa, prova e publica. Diz se é viável e o custo.

"O que o app deveria fazer?" é do Matheus. "O que está fazendo errado?" é do Caio.

---

## 6. Hierarquia de fontes (nunca inverter)

1. **Norma brasileira**: NBC TG / CPC, Bacen, CVM, CDC.
2. **Literatura acadêmica** revisada por pares.
3. **Boa prática de mercado** consolidada (com nome e origem).
4. **Convenção de produto**.

Nunca apresentar nível 3 ou 4 como nível 1. Toda afirmação de norma, número, data ou estudo vem com **título + URL**. Sem fonte → marcar "não verificado".

---

## 7. Achados abertos (estado em 16/11/2026)

| # | Achado | Severidade | Quem decide |
|---|---|---|---|
| 1 | "Saldo Total da Família" não é saldo de banco e não diz o que é | CRÍTICO | Matheus |
| 2 | `60_20_20` existe na UI mas o RPC só aceita `60_25_15` → reescrita silenciosa para 50/30/20 | CRÍTICO | Matheus |
| 3 | `CategoryEditorPopover.tsx:159` fixa 50/30/20 e escreve "acima da meta de 50%" numa família em 60/25/15 | ALTO | Apollo |
| 4 | `ApplyBudgetModelDialog.tsx:56` abre sempre em 50/30/20, ignorando o modelo da família | MÉDIO | Apollo |
| 5 | Home e Orçamentos divergem por design (tx sem categoria) e não avisam | MÉDIO | Matheus |
| 6 | ~~FAQ dizia "o que sobra pro futuro"~~ | ALTO | **CORRIGIDO v0.0.684** |
| 7 | ~~Doc apontava `onboarding.ts` como fonte da árvore (é legado)~~ | — | **CORRIGIDO** |

---

## 8. Dataset de auditoria (Família Demo)

- **id**: `ec2a79d9-8e69-4cb7-82b6-2dbf6bfb89c6`
- 161 transações · 3 metas · 4 investimentos · renda mensal R$ 8.500,00 · modelo 50/30/20
- **Números de referência provados (16/11/2026, status `projected` excluído)**:
  - **Caixa & Contas** (card do Patrimônio): **R$ 14.518,40**
  - Investimentos (quantidade × preço atual): **R$ 27.335,20**
  - Crédito dos últimos 30 dias ainda não debitado: **R$ 2.572,10**
  - Saldo correspondente no extrato do banco: **R$ 17.090,50**
  - Total de despesas no crédito: R$ 10.524,50 em 60 lançamentos

**Acesso ao banco**: agentes não recebem credencial. Pedir o número ao Apollo, que extrai e entrega.

---

## 9. Anti AI Slop — regras do relatório

Todo achado tem os quatro campos, nessa ordem:

1. **Regra** — o que deveria acontecer, com fonte.
2. **Evidência** — tela, número, data, versão do app.
3. **Divergência** — o que destoa.
4. **Correção** — o que fica no lugar.

Severidade por **dano ao usuário**: CRÍTICO (duas telas respondem diferente à mesma pergunta, ou o app esconde um negativo) · ALTO (número certo, texto ensina errado) · MÉDIO (escolha não rotulada) · BAIXO (clareza).

Proibido: "considere melhorar", "seria interessante", "recomenda-se revisar". Proibido propor feature. Obrigatório dizer "isto está certo" quando estiver.

---

## 10. Falsos positivos já cometidos (para não repetir)

| Reportado | Por que era falso |
|---|---|
| Patrimônio soma `projected` | O espelho não tinha o commit de 16/11; o código real exclui por padrão (`includeProjected` opt-in) |
| Patrimônio esconde negativo com `Math.max(0, …)` | Corrigido em 16/11; o `Math.max` restante é só da barra de distribuição visual, que não desenha negativo |
| `onboarding.ts` é a fonte da árvore | É legado; a fonte é a migração SQL |

**Lição**: antes de reportar, confirmar a versão do arquivo com o Apollo. O espelho engana.
