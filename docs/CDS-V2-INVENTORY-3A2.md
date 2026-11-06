# CDS v2.0 — Inventário 3A-2 (somente leitura; fecha os 6 hex da rodada 3A)

Objetivo: fechar a contagem exata dos 6 valores que ficaram parciais na rodada 3A
(`#14213D`, `#FCA311`, `#64748B`, `#059669`, `#E11D48`, `#10B981`).
Nenhum arquivo de código foi alterado. Este documento é o único arquivo novo.

Categorias (mesmas da 3A):

- **A** — `className` ou `style` inline em `.tsx` → substituir na 3B.
- **B** — CSS em `main.css` (ou outro `.css`) → substituir na 3B.
- **C** — outro contexto que NÃO deve ser substituído na 3B: comentário, default/paleta de
  dado em `.ts`, fallback de cor, prop de marca do logo, arquivo de teste.

## Método e escopo (leitura honesta dos números)

- As buscas desta rodada varreram **linha a linha, sem amostragem**: `src/pages/**` (todas
  as `.tsx` da raiz de pages, incluindo testes) e os grupos `src/components/{brand,categories,
documents,transactions,wallet,import}`. A contagem por ocorrência (algumas linhas têm o hex
  2–3×) está nas tabelas abaixo.
- `src/main.css` foi lido diretamente até a linha 400; o trecho 401–655 não foi relido nesta
  rodada (a 3A já mapeou os comentários dele). Onde isso afeta um total, está marcado.
- Os arquivos **fora** desse escopo (`src/components/common`, `notifications`, `onboarding`,
  `billing`, `Layout.tsx`, `contexts/`, `hooks/`, `services/`, `types/`) **herdam os
  achados verificados da rodada 3A** (listados por linha na 3A, seção 2.4) e estão marcados
  como "herdado 3A" — a 3B deve reconfirmar com `grep -c` antes de migrar.
- `pages/Wallet.tsx` e `pages/ImportReviewPage.tsx`: **0 ocorrências** de `#14213D` e `#FCA311`
  (varredura completa).

---

## 1. `#14213D` (azul-marinho CDS v1.0) — 309 ocorrências no escopo varrido

### 1.1 Por arquivo (linha a linha)

