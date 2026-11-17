# Progresso de treinamento dos bots — Curiangoo

Arquivo único de controle. **Cada rodada lê este arquivo, encontra a próxima lição não dada e, ao terminar, escreve a linha da lição.** Sem isso, o job repete lição ou pula.

Cadência: **3 lições por dia, 9h / 14h / 19h**. Currículos reescritos em profundidade em 17/11 (formação por decisão / por doutrina, não por checklist).

## Como marcar

Ao concluir uma rodada, atualizar UMA linha na tabela do bot:

```
| 3 | 2026-11-17 14h | Arquitetura de informação | devolvido | — |
```

Status: `enviada` · `devolvido` · `corrigido` · `falhou`
"corrigido" = resposta rasa/errada → vira matéria da rodada seguinte (reforço antes de matéria nova).

---

## Caio — revisor de doutrina financeira

Currículo: `docs/CAIO-CURRICULO.md` · 15 lições (0 a 14), ~14 rodadas restantes.

| # | Lição | Status | Observação |
|---|---|---|---|
| 0 | Quem é o Matheus + regra de domínio | devolvido | Acertou a cadeia e corrigiu o doc (fonte da árvore). Errou ao ler espelho velho: 3 falsos positivos. |
| 1 | As três camadas da verdade financeira | pendente | **Começar cobrando o erro do espelho.** |
| 2 | Caixa × competência | pendente | Reforçar: consequência do saldo com cartão. |
| 3 | Patrimônio líquido (PL = A − P) | pendente | Obrigatório dizer "está certo" se estiver. |
| 4 | Contradição de fato × regime diferente | pendente | Caso de calibração: Patrimônio 16/11. |
| 5 | Termos: defasado / ambíguo / contraditório | pendente | — |
| 6 | Ceticismo produtivo: quando NÃO há erro | pendente | Exige seção "o que está certo". |
| 7 | As 6 perguntas canônicas | pendente | Cuidado: divergência Home×Orçamentos já corrigida em v0.0.703. |
| 8 | Severidade por dano | pendente | CRÍTICO exige par de números. |
| 9 | Fontes: hierarquia e honestidade | pendente | Título + URL ou "não verificado". |
| 10 | Doutrinas de orçamento e suas críticas | pendente | 50/30/20 com as 4 críticas documentadas. |
| 11 | Contabilidade mental e nudge (Thaler) | pendente | Por que os 3 Baldes funcionam. |
| 12 | Anti AI Slop + formato do relatório | pendente | 6 campos por achado. |
| 13 | Autonomia sem inventar | pendente | Aprender ≠ app errado. |
| 14 | Calibração final: auditar "Quanto eu tenho?" | pendente | Home × Patrimônio × Carteira. |

---

## Designer — design de produto

Currículo: `docs/DESIGNER-CURRICULO.md` · 14 módulos, ~14 rodadas restantes.
**Contrato de cada lição**: problema → 2-3 opções → trade-off → escolha + porquê → prova medida. Sem os 5, volta.

| # | Lição | Status | Observação |
|---|---|---|---|
| 1 | O que um designer decide (e o que não decide) | pendente | Três decisões: hierarquia, fluxo, confiança. |
| 2 | Hierarquia visual: o que grita | pendente | Medir área do herói vs 2º colocado. |
| 3 | Espaçamento: separar e agrupar | pendente | Regra: distância entre grupos > dentro do grupo. |
| 4 | Tipografia: leitura antes de personalidade | pendente | Número financeiro precisa tabular-nums. |
| 5 | Cor: contraste é acessibilidade | pendente | WCAG AA 4,5:1, com valor calculado. |
| 6 | Design system: componente é contrato | pendente | Cor crua fora do token = dívida. |
| 7 | Arquitetura de informação: custo de um toque | pendente | Dock de 5 slots é decisão do dono. |
| 8 | Padrões mobile: a mão decide | pendente | Alvo 44px, zona do polegar. |
| 9 | Movimento: orientar, não decorar | pendente | Cronometrar o CountUp do saldo. |
| 10 | Microcopy: onde o app ensina | pendente | Saldo com 3 números é o caso. |
| 11 | Acessibilidade: o mínimo não opcional | pendente | Cor sozinha não pode diferenciar. |
| 12 | Dados e gráficos: pergunta antes de pixel | pendente | Por que o gráfico de 30d saiu. |
| 13 | Confiança: o ativo de app de dinheiro | pendente | Esconder negativo é o pecado capital. |
| 14 | Consolidação: auditoria da tela de Orçamentos | pendente | Relatório sem número não conta. |

---

## Regras da rodada (valem para os dois)

1. **Ler este arquivo primeiro.** A próxima lição é a primeira com status `pendente`.
2. **Uma lição por rodada.** Nunca duas.
3. **Ao terminar, escrever a linha** — data/hora, status, observação. Sem isso a rodada não conta.
4. **Resposta rasa → `corrigido`** e a correção vira o exercício da rodada seguinte, não lição nova.
5. **Dado inventado** → registrar na observação e exigir a fonte na rodada seguinte.
6. **Ao fechar as 14**, o job para de dar aula e vira auditoria do app real. Registrar no topo e avisar o Matheus.
