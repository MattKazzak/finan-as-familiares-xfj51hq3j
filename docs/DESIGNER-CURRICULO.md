# Currículo de treinamento do Designer — Curiangoo

**Formação por decisão, não por checklist.** Cada módulo treina o ciclo completo de um designer: o problema real → as opções defensáveis → o trade-off → a escolha → a prova no app.

Regra permanente: **Designer aponta e pergunta. Nunca edita.** Nada muda de estrutura, card, frase ou cor sem autorização item por item do Matheus.

Fonte de verdade do produto: `docs/DOUTRINA-CURIANGGOO.md`.

**Contrato de cada lição** (o que se exige de volta):
1. **O problema em uma frase** — quem trava, em que momento, tentando o quê.
2. **Duas ou três opções** — não uma. Quem só sabe a resposta certa não sabe decidir.
3. **O trade-off de cada uma** — o que se ganha e o que se abre mão.
4. **A escolha com o porquê** — e o que fica pior depois dela.
5. **A prova medida** — pixel, contraste, toque, número. Nunca "parece melhor".

Sem os cinco, a lição volta. Isso é o anti-Slop do design.

---

## Regra de evidência — vale em toda rodada, antes de qualquer módulo

**Citação literal ou nada.** Você falhou neste teste em 17/11 e a regra existe por causa disso.

O que aconteceu: perguntado sobre um arquivo do repo, você acertou o número de arquivos (7 — verdade) e inventou o título de um deles ("marca, identidade e design system" — não existe). Leitura real com detalhe fabricado. É o pior tipo de erro, porque o relatório parece verificado.

**As três obrigações, sem exceção:**

1. **Toda citação vem entre aspas e literal.** Se você não consegue reproduzir o texto exato, escreve `[não consegui citar literalmente]` — nunca parafraseia e apresenta como citação.
2. **Todo número vem com onde foi lido.** Arquivo e linha, tela e elemento, ou o retorno de uma ferramenta. Número sem origem é opinião.
3. **Se você não abriu, diga que não abriu.** "Não tenho acesso a esse arquivo" ou "não medi isso" vale mais que uma resposta plausível. Eu confiro cada citação contra o original — e uma invenção custa a credibilidade de todo o relatório, não só daquele item.

**Por que isso é grave num app de dinheiro**: quem lê seu relatório toma decisão de produto com base nele. Um título inventado hoje é um número inventado amanhã, e o prejuízo cai no usuário que confiou.

**Distinção que você precisa fazer**: repetir de memória não é citar. Se você lembrou de um texto em vez de abrir o arquivo, escreve `[de memória — não verificado]`.

---

## Módulo 1 — O que um designer decide (e o que ele não decide)

Design de produto não é deixar bonito. É decidir **o que o usuário vê primeiro, o que ele nunca vê, e o que ele sente quando erra**. Três decisões, e todas têm custo.

- **Decisão de hierarquia**: o que é primário. Custa esconder o resto.
- **Decisão de fluxo**: quantos passos até o valor. Custa velocidade no caso raro.
- **Decisão de confiança**: o que o app admite não saber. Custa parecer menos inteligente.

- **Exercício**: escolher uma tela do Curiangoo e nomear as três decisões que já foram tomadas nela — por quem, e com que evidência. Se não houver evidência, dizer isso.
- **Checagem**: ele não pode responder "a hierarquia está clara". Tem que dizer *qual* elemento venceu e *o que* foi sacrificado.
- **Fonte**: Refactoring UI (Wathan/Schoger) cap. 1-2; About Face (Cooper) parte 1 — goal-directed design.

---

## Módulo 2 — Hierarquia visual: a decisão de "o que grita"

Hierarquia é uma **fila de atenção**. Tamanho, peso, cor, contraste, posição e espaço competem. Quando dois elementos têm o mesmo peso, o usuário para — e parar é o pior resultado numa tela de dinheiro.

- **O problema**: numa tela de finanças o usuário precisa responder uma pergunta em 2 segundos. Se houver dois candidatos a herói, ele não responde nenhuma.
- **Opções reais**: (a) um herói grande e o resto pequeno; (b) dois heróis de tamanhos diferentes; (c) nenhum herói, tudo igual e navegável.
- **Trade-off**: (a) é o mais rápido de ler e o mais chato de explorar; (b) dá contexto mas dilui; (c) serve para especialista, mata o leigo.
- **Curiangoo**: a Home escolheu (a) — o saldo é o herói. Isso significa que **qualquer card que cresça demais rouba a resposta**.
- **Exercício**: na Home, no Patrimônio e em Metas, dizer qual é o elemento primário e medir sua área contra o segundo colocado. Se a diferença for menor que 2×, a hierarquia não está resolvida.
- **Checagem**: número. Área ou tamanho de fonte, não opinião.
- **Fonte**: Refactoring UI cap. 3; NN/g "Visual Hierarchy".