| Arquivo                                              | Linha(s)                                                                                                                                                                                                                             | Occ.            | Categoria |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | --------- |
| components/brand/CuriangoLogo.tsx                    | 11, 24, 28, 98, 107, 112 (comentários/defaults), 177, 178, 202 (`fill` SVG)                                                                                                                                                          | 9               | C (marca) |
| components/brand/\_\_tests\_\_/CuriangoLogo.test.tsx | 15                                                                                                                                                                                                                                   | 1               | C (teste) |
| components/categories/CategoryEditorPopover.tsx      | 600                                                                                                                                                                                                                                  | 1               | A         |
| components/categories/CategoryManagementDialog.tsx   | 351, 528, 675                                                                                                                                                                                                                        | 3               | A         |
| components/categories/SubcategoryEditorPopover.tsx   | 291                                                                                                                                                                                                                                  | 1               | A         |
| components/documents/AddDocumentModal.tsx            | 174, 215, 226, 241, 256, 304, 329, 357                                                                                                                                                                                               | 8               | A         |
| components/documents/DeleteDocumentConfirmDialog.tsx | 84, 135                                                                                                                                                                                                                              | 2               | A         |
| components/documents/DocumentCropCanvas.tsx          | 305                                                                                                                                                                                                                                  | 1               | A         |
| components/documents/DocumentExplorerGrid.tsx        | 169(×2), 213, 216, 218, 228, 247, 269, 280                                                                                                                                                                                           | 9               | A         |
| components/documents/DocumentItemCard.tsx            | 364, 486(×2), 505, 529, 545, 557, 576, 589, 650, 667, 686                                                                                                                                                                            | 13              | A         |
| components/documents/DocumentScannerModal.tsx        | 369, 377, 411(×2), 481, 501, 534, 541, 551(×2), 570(×2), 589(×2), 610, 625, 639, 657, 685, 695, 707                                                                                                                                  | 20              | A         |
| components/documents/DocumentViewerModal.tsx         | 287, 320, 329, 338, 370, 382, 396, 407, 432, 462(×2), 592, 619, 670                                                                                                                                                                  | 15              | A         |
| components/documents/ShareDocumentDialog.tsx         | 98, 110, 119(×2)                                                                                                                                                                                                                     | 4               | A         |
| components/transactions/ImportStatementDialog.tsx    | 1595, 1941, 1968, 1972                                                                                                                                                                                                               | 4               | A         |
| components/transactions/NewTransactionDialog.tsx     | 808, 810, 842(×2), 843, 848, 919, 920, 925(×2), 977, 978, 983, 986, 989, 1034(×2), 1035, 1044, 1059, 1060, 1066, 1072                                                                                                                | 24              | A         |
| components/transactions/TransactionDetailDialog.tsx  | 50, 78, 121, 131, 148, 180                                                                                                                                                                                                           | 6               | A         |
| components/transactions/TransactionInlineRow.tsx     | 683                                                                                                                                                                                                                                  | 1               | A         |
| components/transactions/VoiceTransactionDialog.tsx   | 3387, 3404, 3448, 3457, 3461(×2), 3476, 3495                                                                                                                                                                                         | 9               | A         |
| components/wallet/BudgetOverviewCard.tsx             | 70, 76, 171, 208, 236, 268, 301, 359                                                                                                                                                                                                 | 8               | A         |
| components/wallet/CategoryTransactionsDrawer.tsx     | 144, 168, 193, 204, 253(×2)                                                                                                                                                                                                          | 6               | A         |
| components/wallet/SwipeReviewDeck.tsx                | 178 (`eyeColor` prop)                                                                                                                                                                                                                | 1               | C (marca) |
| pages/Copilot.tsx                                    | 2207, 2222, 2264, 2273, 2277(×2), 2308                                                                                                                                                                                               | 8               | A         |
| pages/DocumentsPage.tsx                              | 34                                                                                                                                                                                                                                   | 1               | A         |
| pages/Goals.tsx                                      | 233, 280, 313                                                                                                                                                                                                                        | 3               | A         |
| pages/Home.tsx                                       | 648(×2), 651, 674, 711, 787, 808, 814, 828, 835, 860, 1017, 1026, 1053, 1060, 1083, 1087, 1101(×2), 1120, 1222, 1226, 1278, 1294, 1313, 1323(×2), 1356, 1392(×2), 1427, 1439 (A) · 671, 1003, 1045, 1291 (comentário/`eyeColor` = C) | 35 (31 A + 4 C) | A + C     |
| pages/InviteAcceptPage.tsx                           | 208, 211, 214, 282, 456                                                                                                                                                                                                              | 5               | A         |
| pages/Investments.tsx                                | 297 (comentário)                                                                                                                                                                                                                     | 1               | C         |
| pages/Legal.tsx                                      | 20, 62, 63, 244, 251, 268, 309, 353                                                                                                                                                                                                  | 8               | A         |
| pages/Login.tsx                                      | 376, 394, 395(×2), 401, 420, 432, 438, 449, 439, 450, 465, 474, 486, 495, 683, 831, 847, 880, 889, 894, 901 (A) · 25 (comentário = C)                                                                                                | 23 (22 A + 1 C) | A + C     |
| pages/Patrimony.tsx                                  | 388, 412, 576, 591(×2), 601, 739, 1032, 1034                                                                                                                                                                                         | 10              | A         |
| pages/Profile.tsx                                    | 876, 972, 1133, 1351, 1359, 1523, 1636, 1667, 1684, 2243, 2269                                                                                                                                                                       | 11              | A         |
| pages/ResetPassword.tsx                              | 169, 178 (A) · 164 (`eyeColor` = C)                                                                                                                                                                                                  | 3 (2 A + 1 C)   | A + C     |
| pages/SharedDocumentPage.tsx                         | 108, 112, 115, 129, 138, 144, 170, 198, 205, 214, 227                                                                                                                                                                                | 11              | A         |
| pages/\_\_tests\_\_/Copilot.test.tsx                 | 32                                                                                                                                                                                                                                   | 1               | C (teste) |
| pages/\_\_tests\_\_/Home.test.tsx                    | 150, 159                                                                                                                                                                                                                             | 2               | C (teste) |
| pages/wallet/WalletModals.tsx                        | 274, 330, 381(×2), 412(×2), 442, 637                                                                                                                                                                                                 | 9               | A         |
| pages/wallet/WalletProjectionTab.tsx                 | 276, 317, 329, 338, 353, 367, 392, 400, 412, 431, 438, 456                                                                                                                                                                           | 12              | A         |
| pages/wallet/WalletTransactionsTab.tsx               | 86, 173, 184, 284, 291, 357, 369, 371, 376, 392, 482(×2), 485, 523, 595                                                                                                                                                              | 16              | A         |
| pages/Wallet.tsx, pages/ImportReviewPage.tsx         | —                                                                                                                                                                                                                                    | 0               | —         |

