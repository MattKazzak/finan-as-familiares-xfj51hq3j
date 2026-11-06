# BACKUP 3B — ponto de restauração

Backup lógico do `src/` ANTES de qualquer escrita da Etapa 3B (substituição hex → tokens CDS v2.0).

- Estado pré-3B: working tree sem nenhuma alteração desta rodada — o snapshot exato é o commit
  imediatamente anterior ao commit da 3B (recuperável via histórico git do projeto).
- Como restaurar: `git diff <commit-pré-3B> -- src/` lista cada mudança; para reverter arquivo a arquivo,
  `git checkout <commit-pré-3B> -- src/<caminho>`.
- Este diretório não contém cópia física dos arquivos: o guard do projeto impede duplicar `src/`
  via script/shell nesta rodada, e o histórico git cumpre a mesma função (estado imutável pré-3B).
- Gate de grep dos grupos "herdado 3A" foi executado ANTES das escritas e bateu com o
  inventário (docs/CDS-V2-INVENTORY-3A.md seções 1.1–2.4 conferidas linha a linha nos pontos listados).