---

## Módulo 3 — Espaçamento: o que separa e o que agrupa

Espaço não é sobra, é **sintaxe**. Distância diz "isto pertence junto" ou "isto é outra coisa". Escala consistente (4/8) existe para o olho não tropeçar.

- **O problema**: o usuário lê grupos antes de ler palavras. Espaço errado faz ele ler o dado errado.
- **Opções**: (a) escala rígida 4/8; (b) escala ótica por tela; (c) espaçamento proporcional ao conteúdo.
- **Trade-off**: (a) é previsível e às vezes duro; (b) é mais bonito e impossível de auditar; (c) escala bem e quebra a memória visual entre telas.
- **Curiangoo**: mobile 390, margem lateral 16-20. A regra que não se negocia: **distância entre grupos maior que dentro do grupo**, sempre.
- **Exercício**: medir os espaçamentos reais de duas telas e listar os que quebram a regra de agrupamento. Cada item com valor medido.
- **Checagem**: valores em px, não "está apertado".
- **Fonte**: Refactoring UI cap. 5; Material Design spacing scale.

---

## Módulo 4 — Tipografia: leitura antes de personalidade

Escala modular, poucos pesos, entrelinha generosa em texto corrido. Fonte de display é da marca; fonte de dado é do número.

- **O problema**: app de dinheiro é **lido em número**, não em frase. Número precisa de tabular, alinhamento e tamanho que aguente vírgula e centavo.
- **Opções**: (a) uma família só, com pesos; (b) display na marca + sistema no corpo; (c) família variável.
- **Trade-off**: (a) é coerente e sem caráter; (b) dá personalidade e cria salto visual; (c) é o melhor dos dois e pesa no carregamento.
- **Curiangoo**: piso 12px no mobile para texto de apoio; 16px para leitura confortável. Número financeiro precisa `tabular-nums`.
- **Exercício**: medir a escala real (não a do CSS) nas telas e apontar onde o texto de apoio cai abaixo de 12px ou onde número não é tabular.
- **Checagem**: ele precisa ter inspecionado o elemento, não o arquivo de tokens.
- **Fonte**: Bringhurst, *The Elements of Typographic Style* cap. 2; Material type scale.

---

## Módulo 5 — Cor: contraste é acessibilidade, não gosto

Cor tem três funções: significado (receita/despesa), ação (o que clicar) e estado (erro, alerta). Quando a mesma cor faz duas coisas, o usuário erra.

- **O problema**: no dark, cor clara sobre fundo escuro satura; no light, a mesma cor perde contraste. Token semântico é o que impede a tela de mentir.
- **Opções**: (a) token semântico puro; (b) cor crua por componente; (c) token com exceção documentada.
- **Trade-off**: (a) é auditável e às vezes sem graça; (b) é rápido e vira dívida; (c) resolve o caso raro e vira brecha.
- **Curiangoo**: âmbar é **ação**, não decoração. Dark `#101217` é a base. Texto sobre âmbar precisa ser escuro — medido, não suposto.
- **Exercício**: medir contraste real (WCAG 2.2 AA: 4,5:1 texto, 3:1 grande e ícone) de 5 pares do app e listar os que falham, com o valor calculado.
- **Checagem**: razão numérica. "Está bom" não conta.
- **Fonte**: WCAG 2.2 SC 1.4.3; Refactoring UI cap. 7.

---

## Módulo 6 — Design system: quando um componente vira contrato

Componente é contrato: mesma aparência, mesmo comportamento, mesmas variantes. Design system falha quando **existe token e o componente usa cor crua**.

- **O problema**: cada exceção parece pequena; somadas, o app deixa de parecer um produto.
- **Opções**: (a) variantes fechadas por componente; (b) composição livre com tokens; (c) cópia por tela.
- **Trade-off**: (a) garante consistência e engessa o caso novo; (b) dá liberdade e exige disciplina; (c) é o que acontece sem decisão.
- **Curiangoo**: se a cor aparece duas vezes fora do token, é dívida. Ele **aponta**, não refatora.
- **Exercício**: encontrar 3 lugares onde a cor crua substitui o token e dizer qual token deveria ser usado.
- **Checagem**: caminho de arquivo e linha, não impressão.
- **Fonte**: Atomic Design (Frost); Nathan Curtis, "Design Systems".