**Herdado 3A (fora do escopo varrido):** `main.css` 23, 31, 44, 282, 288, 314 → **B**
(`color: #14213d` na blindagem light-only; relidas nesta rodada, confirmadas) · comentários
`main.css` 53, 59, 70, 122 → **C**. Fora do lido (401–655): não recensusado.

**Subtotal no escopo: A = 286 · B = 0 · C = 23** (+ B 6 e C 4 de `main.css` 1–400, confirmados).

### 1.2 FUNDO vs TEXTO/BORDA (#14213D, escopo varrido)

- **FUNDO sólido ≈ 59**: `bg-[#14213D]`, `from-[#14213D]`, `fill` — CuriangoLogo 177, 178, 202;
  AddDocumentModal 357; DocumentCropCanvas 305; DocumentExplorerGrid 169, 247, 280;
  DocumentItemCard 486(×2), 529; DocumentScannerModal 411, 501, 551, 570, 589, 707;
  DocumentViewerModal 329, 432, 462; ImportStatementDialog 1595, 1941, 1968;
  NewTransactionDialog 842, 925; TransactionDetailDialog 180; VoiceTransactionDialog 3461;
  BudgetOverviewCard 70, 76, 171, 301; CategoryTransactionsDrawer 253; Copilot 2277 (`fill`);
  Home 648, 674, 835, 860, 1120, 1294, 1427; Legal 20; Login 376, 465, 486; Patrimony 388, 591;
  Profile 1351, 1523, 2269; SharedDocumentPage 112, 205, 227; WalletModals 381, 412;
  WalletProjectionTab 276, 329; WalletTransactionsTab 291.
- **BORDA/RING ≈ 19**: DocumentExplorerGrid 169; DocumentScannerModal 411, 551, 570, 589;
  DocumentViewerModal 462; NewTransactionDialog 842, 1034; Home 787 (`ring`); Legal 62, 244, 309;
  Login 394, 395(×2), 432; ResetPassword 178; CategoryTransactionsDrawer 253; WalletModals 381, 412.
- **SOMBRAS com o hex (nem fundo nem texto, ~2)**: Home 648, InviteAcceptPage 208.
- **TEXTO ≈ 206**: todo o restante (`text-[#14213D]`, `hover:text-`, `group-hover:text-`,
  `eyeColor` como texto do olho etc.) — a esmagadora maioria do valor é texto.

---

## 2. `#FCA311` (âmbar Curiango) — 159 ocorrências no escopo varrido

### 2.1 Por arquivo (linha a linha)

