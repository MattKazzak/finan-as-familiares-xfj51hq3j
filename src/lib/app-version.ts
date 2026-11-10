// Versão do app EXIBIDA no Perfil.
// POR QUE CONSTANTE E NÃO package.json: a plataforma Skip atualiza o package.json
// DEPOIS do build — o chunk do Perfil embutia sempre a versão ANTERIOR (lag de 1 build),
// fazendo o Matheus achar que o update não chegou (falsa negativa em toda entrega).
// REGRA: bumpar esta constante em TODO deploy, junto da mudança.
export const APP_VERSION = '0.0.645'