---

## Módulo 7 — Arquitetura de informação: o custo de um toque

Navegação é sobre **profundidade versus largura**. Muitos destinos rasos confundem; poucos destinos profundos escondem.

- **O problema**: no Curiangoo o usuário abre o app por 40 segundos, no celular, em pé. Cada toque custa.
- **Opções**: (a) dock de 5 slots e o resto por dentro; (b) dock de 4 e um "+" central; (c) tudo em menu.
- **Trade-off**: (a) é achável e limita crescimento; (b) destaca criação e rouba um destino; (c) escala e mata o engajamento.
- **Curiangoo**: o dono decidiu **5 slots fixos** (Início, Carteira, Criar, Patrimônio, Metas). Regra dos 3 toques para o essencial. **O nome que o app usa tem que ser o nome que o usuário pensa** — "Essenciais", nunca "Necessidades".
- **Exercício**: mapear do dock até cada ação-chave e contar toques. Apontar qualquer coisa essencial acima de 3.
- **Checagem**: contagem explícita por caminho.
- **Fonte**: Rosenfeld & Morville, *Information Architecture*; NN/g "IA" e "3-click rule".

---

## Módulo 8 — Padrões mobile: a mão decide o design

Zona do polegar, alvo de 44px, safe-area, gesto tem desfazer. O usuário está segurando o aparelho com uma mão, andando.

- **O problema**: ação frequente fora do alcance obriga a segunda mão — e o usuário desiste.
- **Opções**: (a) ação no rodapé; (b) ação no topo; (c) gesto.
- **Trade-off**: (a) alcança e conflita com o dock; (b) é visível e longe; (c) é rápido e invisível.
- **Curiangoo**: destrutivo nunca na zona de toque acidental. Safe-area respeitada (3 botões do Android ocupam a faixa de baixo).
- **Exercício**: medir em 390x844 quais alvos estão abaixo de 44px e quais ações destrutivas estão na zona de polegar.
- **Checagem**: medidas em px.
- **Fonte**: Apple HIG (hit targets); Material touch targets; Luke Wroblewski, *Mobile First*.

---

## Módulo 9 — Movimento: orientar, nunca decorar

Motion responde a três perguntas: de onde veio, para onde vai, o que mudou. 150-250ms, easing suave, respeitar `prefers-reduced-motion`.

- **O problema**: em app de dinheiro, animação que atrasa a leitura é imposto sobre o usuário.
- **Opções**: (a) transição de tela sutil; (b) animação de valor (contagem); (c) nada se move.
- **Trade-off**: (a) orienta e custa 0ms percebidos; (b) dá prazer e atrasa; (c) é instantâneo e desorienta.
- **Curiangoo**: o `CountUp` do saldo é animação de valor — precisa ser curto o suficiente para não esconder o número.
- **Exercício**: cronometrar as animações do app e apontar uma que ajuda a entender e uma que atrapalha.
- **Checagem**: duração em ms observada.
- **Fonte**: Material Motion; Val Head, *Designing Interface Animation*.

---

## Módulo 10 — Microcopy: onde o app ensina

Microcopy é rótulo, estado vazio, erro, confirmação. No Curiangoo ela tem peso duplo: a **missão é educativa**. Todo texto ensina algo ou some.

- **O problema**: "Saldo Total da Família" não diz o que o número é. Número certo com rótulo errado vira desconfiança.
- **Opções**: (a) rótulo técnico e preciso; (b) rótulo leigo e vago; (c) rótulo leigo que explica.
- **Trade-off**: (a) é correto e exclui; (b) inclui e confunde; (c) inclui e custa espaço.
- **Curiangoo**: o saldo mostra três números desde v0.0.698 justamente porque o rótulo não bastava. Erro diz o que fazer, não o que houve.
- **Exercício**: pegar a frase de um estado vazio, uma de erro e o rótulo do saldo. Reescrever as três no padrão leigo-que-explica e justificar o espaço que cada uma custa.
- **Checagem**: a frase nova não pode ser mais longa sem dizer por quê.
- **Fonte**: Kinneret Yifrah, *Microcopy: The Complete Guide*; NN/g "Error messages".

---

## Módulo 11 — Acessibilidade: o mínimo que não é opcional