| Arquivo                                              | Linha(s)                                                                                                                                                     | Occ.            | Categoria |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | --------- |
| components/brand/CuriangoLogo.tsx                    | 24 (comentário)                                                                                                                                              | 1               | C         |
| components/categories/CategoryEditorPopover.tsx      | 600                                                                                                                                                          | 1               | A (`bg-`) |
| components/categories/CategoryManagementDialog.tsx   | 351, 528, 675                                                                                                                                                | 3               | A (`bg-`) |
| components/categories/SubcategoryEditorPopover.tsx   | 291                                                                                                                                                          | 1               | A (`bg-`) |
| components/import/ImportConfirmationFooter.tsx       | 79                                                                                                                                                           | 1               | A (`bg-`) |
| components/import/ImportItemEditor.tsx               | 106, 359, 383                                                                                                                                                | 3               | A         |
| components/import/ImportItemList.tsx                 | 124, 126, 132, 134, 162, 177                                                                                                                                 | 6               | A         |
| components/import/ImportQuickFilters.tsx             | 64, 85, 116, 141                                                                                                                                             | 4               | A         |
| components/transactions/ImportStatementDialog.tsx    | 1595, 1972                                                                                                                                                   | 2               | A         |
| components/transactions/NewTransactionDialog.tsx     | 919(×2), 983, 1059(×2), 1066                                                                                                                                 | 6               | A         |
| components/transactions/TransactionInlineRow.tsx     | 683                                                                                                                                                          | 1               | A         |
| components/wallet/BudgetOverviewCard.tsx             | 171 (gradiente)                                                                                                                                              | 1               | A         |
| pages/Copilot.tsx                                    | 2252, 2317                                                                                                                                                   | 2               | A         |
| pages/Home.tsx                                       | 648, 660(×2), 678, 694, 698, 711, 764, 773, 782, 787, 808(×2), 828(×2), 987, 1039, 1060, 1104, 1131, 1326, 1356 (A) · 1002, 1044 (`color=` prop do logo = C) | 26 (24 A + 2 C) | A + C     |
| pages/InviteAcceptPage.tsx                           | 282(×2), 456(×2)                                                                                                                                             | 4               | A         |
| pages/Legal.tsx                                      | 185, 268, 283, 293, 328(×2), 337(×2), 347(×2), 353 (A) · 31 (prop do logo = C)                                                                               | 12 (11 A + 1 C) | A + C     |
| pages/Login.tsx                                      | 340, 381, 413, 414(×2), 616, 618, 651, 653, 689, 691, 757, 759, 831, 847 (A) · 643 (comentário = C)                                                          | 17 (16 A + 1 C) | A + C     |
| pages/Patrimony.tsx                                  | 390, 412, 467, 576, 601, 739, 1032                                                                                                                           | 7               | A         |
| pages/Profile.tsx                                    | 876, 972, 1080, 1343, 1351, 1359, 1388(×2), 1536, 1636(×3), 1667(×3), 1684(×3) (A) · 1525 (prop do logo = C)                                                 | 21 (20 A + 1 C) | A + C     |
| pages/ResetPassword.tsx                              | 142, 152, 198(×2), 200, 264(×2), 266, 310 (A) · 163 (prop), 190 (comentário) = C                                                                             | 12 (10 A + 2 C) | A + C     |
| pages/SharedDocumentPage.tsx                         | 128, 208, 218, 229 (A) · 113 (prop do logo = C)                                                                                                              | 5 (4 A + 1 C)   | A + C     |
| pages/wallet/WalletHeader.tsx                        | 70                                                                                                                                                           | 1               | A         |
| pages/wallet/WalletModals.tsx                        | 274, 330(×2), 442, 637                                                                                                                                       | 5               | A         |
| pages/wallet/WalletProjectionTab.tsx                 | 348, 353, 438                                                                                                                                                | 3               | A         |
| pages/wallet/WalletTransactionsTab.tsx               | 184, 284(×2), 376, 599                                                                                                                                       | 5               | A         |
| pages/\_\_tests\_\_/Copilot.test.tsx                 | 22                                                                                                                                                           | 1               | C (teste) |
| pages/\_\_tests\_\_/Login.test.tsx                   | 141, 154, 158, 167                                                                                                                                           | 4               | C (teste) |
| pages/\_\_tests\_\_/LoginReferenceAlignment.test.tsx | 87, 96, 97, 101, 102, 175                                                                                                                                    | 6               | C (teste) |
| pages/\_\_tests\_\_/ResetPassword.test.tsx           | 25, 44, 48                                                                                                                                                   | 3               | C (teste) |
| pages/Wallet.tsx, pages/ImportReviewPage.tsx         | —                                                                                                                                                            | 0               | —         |

**Herdado 3A / lido em main.css:** comentários `main.css` 56, 59, 74, 78 → **C** (confirmados
na releitura 1–400). `services/onboarding.ts`, `types/*` etc.: sem ocorrência confirmada até
agora; a 3B deve reconfirmar com `grep -c`.

