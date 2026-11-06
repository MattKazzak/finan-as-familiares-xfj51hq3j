# CDS v2.0 — Inventário 3A (somente leitura)

Objetivo: mapear onde os hex e valores do CDS v1.0 aparecem em `src/` antes da migração 3B.
Nenhum arquivo de código foi alterado. Este documento é o único arquivo novo.

Categorias:

- **A** — `className` ou `style` inline em `.tsx` → substituir na 3B.
- **B** — CSS em `main.css` (ou outro `.css`) → substituir na 3B.
- **C** — outro contexto (dado/constante `.ts`, default de cor de categoria, comentário, teste, manifest/index.html, prop de marca SVG) → NÃO substituir, só listar.

Método: cada busca `grep` foi limitada a 300 linhas. Os valores marcados como **fechado** foram contados linha a linha. Os marcados como **parcial** tiveram só uma amostra verificada; a contagem exata deve ser refeita pela 3B com `grep -c` por arquivo antes da migração.

---

## 1. Valores com contagem fechada

### 1.1 `rgba(20,33,61,0.06)` / `rgba(20,33,61,0.05)` — 46 ocorrências (fechado)

| Arquivo                                              | Linha(s)                                     | Categoria      |
| ---------------------------------------------------- | -------------------------------------------- | -------------- |
| src/**tests**/visual-language-r56.test.ts            | 15                                           | C (teste)      |
| src/main.css                                         | 57, 98                                       | C (comentário) |
| src/main.css                                         | 633, 638                                     | B              |
| src/components/documents/AddDocumentModal.tsx        | 319                                          | A              |
| src/components/documents/DocumentExplorerGrid.tsx    | 164                                          | A              |
| src/components/documents/DocumentItemCard.tsx        | 342, 343                                     | A              |
| src/components/documents/DocumentScannerModal.tsx    | 621                                          | A              |
| src/components/documents/DocumentViewerModal.tsx     | 355, 377                                     | A              |
| src/components/transactions/NewTransactionDialog.tsx | 796, 830, 878, 964, 1025                     | A              |
| src/components/wallet/BudgetOverviewCard.tsx         | 169                                          | A              |
| src/pages/DocumentsPage.tsx                          | 48                                           | A              |
| src/pages/Goals.tsx                                  | 232, 267                                     | A              |
| src/pages/Home.tsx                                   | 1075, 1218, 1310                             | A              |
| src/pages/Patrimony.tsx                              | 500, 560, 723, 805, 862                      | A              |
| src/pages/Profile.tsx                                | 864, 926, 1056, 1219, 1269, 1316, 1484, 1697 | A              |
| src/pages/SharedDocumentPage.tsx                     | 127, 133, 161                                | A              |
| src/pages/wallet/WalletBudgetsTab.tsx                | 155                                          | A              |
| src/pages/wallet/WalletTransactionsTab.tsx           | 79, 240, 250, 260, 353                       | A              |

Subtotal: **A = 41, B = 2, C = 3**.

### 1.2 `shadow-curiango` (classe Tailwind) — 16 ocorrências (fechado)

Todas são `className` → **A**.

| Arquivo                                                     | Linha(s)      |
| ----------------------------------------------------------- | ------------- |
| src/components/brand/CopilotTypingBubble.tsx                | 33            |
| src/components/categories/ContextualSubcategorySelector.tsx | 470           |
| src/components/documents/DocumentScannerModal.tsx           | 366           |
| src/components/transactions/NewTransactionDialog.tsx        | 796, 878, 964 |
| src/components/transactions/TransactionDetailDialog.tsx     | 38            |
| src/components/wallet/BulkCategoryDialog.tsx                | 111           |
| src/components/wallet/CategoryTransactionsDrawer.tsx        | 131           |
| src/pages/Copilot.tsx                                       | 1979, 2046    |
| src/pages/Home.tsx                                          | 1356          |
| src/pages/wallet/WalletProjectionTab.tsx                    | 276           |
| src/pages/wallet/WalletTransactionsTab.tsx                  | 167, 196, 388 |

Subtotal: **A = 16, B = 0, C = 0**.

### 1.3 `#F8F9FB` — 46 ocorrências (fechado)