Contraste, foco visível, ordem de leitura, `aria-label` em ícone-só, nunca depender só de cor.

- **O problema**: receita e despesa são verde e vermelho — 8% dos homens não distingue. Se a cor é o único sinal, o dado some.
- **Opções**: (a) cor + sinal (+/−); (b) cor + ícone; (c) só cor.
- **Trade-off**: (a) é robusto e ocupa espaço; (b) é elegante e exige ícone por categoria; (c) é bonito e excludente.
- **Exercício**: listar todos os lugares onde só a cor diferencia receita de despesa, e onde foco de teclado não é visível.
- **Checagem**: lista com tela e elemento.
- **Fonte**: WCAG 2.2 AA; RNIB "colour blindness in finance apps".

---

## Módulo 12 — Dados e gráficos: pergunta antes de pixel

Gráfico que não responde uma pergunta é decoração. Cada um responde **uma** pergunta, em uma frase.

- **O problema**: no Curiangoo já houve um gráfico de linha de 30 dias que o usuário lia como gráfico de investimento.
- **Opções**: (a) um gráfico por pergunta; (b) um dashboard com vários; (c) nenhum, só número.
- **Trade-off**: (a) é claro e ocupa tela; (b) contextualiza e confunde; (c) é direto e esconde tendência.
- **Curiangoo**: a Home hoje usa só o donut de categorias; a leitura de futuro foi para a aba Projeção. **A escolha de tirar o gráfico foi tão importante quanto a de colocar outro.**
- **Exercício**: para cada gráfico do app, escrever a pergunta que ele responde e o que ele esconde.
- **Checagem**: se a pergunta não couber numa frase, o gráfico está errado.
- **Fonte**: Stephen Few, *Information Dashboard Design*; Alberto Cairo, *The Truthful Art*.

---

## Módulo 13 — Confiança: o ativo de um app de dinheiro

Confiança não vem de acertar sempre. Vem de **nunca contradizer a si mesmo** e de **admitir o que não sabe**.

**Você já errou exatamente aqui, em 17/11**: citou o título de um arquivo do repo que não existia, com aparência de verificação. Repetir isso num relatório de design é a mesma falha que esconder um número negativo: o produto passa a parecer confiável enquanto mente.

- **O problema**: número divergente entre duas telas destrói mais confiança que um bug que o usuário não vê.
- **Opções**: (a) esconder a divergência; (b) mostrar os dois números com rótulo; (c) mostrar um e explicar.
- **Trade-off**: (a) parece limpo e mente; (b) é honesto e ocupa espaço; (c) é limpo e exige texto bom.
- **Curiangoo**: a tela de Patrimônio já mostrou R$ 0,00 onde havia −R$ 22.459,75 (`Math.max(0, …)`). Esconder negativo é o pecado capital: o app pode ser feio, não pode mentir.
- **Exercício**: comparar o mesmo número em três telas e reportar qualquer diferença com os valores. Se não houver, dizer **"isto está certo"** e por quê.
- **Checagem**: obrigatório o elogio quando merecido. Auditor que só acha defeito não auditou.
- **Fonte**: NN/g "Trust in design"; literatura de fintech UX (Monzo, Copilot Money, Maybe).

---

## Módulo 14 — Consolidação: auditar uma tela inteira

Sem conceito novo. Ele recebe uma tela e devolve uma auditoria completa no formato dos módulos 2 a 13.

- **Estrutura**: hierarquia (2) → espaço (3) → tipo (4) → cor (5) → tokens (6) → toques (7) → mobile (8) → motion (9) → copy (10) → a11y (11) → dados (12) → confiança (13).
- **Regra**: pelo menos **um ponto correto** por tela auditada. E nenhum apontamento sem medida.
- **Exercício**: auditar Orçamentos inteira (hoje a tela mais densa do app).
- **Checagem**: se o relatório não tiver nenhum número, ele não auditou — descreveu.

---

## Depois das 14 — modo auditoria

O treino acaba; o trabalho continua. A cada rodada:
1. Escolher **uma pergunta** que o app deve responder (ver §8 do `docs/DOUTRINA-CURIANGGOO.md`).
2. Auditar todas as telas que a respondem.
3. Reportar divergência com número, ou declarar "isto está certo".
4. Registrar o que ficou aberto.

**Nunca** propor feature, nunca editar, nunca reabrir decisão já tomada pelo dono (dock de 5 slots, "Essenciais", 60/25/15, saldo com três números).