**Subtotal no escopo: A = 138 · B = 0 · C = 21** (+ C 4 em comentários de `main.css`).

### 2.2 FUNDO vs TEXTO/BORDA (#FCA311, escopo varrido)

- **FUNDO sólido ≈ 55**: `bg-[#FCA311]`, `from-[#FCA311]`, `selection:bg-[#FCA311]`,
  `bg-[#FCA311]/opacidade` — categories 600, 351, 528, 675, 291 (5); import 79, 359 (2);
  ImportStatementDialog 1972, NewTransactionDialog 919, 983, 1066, TransactionInlineRow 683 (5);
  BudgetOverviewCard 171 (1); Copilot 2252 (1); Home 660, 678, 711, 787, 808, 828, 1060, 1131,
  1356 (9); InviteAcceptPage 282, 456 (2); Legal 353 (1); Login 340, 831, 847 (3); Patrimony 390,
  412, 576, 601, 1032 (5); Profile 876, 972, 1080, 1359, 1636(×2 bg), 1667(×2), 1684(×2) (10);
  ResetPassword 152, 310 (2); WalletModals 274, 330, 442, 637 (4); WalletProjectionTab 353 (1);
  WalletTransactionsTab 184, 284, 376 (3).
- **BORDA/RING ≈ 33**: Home 694, 698, 764, 782, 987, 1039 (6); Legal 328(×2), 337(×2), 347(×2) (6);
  Login 413, 414(×2), 616, 651, 689, 757 (6); Profile 1343 (1); ResetPassword 198(×2), 264(×2) (4);
  WalletProjectionTab 348 (1); WalletModals 330 (1); WalletTransactionsTab 284 (1); import
  124, 132, 162, 116 (4); NewTransactionDialog 919, 1059(×2) (3).
- **TEXTO/STROKE ≈ 50**: o restante (`text-[#FCA311]`, `hover:text-`, `stroke`, ícones Sparkles/
  AlertTriangle/Send, Loader2 etc.).

---

## 3. `#64748B` (slate-500) — 24 ocorrências no escopo varrido

| Arquivo                                                               | Linha(s)                                           | Occ.          | Categoria          |
| --------------------------------------------------------------------- | -------------------------------------------------- | ------------- | ------------------ |
| components/transactions/ImportStatementDialog.tsx                     | 169                                                | 1             | C (paleta de dado) |
| components/transactions/NewTransactionDialog.tsx                      | 799, 819, 857, 882, 883, 967, 978, 999, 1012, 1035 | 10            | A                  |
| components/transactions/VoiceTransactionDialog.tsx                    | 1232, 2391 (arrays de cor), 3448 (A)               | 3 (1 A + 2 C) | A + C              |
| components/transactions/\_\_tests\_\_/VoiceTransactionDialog.test.tsx | 1230                                               | 1             | C (teste)          |
| components/wallet/ApplyBudgetModelDialog.tsx                          | 462 (`\|\| '#64748B'`)                             | 1             | C (fallback)       |
| pages/Copilot.tsx                                                     | 2264                                               | 1             | A                  |
| pages/Investments.tsx                                                 | 66 (const), 416 (fallback)                         | 2             | C                  |
| pages/Patrimony.tsx                                                   | 82 (const), 242, 627 (fallbacks)                   | 3             | C                  |
| pages/wallet/WalletBudgetsTab.tsx                                     | 298 (`\|\| '#64748B'`)                             | 1             | C (fallback)       |

**Herdado 3A:** `services/family.ts` 701 → C (default de cor de categoria) · comentários
`main.css` 54, 82 → C (confirmados na releitura).

**Subtotal no escopo: A = 12 · B = 0 · C = 12** (+ C 2 herdado 3A + C 2 comentários main.css).

---

## 4. `#059669` (verde receita) — 35 ocorrências no escopo varrido

