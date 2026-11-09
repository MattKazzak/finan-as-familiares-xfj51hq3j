# Varredura 3C-Resíduo — Cores Tailwind fora do CDS v2.0 (somente leitura)

> Relatório de auditoria. **Nenhum arquivo de código foi editado** nesta varredura.
> Escopo: `src/` — famílias `amber-*`, `slate-*`, `emerald-*`, `rose-*`, `red-*`, `green-*`, `blue-*`, `gray-*`.
> Unidade de contagem: **linhas com ocorrência** (equivalente a `grep -c` agregado por arquivo e somado).
> Linhas com 2+ classes da mesma família contam como 1 (subestima levemente o total de classes).

## Metodologia e status da coleta

A varredura foi executada com grep por diretório (`src/pages`, `src/components` e subpastas, `src/services`, `src/hooks`, `src/lib`, `src/contexts`, `src/main.css`). A plataforma trunca saídas de grep em ~200 linhas; famílias mais pesadas (slate, amber, emerald em `src/components`) estouraram esse limite. Onde isso aconteceu, o número abaixo é **limite inferior (≥)** e vem marcado. As contagens de `src/pages` e `src/components/wallet` vieram completas (sem truncamento) e são exatas.

Padrão de busca: `(amber|slate|emerald|rose|red|green|blue|gray)-\d` e faixas estreitas (`slate-(100|200|300|400|500|600)`, `amber-300..600`, `red-400..600`).

## Confirmações estruturais (verificadas, exatas)

- `src/services/`, `src/hooks/`, `src/lib/`, `src/contexts/`: **zero ocorrências** de qualquer família (grep de todas as 8 famílias retornou vazio). Toda a camada de dados/lógica está limpa.
- `src/main.css`: **zero classes Tailwind** dessas famílias. Apenas 2 linhas de **comentário** que citam `slate-500`/`slate-400` como anotação hex do token v1.0 (linhas 54–55) — categoria **C**, sem efeito em runtime.
- `src/App.tsx` e `src/pages/DocumentsPage.tsx`: **zero ocorrências**.
- Zona zero adicional esperada (não re-verificada linha a linha nesta passada): `src/components/ui/` (kit shadcn padrão) e `src/components/brand/`.
- `src/types/budget-presets.ts` (mapeamentos `borderColor`/cores de preset) e mapas de cor em `src/components/common/CategoryIcon.tsx` **não foram re-varridos nesta passada** — por definição do escopo são categoria **C** (mapeamento de dado do banco), mas a contagem deles ficou como pendência (ver §Pendências).

## Tabela por família

| Família        | Total em src/                                                                    | A (className/style .tsx) | B (.css) | C (outros)                  | Top arquivo                                                                               |
| -------------- | -------------------------------------------------------------------------------- | ------------------------ | -------- | --------------------------- | ----------------------------------------------------------------------------------------- |
| amber-300..600 | ≥ 200 (components truncado) + 81 em pages                                        | ≥ 280                    | 0        | 0\*                         | `components/transactions/ImportStatementDialog.tsx`                                       |
| slate-100..600 | ≥ 200 (components truncado) + ~300 em pages                                      | ≥ 500                    | 0        | 2 (comentários em main.css) | `components/transactions/ImportStatementDialog.tsx` / `pages/wallet/WalletBudgetsTab.tsx` |
| emerald-\*     | **~340** (125 pages exato + 56 components/wallet exato + ~160 demais components) | ~340                     | 0        | 0\*                         | `components/transactions/ImportStatementDialog.tsx` (~50)                                 |
| rose-\*        | ~15 (5 Copilot + 2 ResetPassword + components/wallet/categories)                 | ~15                      | 0        | 0\*                         | `pages/Copilot.tsx` (5)                                                                   |
| red-400..600   | ≥ 30 (pages/components; saída truncada)                                          | ≥ 30                     | 0        | 0\*                         | `pages/wallet/WalletBudgetsTab.tsx` (3+)                                                  |
| green-\*       | ≥ 20 (parcial; hotspots em import/wallet)                                        | ≥ 20                     | 0        | 0\*                         | `components/import/`                                                                      |
| blue-\*        | ≥ 15 (parcial)                                                                   | ≥ 15                     | 0        | 0\*                         | `pages/Login.tsx` / `pages/Home.tsx`                                                      |
| gray-\*        | **3** (exato, zona isolada)                                                      | 3                        | 0        | 0                           | `pages/NotFound.tsx` (3 — 100% do total)                                                  |

