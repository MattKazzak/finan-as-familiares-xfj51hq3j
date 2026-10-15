# Registro de Publicação e Validação — Versão 0.0.340

- **Data da Verificação**: 14/10/2026
- **Versão do App**: 0.0.340 (fechada e validada)
- **ATENÇÃO — Preview URL**: a URL de preview (`--preview.goskip.app`) pode servir build antigo travado na infra do Skip (React não monta, tela branca). A produção SEMPRE reflete a última versão publicada. Usar a produção como referência.
- **Status do Build**: Pronto para produção (`vite build` + `tsc`)
- **Backend Supabase**:
  - Edge functions ativas e sincronizadas: `voice-parse`, `voice-transcribe`, `batch-categorize`.
  - Migrações aplicadas no banco: catálogo 19/118 com "Tabaco & Cigarros" (Compras) e "Eventos & Reuniões" (Lazer).
- **Domínio Oficial de Produção**: https://app.curiangoo.com
  - Site URL configurado no Supabase Auth: `https://app.curiangoo.com`
  - Redirect URIs autorizados: `https://app.curiangoo.com/**`, `https://financas-familiares-46529.goskip.app/**`, `https://financas-familiares-46529--preview.goskip.app/**`.
- **Mecanismo de Publicação da Plataforma Skip**:
  - O deploy para o link de produção e domínio customizado no Skip Cloud é acionado pelo botão **"Publicar"** no header da interface da plataforma web do Skip.
  - O pipeline de código e backend (edge functions) foi verificado e deployado.