| Arquivo                                                    | Linha(s)                                   | Occ. | Categoria         |
| ---------------------------------------------------------- | ------------------------------------------ | ---- | ----------------- |
| components/import/ImportItemEditor.tsx                     | 86, 336, 365                               | 3    | A                 |
| components/import/ImportItemList.tsx                       | 144, 225                                   | 2    | A                 |
| components/import/ImportQuickFilters.tsx                   | 77                                         | 1    | A                 |
| components/transactions/ImportStatementDialog.tsx          | 168                                        | 1    | C (paleta)        |
| components/transactions/TransactionDetailDialog.tsx        | 54, 92, 93, 105                            | 4    | A                 |
| components/transactions/TransactionInlineRow.tsx           | 623(×2), 626                               | 3    | A                 |
| components/wallet/BudgetOverviewCard.tsx                   | 99, 227, 228                               | 3    | A                 |
| components/wallet/CategoryTransactionsDrawer.tsx           | 216, 226                                   | 2    | A                 |
| components/wallet/SwipeReviewDeck.tsx                      | 310, 452                                   | 2    | A                 |
| components/wallet/\_\_tests\_\_/BudgetAlertsFarol.test.tsx | 43                                         | 1    | C (teste)         |
| pages/Home.tsx                                             | 1456                                       | 1    | A                 |
| pages/Profile.tsx                                          | 1133, 1145                                 | 2    | A                 |
| pages/Patrimony.tsx                                        | 78                                         | 1    | C (const de dado) |
| pages/wallet/WalletTransactionsTab.tsx                     | 113(×2), 124, 145, 153, 241, 245, 267, 541 | 9    | A                 |

**Herdado 3A:** `services/onboarding.ts` 266; `types/finance.ts` (111, 303, 333, 351, 400);
`types/budget-presets.ts` 79; comentários/valores `main.css` 58, 94, 95 → C (comentários
confirmados na releitura; o valor `--success` é canal HSL, não hex).

**Subtotal no escopo: A = 32 · B = 0 · C = 3.**

---

## 5. `#E11D48` (bordeaux despesa) — 24 ocorrências no escopo varrido

| Arquivo                                             | Linha(s)                | Occ. | Categoria |
| --------------------------------------------------- | ----------------------- | ---- | --------- |
| components/import/ImportItemEditor.tsx              | 87                      | 1    | A         |
| components/import/ImportQuickFilters.tsx            | 71                      | 1    | A         |
| components/transactions/TransactionDetailDialog.tsx | 97, 98, 105, 166        | 4    | A         |
| components/transactions/TransactionInlineRow.tsx    | 373                     | 1    | A         |
| components/wallet/BudgetAlertsFarol.tsx             | 276 (`bg-`), 389        | 2    | A         |
| components/wallet/BudgetOverviewCard.tsx            | 222, 223                | 2    | A         |
| components/wallet/CategoryTransactionsDrawer.tsx    | 216, 221, 267           | 3    | A         |
| components/wallet/SwipeReviewDeck.tsx               | 310, 320, 442(×2)       | 4    | A         |
| pages/Home.tsx                                      | 1199 (gradiente)        | 1    | A         |
| pages/wallet/WalletTransactionsTab.tsx              | 251, 255, 267, 544, 572 | 5    | A         |

**Herdado 3A:** `types/finance.ts` 111, 303, 333, 351, 400; `common/CategoryIcon.tsx` 150
(mapa `'#F43F5E': '#E11D48'`); `services/onboarding.ts`; comentários `main.css` 58, 90 (o valor
`--destructive` é canal HSL).

**Subtotal no escopo: A = 24 · B = 0 · C = 0.**

---

## 6. `#10B981` (verde Metas) — 24 ocorrências no escopo varrido

| Arquivo                                                    | Linha(s)                  | Occ. | Categoria         |
| ---------------------------------------------------------- | ------------------------- | ---- | ----------------- |
| components/import/ImportItemEditor.tsx                     | 254, 279 (fallbacks)      | 2    | C (fallback)      |
| components/transactions/ImportStatementDialog.tsx          | 167                       | 1    | C (paleta)        |
| components/transactions/TransactionInlineRow.tsx           | 525, 556, 575 (fallbacks) | 3    | C (fallback)      |
| components/wallet/BudgetOverviewCard.tsx                   | 98, 104, 171, 333, 334    | 5    | A                 |
| components/wallet/BulkCategoryDialog.tsx                   | 151, 169 (fallbacks)      | 2    | C (fallback)      |
| components/wallet/SwipeReviewDeck.tsx                      | 364, 394 (fallbacks)      | 2    | C (fallback)      |
| components/wallet/\_\_tests\_\_/BudgetAlertsFarol.test.tsx | 43                        | 1    | C (teste)         |
| pages/Goals.tsx                                            | 275, 329                  | 2    | A                 |
| pages/Home.tsx                                             | 1142 (gradiente)          | 1    | A                 |
| pages/Investments.tsx                                      | 63                        | 1    | C (const de dado) |
| pages/Patrimony.tsx                                        | 77, 249                   | 2    | C (const de dado) |
| pages/wallet/WalletModals.tsx                              | 606 (fallback)            | 1    | C (fallback)      |