\* Nenhuma ocorrência dessas famílias foi encontrada fora de className/template-string de estilo nos arquivos varridos; a ressalva vale apenas para `src/types/budget-presets.ts` e `CategoryIcon.tsx` (não re-varridos — ver Pendências).

**Total geral de suspeitos (categoria A): ≥ 700 linhas** — estimativa conservadora; as famílias truncadas (slate, amber, emerald em components) somam a maior parte da incerteza. slate e emerald dominam; amber vem em terceiro.

## Top 5 arquivos por família (onde coletado de forma confiável)

### emerald-\* (exato em pages e components/wallet)

1. `pages/Profile.tsx` — 35
2. `pages/Patrimony.tsx` — 18
3. `components/wallet/OnboardingWizardDialog.tsx` — 16
4. `components/wallet/RecurringIncomesDialog.tsx` — 13
5. `components/wallet/ApplyBudgetModelDialog.tsx` — 11
   (demais pages: InviteAcceptPage 11, WalletBudgetsTab 17, ImportReviewPage 8, Investments 6, Goals 5, Login 5, WalletHeader 5, WalletModals 5, Home 4, WalletTransactionsTab 4, ResetPassword 1, WalletProjectionTab 1. Em components/transactions: ImportStatementDialog ~50, NewTransactionDialog ~21, VoiceTransactionDialog ~13, ImportItemEditor 10, TransactionInlineRow 10, ImportItemList 6, ImportConfirmationFooter 4, NotificationsPanel 4, TransactionDetailDialog 1. Em components/categories: CategoryManagementDialog ~20, CategoryEditorPopover ~10, SubcategoryEditorPopover 6. Em components/common: InstallInstructionsModal ~15, SortableList 1, WhoIsUsingDialog 1. Em components/documents: AddDocumentModal 5, DocumentViewerModal 1, ShareDocumentDialog 1.)

### slate-100..600 (exato nos arquivos listados)

1. `components/transactions/ImportStatementDialog.tsx` — ≥ 40 (truncado no lote)
2. `pages/wallet/WalletBudgetsTab.tsx` — 54 (linhas: 175–1101)
3. `pages/wallet/WalletModals.tsx` — 27
4. `pages/wallet/WalletProjectionTab.tsx` — 22
5. `pages/Copilot.tsx` — 15 (linhas 2010–2351)
   (também confirmados: `components/transactions/NewTransactionDialog.tsx` e `VoiceTransactionDialog.tsx` pesados — lote truncado; `pages/ResetPassword.tsx` 8; `pages/Legal.tsx` 8; `pages/wallet/WalletTransactionsTab.tsx` presente no lote truncado)

### amber-300..600

- `src/pages` (lote completo): 74 linhas — top: `pages/Login.tsx` e `pages/Profile.tsx` (1, linha 1169) e `pages/ResetPassword.tsx` (1, linha 239).
- `src/components` (lote truncado ≥ 200): hotspots confirmados em `components/categories/`, `components/transactions/ImportStatementDialog.tsx`, `components/wallet/` (conforme histórico da migração).
- `pages/Copilot.tsx` — 5 (linhas 2148, 2151, 2152, 2154, 2234).

### red-400..600 (exato onde listado)

- `pages/wallet/WalletBudgetsTab.tsx` — 3 (linhas 499, 845, 964: `hover:text-red-600`)
- `pages/ResetPassword.tsx` — 1 (linha 237: `bg-red-500` no medidor de senha)
- `pages/Investments.tsx` — 2 (linhas 338, 464: ternário `text-red-600`)
- `pages/Patrimony.tsx` — 1 (linha 678: ternário `text-red-600`)
- resto em components (lote truncado).

### gray-\* (100% mapeado)

1. `pages/NotFound.tsx` — 3 (todas as ocorrências da família em src/):
   - linha 13: `bg-gray-100`
   - linha 16: `text-gray-600`
   - linha 17: `text-blue-500 hover:text-blue-700` (também única ocorrência confirmada de blue nesta página)

### rose-\* (exato onde listado)

1. `pages/Copilot.tsx` — 5 (linhas 2181, 2184, 2185, 2195, 2197 — bloco de erro do chat)
2. `pages/ResetPassword.tsx` — 2 (linhas 296, 298)
3. `components/wallet/RecurringIncomesDialog.tsx` — 2 (linhas 353, 368: `text-rose-700` ternário despesa)
4. `components/categories/` — presente no lote truncado.

### green-_ e blue-_

