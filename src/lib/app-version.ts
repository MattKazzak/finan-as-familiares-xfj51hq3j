import pkg from '../../package.json'

// Versão do app EXIBIDA no Perfil.
//
// POR QUE UMA CONSTANTE E NÃO `package.json` DIRETO: a plataforma Skip atualiza
// o package.json DEPOIS do build — o chunk do Perfil embutia sempre a versão
// ANTERIOR (lag de 1 build), fazendo o Matheus achar que o update não chegou
// (falsa negativa em toda entrega).
//
// HISTÓRICO DO PROBLEMA (3 ocorrências: 25/10, 11/11 e 16/11):
// a constante ficou para trás enquanto o package.json avançava. Em 16/11/2026
// o app dizia 0.0.658 e o package.json estava em 0.0.672 — 14 versões de
// diferença, sem ninguém notar. O número na tela não é enfeite: é a única
// forma do dono conferir se o deploy dele chegou.
//
// REGRA ao publicar: bump AQUI. O `npm version patch` automático da plataforma
// continua existindo, mas ele não escreve neste arquivo.
export const APP_VERSION = '0.0.682'

/**
 * Versão da build REALMENTE publicada — a que o Perfil exibe.
 *
 * Por que não usar o APP_VERSION cru: como a plataforma bumpa o package.json
 * DEPOIS do build, quando `package.json` > `APP_VERSION` a constante é a que
 * foi de fato compilada; quando `APP_VERSION` > `package.json`, ela foi bumpada
 * à mão e ainda não subiu. Nos dois casos o número VERDADEIRO é o menor.
 *
 * O desencontro em si (constante esquecida para trás) é cobrado por teste:
 * src/lib/__tests__/app-version-sync.test.ts.
 */
export function getDisplayedVersion(): string {
  const fromPkg = String(pkg.version || '0.0.0')
  const parse = (v: string) => v.split('.').map((n) => Number(n) || 0)

  // Comparação numérica campo a campo ("0.0.99" seria maior que "0.0.673" em string).
  const compare = (a: string, b: string) => {
    const [a1, a2, a3] = parse(a)
    const [b1, b2, b3] = parse(b)
    return a1 - b1 || a2 - b2 || a3 - b3
  }

  return compare(APP_VERSION, fromPkg) <= 0 ? APP_VERSION : fromPkg
}
