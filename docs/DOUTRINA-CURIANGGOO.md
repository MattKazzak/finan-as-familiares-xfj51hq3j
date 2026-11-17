# DOUTRINA DO CURIANGGOO — documento de referência para agentes

Documento de referência para o revisor de doutrina financeira (Caio) e qualquer agente que precise auditar o app. Toda afirmação aqui foi verificada no código em produção ou no banco. Versão do app no momento da escrita: **v0.0.684** (ref `109a53d`, 16/11/2026).

> **Sobre este repositório**: é um espelho do código do projeto no Skip. Nem todo arquivo é sincronizado a cada mudança. Quando precisar do conteúdo **exato** de um arquivo, peça ao Apollo — ele lê do projeto e entrega. Não reporte bug baseado em arquivo que possa estar defasado: confirme a versão.

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

**Consequência obrigatória**: o "Saldo Total da Família" **não é o saldo da conta bancária**. Ele já desconta compras no crédito ainda não pagas. Se a tela apresenta esse número sem rotular o que ele é, o usuário compara com o extrato e conclui que o app erra. **Achado CRÍTICO aberto** — ver §7.

**Proteção contra contagem dupla** (importante): o importador de OFX/PDF marca a linha de pagamento de fatura como **não-despesa** (`isNonExpense`). Detectores: `pagamentodefatura`, `pagamentorecebido`, `pagamentoefetuado`, `pagtodefatura`, `quitacaodefatura`, `pagamentocartao`, `pagtoantecipado`, `pagamentotitulo`, `pagamentominimo`, `pagamentoparcial`. Sem isso, a compra contaria duas vezes (na compra e na fatura).

---

## 3. Regra de domínio: a cadeia de classificação

O sistema é uma **taxonomia de três níveis com herança**. É a regra de negócio mais importante do app:

```
subcategoria  →  categoria  →  balde
Aluguel & Condomínio  →  Moradia  →  Essenciais
```

- O usuário (e a IA) escolhem **subcategoria**, no máximo **categoria**.
- O **balde nunca é escolhido** — é herdado da categoria. Isso impede duas verdades sobre o mesmo gasto.
- A árvore é semeada no onboarding, por família, e pode ser editada pelo usuário (renomear, ocultar).

**Onde cada elo é decidido**:
- Árvore de categorias e subcategorias: `src/services/onboarding.ts`
- Percentuais dos baldes: `src/types/budget-presets.ts`
- O que a UI deixa o usuário mudar: `src/components/categories/`
- Sementes compartilhadas com as edge functions: `supabase/functions/_shared/brazilian-seeds.ts`

**Estrutura real da árvore** (verificada no banco, família Demo): 19 categorias, 117 subcategorias.

| Balde | Categorias |
|---|---|
| **Essenciais** | Alimentação · Dívidas & Empréstimos · Educação · Moradia · Saúde · Transporte |
| **Estilo de Vida** | Assinaturas & Apps · Compras · Cuidados Pessoais & Bem-estar · Lazer · Pets · Restaurantes & Delivery |
| **Futuro** | Investimentos · Metas · Reserva de Emergência |
| *(sem balde — receitas)* | Salário · Rendimentos · Trabalhos Extras & Autônomo · Outras Receitas |

Observação de doutrina: receitas não têm balde, por definição. Se algum lugar do app atribuir balde a uma receita, é bug.

---

## 4. Os 3 Baldes

| Modelo | Essenciais | Estilo de Vida | Futuro |
|---|---|---|---|
| **50/30/20** (padrão) | 50% | 30% | 20% |
| 60/20/20 | 60% | 20% | 20% |
| 70/20/10 | 70% | 20% | 10% |

**Origem**: 50/30/20 foi popularizada por Elizabeth Warren em *All Your Worth* (2005). É **boa prática de divulgação, não norma contábil, nem consenso acadêmico**. Nunca apresentar como ciência.

**Doutrina do balde Futuro = PAGUE-SE PRIMEIRO.** É fatia fixa de renda, separada antes do consumo. **Não é** "o que sobra no fim do mês" (orçamento residual). As duas doutrinas são incompatíveis. O FAQ dizia "o que sobra pro futuro" — corrigido em v0.0.684.

> ⚠️ **CONTRADIÇÃO CONHECIDA E ABERTA**: existem **duas definições divergentes do modelo de 60%** no app.
> - `src/types/budget-presets.ts` define **60/20/20** ("Foco em Essenciais").
> - `src/services/onboarding.ts` trabalha com **60/25/15** (fatores 1.2 / 0.833 / 0.75).
> - O onboarding do usuário (Login/Setup) oferece **60/25/15**; a tela de modelo de orçamento oferece **60/20/20**.
> Os dois aparecem no bundle de produção. **É contradição de fato**: o mesmo app ensina dois modelos diferentes com o mesmo rótulo "60".

---

## 5. Lei de responsabilidade: o que é de quem

- **Matheus (dono)**: decide **qual** regra o app usa. Preço, feature, visual, rumo do produto.
- **Caio (revisor de doutrina)**: diz se a regra está **certa**, com fonte. Não decide produto.
- **Apollo (engenharia)**: implementa, prova e publica. Diz se é viável e qual o custo.

Uma pergunta do tipo "o que o app deveria fazer?" é do Matheus. "O que está fazendo errado?" é do Caio.

---

## 6. Hierarquia de fontes (nunca inverter)

1. **Norma brasileira**: NBC TG / CPC (contabilidade), Bacen (sistema financeiro), CVM (valores mobiliários), CDC (consumidor).
2. **Literatura acadêmica** revisada por pares.
3. **Boa prática de mercado** consolidada (com nome e origem).
4. **Convenção de produto** (o que o app decidiu).

Nunca apresentar nível 3 ou 4 como nível 1. Toda afirmação de norma, número, data ou estudo vem com **título + URL**. Sem fonte obtida → marcar "não verificado".

---

## 7. Achados abertos (estado em 16/11/2026)

| # | Achado | Severidade | Quem decide |
|---|---|---|---|
| 1 | "Saldo Total da Família" não é saldo de banco (crédito na data da compra) e não diz o que é | CRÍTICO | Matheus |
| 2 | Duas definições do modelo 60% (60/20/20 vs 60/25/15) | CRÍTICO | Matheus |
| 3 | Home e Orçamentos divergem por design (transações sem categoria) e não avisam | MÉDIO | Matheus |
| 4 | ~~FAQ dizia "o que sobra pro futuro"~~ | ALTO | **CORRIGIDO v0.0.684** |

---

## 8. Dataset de auditoria (Família Demo)

- **id**: `ec2a79d9-8e69-4cb7-82b6-2dbf6bfb89c6`
- 161 transações · 3 metas · 4 investimentos · renda mensal R$ 8.500,00 · modelo 50/30/20
- **Números de referência provados (16/11/2026)**:
  - Saldo consolidado mostrado pelo app: **R$ 14.518,40**
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