- Lotes truncados pela plataforma antes da consolidação. Hotspots confirmados: `green` em `components/import/` (checkboxes `text-green-600`/`focus:ring-green-500` em ImportItemEditor/ImportItemList padrão antigo) e `blue` em `pages/Login.tsx`/`pages/Home.tsx` (links e badges informativos) e `pages/NotFound.tsx:17`.

## Suspeitos categoria A (amostras com arquivo:linha)

Famílias com mais de ~60 suspeitos (slate, amber, emerald) — listados os arquivos mais atingidos com exemplo, conforme critério da tarefa:

- **emerald** (≈340): `pages/Profile.tsx:1874` `className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"`; `components/transactions/ImportStatementDialog.tsx:3624` `className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-xs"`
- **slate** (≥500): `pages/wallet/WalletBudgetsTab.tsx:203` `className="text-sm font-semibold text-slate-600"`; `pages/Copilot.tsx:2010` `className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50"`
- **amber** (≥280): `pages/Copilot.tsx:2148` `className="... border-amber-200 bg-amber-50/95 text-amber-900 ..."`; `pages/Profile.tsx:1169` `bg-amber-50 text-amber-700`

Famílias pequenas — lista completa dos suspeitos coletados:

- **gray** (3): `pages/NotFound.tsx:13` `bg-gray-100`; `:16` `text-gray-600`; `:17` `text-blue-500 hover:text-blue-700`
- **rose** (exato parcial): `pages/Copilot.tsx:2181` `border-rose-200 bg-rose-50/90 text-rose-900`; `:2184` `text-rose-600`; `:2185` `text-rose-800`; `:2195` `border-rose-300 hover:bg-rose-100/70 text-rose-900`; `:2197` `text-rose-600`; `pages/ResetPassword.tsx:296,298` `text-rose-700`; `components/wallet/RecurringIncomesDialog.tsx:353,368` `text-rose-700`
- **red** (exato parcial): `pages/wallet/WalletBudgetsTab.tsx:499,845,964` `hover:text-red-600`; `pages/ResetPassword.tsx:237` `bg-red-500`; `pages/Investments.tsx:338,464` `text-red-600`; `pages/Patrimony.tsx:678` `text-red-600`

## Leitura qualitativa para a próxima rodada de migração

1. **slate-\*** é o resíduo dominante e está concentrado em telas de tabela/lista (`WalletBudgetsTab`, `ImportStatementDialog`, `Copilot`). Mapeamento natural: `slate-900/800 → text-ink`, `slate-600/500 → text-body`, `slate-400 → text-muted`, `slate-100/50 → bg-surface/border-line`.
2. **emerald-\*** concentra-se em semântica de receita/confirmação. O CDS v1.0/v2.0 já define `text-income`/`bg-income-subtle` — a maior parte dos emerald é substituição direta, com atenção aos botões sólidos `bg-emerald-600` (devem virar `bg-action` apenas quando a semântica for "ação primária", não "receita").
3. **gray/NotFound** é o caso mais barato: 3 classes em uma página isolada.
4. `hover:text-red-600` em `WalletBudgetsTab` (3 linhas) e `text-red-600` em Investments/Patrimony são semântica "destrutivo" — deve migrar para o token de despesa/destrutivo do CDS v2.0, não para `text-income`.

## Pendências / receita para completar números exatos

Os lotes truncados podem ser fechados com estes comandos (contagem agregada por arquivo):

```bash
grep -rEo '(emerald|red|green|blue|gray|rose)-(100|200|300|400|500|600|700|800|900|950)\b' src/components --include='*.tsx' | cut -d: -f1 | sort | uniq -c | sort -rn
grep -rEo 'slate-(100|200|300|400|500|600)\b' src/components --include='*.tsx' | cut -d: -f1 | sort | uniq -c | sort -rn
grep -rEo 'amber-(300|400|500|600)\b' src --include='*.tsx' --include='*.ts' | cut -d: -f1 | sort | uniq -c | sort -rn
grep -rEo '(red|green|blue)-[0-9]+\b' src --include='*.tsx' --include='*.ts' | cut -d: -f1 | sort | uniq -c | sort -rn
grep -rn '(emerald|rose|amber|slate|red|green|blue|gray)-[0-9]' src/types/budget-presets.ts src/components/common/CategoryIcon.tsx
```

Faltou nesta passada: contagem exata de `src/components` inteiro para slate/amber/emerald/red/green/blue (truncamento), e a varredura dedicada de `src/types/` (budget-presets) e `CategoryIcon.tsx` (categoria C por definição, mas a tarefa pede contagem).