| Arquivo                                               | Linha(s)                | Categoria      |
| ----------------------------------------------------- | ----------------------- | -------------- |
| src/**tests**/pwa-manifest.test.ts                    | 8, 9                    | C (teste)      |
| src/**tests**/sw-and-theme-hardening-r60.test.ts      | 34, 35, 36, 54, 56, 61  | C (teste)      |
| src/**tests**/theme-consistency-r54.test.ts           | 12, 13, 14, 19          | C (teste)      |
| src/main.css                                          | 22, 30, 281, 287, 313   | B              |
| src/main.css                                          | 51                      | C (comentário) |
| src/pages/Home.tsx                                    | 670                     | A              |
| src/pages/Home.tsx                                    | 942                     | C (comentário) |
| src/pages/Login.tsx                                   | 27                      | C (comentário) |
| src/pages/Login.tsx                                   | 340                     | A              |
| src/pages/Legal.tsx                                   | 19                      | A              |
| src/pages/ResetPassword.tsx                           | 140, 152                | A              |
| src/pages/SharedDocumentPage.tsx                      | 108                     | A              |
| src/components/documents/AddDocumentModal.tsx         | 221, 236, 251, 319      | A              |
| src/components/documents/DocumentExplorerGrid.tsx     | 264                     | A              |
| src/components/documents/DocumentScannerModal.tsx     | 412, 552, 571, 590, 621 | A              |
| src/components/documents/DocumentViewerModal.tsx      | 355, 377, 394, 577, 589 | A              |
| src/components/documents/ShareDocumentDialog.tsx      | 120                     | A              |
| src/components/transactions/ImportStatementDialog.tsx | 1980                    | A              |
| src/components/transactions/NewTransactionDialog.tsx  | 796, 878, 964           | A              |

Subtotal: **A = 26, B = 5, C = 15**.

### 1.4 `#94A3B8` — 3 ocorrências (fechado)

| Arquivo                                               | Linha(s)   | Categoria                      |
| ----------------------------------------------------- | ---------- | ------------------------------ |
| src/components/transactions/ImportStatementDialog.tsx | 2210, 2725 | A (fallback de cor em `style`) |
| src/main.css                                          | 55         | C (comentário)                 |

Subtotal: **A = 2, B = 0, C = 1**.

### 1.5 `#DDE3EC` — 0 ocorrências (fechado)

Nenhuma linha em `src/`.

---

## 2. Valores com contagem PARCIAL (amostra verificada)

Estes quatro valores ultrapassam o limite de linhas de uma busca. A lista abaixo traz só as linhas efetivamente vistas nos resultados; a 3B deve contar o restante com `grep -c`.

### 2.1 `#14213D` — centenas de ocorrências (parcial)

- Majoritariamente **A** (`text-[#14213D]`, `bg-[#14213D]`, `from-[#14213D]` etc.).
- **C** observado: `src/components/wallet/BudgetOverviewCard.tsx` 171 é A (gradiente de classe), mas os testes `src/components/common/__tests__/CategoryIcon.test.tsx` e `src/components/brand/__tests__/CuriangoLogo.test.tsx` são C (teste) e o logo `src/components/brand/CuriangoLogo.tsx` define a cor da marca como default de prop/SVG → **C, decidir na 3B se a marca fica fixa**.
- Amostra verificada de A: `src/pages/Profile.tsx` 1133 (`text-[#14213D]`), `src/pages/Home.tsx` 1356 (`text-[#14213D]` no botão), `src/pages/SharedDocumentPage.tsx` 108 (`text-[#14213D]`), `src/pages/wallet/WalletProjectionTab.tsx` 276 (`bg-[#14213D]`).

### 2.2 `#FCA311` — centenas de ocorrências (parcial)

- Majoritariamente **A** (botões primários, anéis de foco, `selection:bg-[#FCA311]/20`).
- Amostra verificada de A: `src/pages/Home.tsx` 1356; `src/components/wallet/BudgetOverviewCard.tsx` 171 (gradiente); `src/pages/Login.tsx` 340 e `src/pages/ResetPassword.tsx` 152 (`selection:`); `src/components/documents/DocumentItemCard.tsx` 342 (`hover:border-[#FCA311]/60`).
- Não confirmado linha a linha: quaisquer usos em `.ts` (C) — a 3B deve checar com `grep -c`.

### 2.3 `#64748B` — dezenas de ocorrências (parcial)

- Majoritariamente **A** (`text-[#64748B]`, `hover:text-[#64748B]`).
- **C** verificado: `src/services/family.ts` 701 — default de cor de categoria `'#64748B'` (dado).

### 2.4 `#059669` / `#E11D48` / `#10B981` — centenas somadas (parcial, amostra verificada)

Semântica financeira (receita verde / despesa rosa). Padrão observado:

- **A** (className ou `style` inline): `text-[#059669]`, `text-[#E11D48]`, `bg-[#059669]`, `bg-gradient-to-r from-[#10B981]…`, `backgroundColor: c.color || '#10B981'` (fallback em `style`).
  - Exemplos verificados: `src/components/transactions/TransactionDetailDialog.tsx` 54, 92, 93, 97, 98, 105, 166; `src/components/transactions/TransactionInlineRow.tsx` 373, 525, 556, 575, 623, 626; `src/components/wallet/SwipeReviewDeck.tsx` 310, 320, 326, 364, 394, 442, 452; `src/pages/wallet/WalletTransactionsTab.tsx` 113, 124, 145, 153, 241, 245, 251, 255, 267, 541, 544, 572; `src/pages/Goals.tsx` 275, 329; `src/pages/Home.tsx` 1142, 1199, 1456; `src/pages/Profile.tsx` 1133, 1145; `src/components/wallet/BudgetOverviewCard.tsx` 98, 99, 104, 171, 222, 227, 228, 333, 334; `src/components/documents/DeleteDocumentConfirmDialog.tsx` 81, 124; `src/components/documents/DocumentViewerModal.tsx` 278, 316, 603, 616, 659; `src/components/import/ImportItemEditor.tsx` 86, 87, 254, 279, 336, 365; `src/components/import/ImportItemList.tsx` 144, 225; `src/components/import/ImportQuickFilters.tsx` 71, 77; `src/components/wallet/BudgetAlertsFarol.tsx` 276, 389; `src/components/wallet/CategoryTransactionsDrawer.tsx` 216, 221, 226, 267; `src/components/wallet/BulkCategoryDialog.tsx` 151, 169; `src/pages/SharedDocumentPage.tsx` 134, 194; `src/components/documents/DocumentItemCard.tsx` 394, 462.
