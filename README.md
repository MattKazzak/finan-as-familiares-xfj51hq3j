# Curiangoo — Finanças Familiares

SaaS de finanças pessoais mobile-first para famílias: Método dos 3 Baldes, Copilot de voz IA, importação de faturas (OFX/PDF) e visão financeira familiar.

> ⚠️ **Repositório espelho do Skip** — o desenvolvimento acontece na plataforma Skip (projeto 59353). Este repo recebe o código-fonte como backup/versionamento.

## Stack
- React 19 + Vite + TypeScript + Tailwind + shadcn/ui (PWA)
- Supabase (Postgres + RLS + Edge Functions + Auth)
- OpenAI (gpt-4o-mini no Copilot, whisper-1 na transcrição)

## Estrutura
```
src/
  pages/          # Rotas (Login, Home, Wallet, Goals, Investments, Copilot...)
  services/       # Camada de dados (Supabase) + parsers de importação
  hooks/          # use-auth, use-family, use-voice-capture...
  components/     # UI (shadcn) + componentes de negócio
supabase/
  functions/      # Edge Functions: voice-parse, voice-transcribe, batch-categorize
  migrations/     # Schema + RLS + RPCs
```

## Segurança (hardening 14/10/2026)
- RLS em todas as tabelas (incl. backups)
- Isolamento de tenant nas Edge Functions (JWT + family_id resolvido no servidor)
- Rate limit de IA por usuário (janela deslizante via RPC)
- Deleção de workspace transacional (RPC security definer)

## Backup
O código oficial vive no Skip. Commits aqui são snapshots de segurança.