**Herdado 3A:** `services/onboarding.ts` 881, 941; `types/finance.ts`; `types/budget-presets.ts`
79; `categories/CategoryHighlightChip.tsx` 53, 55; `VoiceTransactionDialog.tsx` 2601, 2832;
`pages/Wallet.tsx` 217; comentário `main.css` 59.

**Subtotal no escopo: A = 8 · B = 0 · C = 16.**

---

## 7. Fallbacks de dado em `src/` (categoria C — NÃO substituir na 3B)

Varredura EXAUSTIVA feita nesta rodada, com 4 padrões:

1. `\.color \|\|` — 29 ocorrências (lista completa abaixo);
2. `\?\? '#` — **0 ocorrências**;
3. `\.color \?\?` — **0 ocorrências**;
4. `defaultColor|DEFAULT_COLOR|default_color` — **0 ocorrências**.

Lista completa (arquivo · linha · hex do fallback) — todos categoria C:

| Arquivo                                                 | Linha(s)      | Hex do fallback                                                |
| ------------------------------------------------------- | ------------- | -------------------------------------------------------------- |
| components/categories/CategoryEditorPopover.tsx         | 131           | `#3B82F6`                                                      |
| components/categories/CategoryHighlightChip.tsx         | 53            | `#059669`                                                      |
| components/categories/CategoryHighlightChip.tsx         | 55            | fallback derivado (`s.color \|\| categoryColor`)               |
| components/categories/CategoryManagementDialog.tsx      | 705           | `#64748B`                                                      |
| components/categories/ContextualSubcategorySelector.tsx | 284           | `#64748B`                                                      |
| components/categories/ContextualSubcategorySelector.tsx | 91, 111       | fallback encadeado (`s.color \|\| cat.color`)                  |
| components/import/ImportItemEditor.tsx                  | 254, 279      | `#10B981`                                                      |
| components/transactions/ImportStatementDialog.tsx       | 2210, 2725    | `#94A3B8`                                                      |
| components/transactions/ImportStatementDialog.tsx       | 2465, 2594    | `#3B82F6`                                                      |
| components/transactions/TransactionInlineRow.tsx        | 313           | `#F59E0B`                                                      |
| components/transactions/TransactionInlineRow.tsx        | 525, 556, 575 | `#10B981`                                                      |
| components/wallet/ApplyBudgetModelDialog.tsx            | 462           | `#64748B`                                                      |
| components/wallet/BulkCategoryDialog.tsx                | 151, 169      | `#10B981`                                                      |
| components/wallet/CategoryTransactionsDrawer.tsx        | 186           | fallback encadeado (`category?.color \|\| tx.category?.color`) |
| components/wallet/SwipeReviewDeck.tsx                   | 274           | `#F59E0B`                                                      |
| components/wallet/SwipeReviewDeck.tsx                   | 364, 394      | `#10B981`                                                      |
| pages/Home.tsx                                          | 587           | `null` (não-hex; fallback para dado, não cor fixa)             |
| pages/wallet/WalletBudgetsTab.tsx                       | 298           | `#64748B`                                                      |
| pages/wallet/WalletModals.tsx                           | 606           | `#10B981`                                                      |
| pages/Patrimony.tsx                                     | 242, 627      | `#64748B`                                                      |
| pages/Investments.tsx                                   | 416           | `#64748B`                                                      |