- **C** (dados/constantes `.ts`, paletas, mapas de cor):
  - `src/services/onboarding.ts` 266, 881, 941 (cores das categorias padrão);
  - `src/services/family.ts` 701 (default de cor);
  - `src/types/budget-presets.ts` 79;
  - `src/types/finance.ts` 111, 303, 333, 351, 400;
  - `src/pages/Investments.tsx` 63 (mapa de cor por tipo de ativo);
  - `src/pages/Patrimony.tsx` 77, 78, 249 (cores de alocação/gráfico);
  - `src/components/categories/CategoryEditorPopover.tsx` 28, 29 (paleta), 140 (default);
  - `src/components/categories/CategoryHighlightChip.tsx` 53, 55 (fallback de dado);
  - `src/components/common/CategoryIcon.tsx` 150 (mapa de harmonização `'#F43F5E': '#E11D48'`);
  - `src/components/transactions/ImportStatementDialog.tsx` 167, 168 (paleta);
  - `src/components/transactions/VoiceTransactionDialog.tsx` 2601, 2832 (arrays de cor — confirmar contexto na 3B);
  - `src/pages/Wallet.tsx` 217 (estado inicial de cor).
- **C** (testes): `src/components/brand/__tests__/CopilotTypingBubble.test.tsx` 14–15; `src/components/common/__tests__/CategoryIcon.test.tsx` 22, 32; `src/pages/__tests__/ImportReviewPage.test.tsx` 24; `src/services/import/__tests__/statement-parser.test.ts` 326; `src/components/wallet/__tests__/BudgetAlertsFarol.test.tsx` 43.
- **B** (CSS): `src/main.css` 90, 94, 155, 156 — comentários com hex e valores em HSL (os comentários são C; a 3B deve avaliar se os valores HSL mudam). Comentários em `main.css` 58, 59 → C.

---

## 3. Totais

### 3.1 Por categoria (somente valores fechados)

| Categoria         | Ocorrências                                                            |
| ----------------- | ---------------------------------------------------------------------- |
| A                 | 41 (rgba) + 16 (shadow-curiango) + 26 (#F8F9FB) + 2 (#94A3B8) = **85** |
| B                 | 2 (rgba) + 5 (#F8F9FB) = **7**                                         |
| C                 | 3 (rgba) + 15 (#F8F9FB) + 1 (#94A3B8) = **19**                         |
| **Total fechado** | **111**                                                                |

### 3.2 Por valor

| Valor                       | Total            | Situação                                                       |
| --------------------------- | ---------------- | -------------------------------------------------------------- |
| rgba(20,33,61,0.06) + 0.05  | 46               | fechado (A 41, B 2, C 3)                                       |
| shadow-curiango             | 16               | fechado (A 16)                                                 |
| #F8F9FB                     | 46               | fechado (A 26, B 5, C 15)                                      |
| #94A3B8                     | 3                | fechado (A 2, C 1)                                             |
| #DDE3EC                     | 0                | fechado (zero)                                                 |
| #14213D                     | centenas         | parcial — A majoritário                                        |
| #FCA311                     | centenas         | parcial — A majoritário                                        |
| #64748B                     | dezenas          | parcial — A majoritário; C = `family.ts` 701                   |
| #059669 / #E11D48 / #10B981 | centenas somadas | parcial — A majoritário; C = constantes `.ts`, paletas, testes |

### 3.3 Leitura para a 3B

- Valores fechados: 111 ocorrências — 85 A (substituir), 7 B (substituir em CSS), 19 C (preservar).
- Valores parciais são a maior parte do trabalho. Antes de migrar, a 3B precisa de contagem exata por arquivo.
- Preservar obrigatoriamente (C): testes (`src/__tests__/*`, `*__tests__*`), manifest/`index.html` nos testes de tema, paletas e defaults em `onboarding.ts`, `family.ts`, `finance.ts`, `budget-presets.ts`, mapa de harmonização em `CategoryIcon.tsx`.
- Decidir na 3B: cores fixas do logo (`CuriangoLogo.tsx`) e fallbacks `c.color || '#10B981'` em `style` (A tecnicamente, mas com valor de dado).