Novos hex de fallback que a 3A não tinha catalogado: `#3B82F6` (3×), `#F59E0B` (2×),
`#059669` como fallback (1×). Eles fazem parte da paleta de dados viva do app (cores de
categoria gravadas em transações) — trocá-los mudaria dado persistido/derivado, não estilo.

---

## 8. Totais consolidados

### 8.1 Por valor (esta rodada, escopo varrido)

| Valor           | Total                                           | A       | B     | C      |
| --------------- | ----------------------------------------------- | ------- | ----- | ------ |
| `#14213D`       | 309 (+6 B / +4 C confirmados em main.css 1–400) | 286     | 6     | 27     |
| `#FCA311`       | 159 (+4 C em comentários main.css)              | 138     | 0     | 25     |
| `#64748B`       | 24 (+2 C herdado 3A, +2 C comentários main.css) | 12      | 0     | 16     |
| `#059669`       | 35                                              | 32      | 0     | 3      |
| `#E11D48`       | 24 (+C herdado 3A em types/CategoryIcon)        | 24      | 0     | 0      |
| `#10B981`       | 24 (+C herdado 3A)                              | 8       | 0     | 16     |
| **Soma escopo** | **575**                                         | **500** | **6** | **69** |

### 8.2 FUNDO vs TEXTO/BORDA (para a 3B)

| Valor     | FUNDO sólido                                                          | TEXTO/BORDA                            |
| --------- | --------------------------------------------------------------------- | -------------------------------------- |
| `#FCA311` | ≈55 fundo sólido (borda/ring ≈33 e texto ≈50 detalhados na seção 2.2) | ≈83 (33 borda + 50 texto)              |
| `#14213D` | ≈59 fundo sólido (+3 fills do logo, categoria C-marca)                | ≈225 (206 texto + 19 borda + 2 sombra) |

### 8.3 Totais A/B/C gerais (combinado com a rodada 3A)

| Origem                                                                                                   | A       | B      | C      | Total   |
| -------------------------------------------------------------------------------------------------------- | ------- | ------ | ------ | ------- |
| Rodada 3A (valores fechados: `#F8F9FB`, `#94A3B8`, `#DDE3EC`, rgba(20,33,61,0.05/0.06), shadow-curiango) | 85      | 7      | 19     | 111     |
| Rodada 3A-2 (os 6 hex, escopo varrido)                                                                   | 500     | 6      | 69     | 575     |
| **Consolidado**                                                                                          | **585** | **13** | **88** | **686** |

Valores **herdados da 3A e ainda não recontados** (fora do escopo desta rodada):
`services/onboarding.ts` (266, 881, 941), `services/family.ts` (701), `types/finance.ts`
(111, 303, 333, 351, 400), `types/budget-presets.ts` (79), `common/CategoryIcon.tsx` (150),
`categories/CategoryHighlightChip.tsx` (53, 55), `VoiceTransactionDialog.tsx` (1232, 2391,
2601, 2832), `pages/Wallet.tsx` (217), `main.css` linhas 401–655. Somam-se a C; a 3B deve
reconfirmar com `grep -c` antes de migrar.

### 8.4 Leitura para a 3B

- O hex dominante é `#14213D` (~309) e `#FCA311` (~159) — praticamente tudo categoria A em
  `className`, substituível por tokens (`--ink`/`--text` e `--action`/âmbar conforme o mapa
  do CDS v2.0).
- `#14213D` é ~70% TEXTO e ~20% FUNDO; `#FCA311` é ~40% FUNDO e ~60% TEXTO/BORDA — o
  tratamento na 3B precisa diferenciar token de texto (`--text`) de token de fundo
  (`--bg`/`--data-*`).
- Categoria C intocável: paletas/defaults em `onboarding.ts`, `family.ts`, `finance.ts`,
  `budget-presets.ts`, `CategoryIcon.tsx`, `CategoryHighlightChip.tsx`, paletas de gráfico
  (`ImportStatementDialog` 167–169, `VoiceTransactionDialog`, `Investments`/`Patrimony`
  `ASSET_TYPE_COLORS`), testes, comentários e as cores fixas do logo (`CuriangoLogo.tsx` —
  decisão pendente da 3A: fixa ou token).
- Os 29 fallbacks da seção 7 são C: trocá-los mudaria dado persistido/derivado, não estilo.
