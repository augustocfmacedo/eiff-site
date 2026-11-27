/**
 * Croqui do pórtico: geometria pura para o SVG da tela.
 *
 * É desenho técnico proporcional ao que o visitante digitou — corte esquemático
 * com pilares, viga e cotas. Não é projeto estrutural e não deriva nenhuma
 * quantidade: só traduz vão e pé-direito em coordenadas de tela.
 *
 * O pórtico é de alma cheia, com mísula no joelho, porque é isso que a EIFF
 * constrói. A inclinação e as proporções das seções vêm de `convencao.ts`, a
 * mesma fonte do modelo 3D e da ilustração «Volume».
 *
 * ONDE FICAM AS MEDIDAS (igual ao 3D):
 *  - a cota do vão vai de face interna a face interna dos pilares: é o vão livre.
 *    A espessura ilustrativa do pilar é desenhada para FORA do vão;
 *  - a cota do pé-direito vai da base à linha inferior da viga, junto ao pilar;
 *  - a viga é desenhada ACIMA dessa linha, e a mísula, abaixo dela, só no joelho.
 */

import { INCLINACAO_DE_REPRESENTACAO, alturaDeReferencia, alturaTotalExibida, secoesDeDesenho } from './convencao'

export { ESPESSURA_MAX, H_MISULA, H_PILAR, H_VIGA, MISULA_FRACAO } from './convencao'

export interface MedidasPortico {
  vao: number
  peDireito: number
  /** Inclinação da cobertura em porcentagem. Sem valor, vale a convenção de representação (10 %). */
  inclinacao?: number
}

export interface Moldura {
  largura: number
  altura: number
  margem: number
}

export interface Croqui {
  /** Contorno dos dois pilares: face externa, topo e face interna. */
  pilares: string
  /** Face superior da viga, nas duas águas. */
  cobertura: string
  /** Face inferior da viga, com a mísula, e as chapas de topo das ligações. */
  alma: string
  /** Linha do terreno. */
  solo: string
  /** Cota horizontal do vão livre, entre as faces internas: caminho e ponto do rótulo. */
  cotaVao: { caminho: string; x: number; y: number }
  /** Cota vertical do pé-direito, até a linha inferior da viga junto ao pilar. */
  cotaPeDireito: { caminho: string; x: number; y: number }
  /** A «Altura total» como é mostrada no painel: `alturaTotalExibida` da convenção (geometria, não engenharia). */
  alturaCumeeira: number
  /** Posições em tela das referências, para conferência: faces dos pilares, base, pé-direito e cumeeira. */
  referencias: {
    faceInternaEsquerda: number; faceInternaDireita: number; faceExternaEsquerda: number; faceExternaDireita: number
    base: number; peDireito: number; cumeeira: number; escala: number
  }
}

/**
 * Moldura usada pela tela e pelo HTML estático. A largura é menor que a viewBox
 * (420) de propósito: a faixa à direita fica livre para a cota do pé-direito.
 */
export const MOLDURA_PADRAO: Moldura = { largura: 360, altura: 260, margem: 34 }

const r = (n: number) => Math.round(n * 10) / 10

/**
 * Converte medidas reais em coordenadas do SVG, mantendo a proporção entre vão
 * e altura e deixando folga para as cotas.
 */
export function desenharPortico(m: MedidasPortico, moldura: Moldura): Croqui {
  const inclinacao = m.inclinacao !== undefined ? m.inclinacao / 100 : INCLINACAO_DE_REPRESENTACAO
  const vao = Math.max(1, m.vao)
  const peDireito = Math.max(0.5, m.peDireito)
  const alturaCumeeira = alturaDeReferencia(peDireito, vao, inclinacao)
  const sec = secoesDeDesenho(vao)

  // Escala única para os dois eixos: o croqui não distorce a proporção real. O que precisa caber é o vão livre
  // mais os dois pilares (que ficam fora dele) e a altura de referência mais a viga (que fica acima dela).
  const util = { largura: moldura.largura - moldura.margem * 2, altura: moldura.altura - moldura.margem * 2 }
  const escala = Math.min(util.largura / (vao + 2 * sec.pilar), util.altura / (alturaCumeeira + sec.viga))

  // Espessuras em tela, com um mínimo de 2 px para o traço não sumir em galpão muito alto.
  const espPilar = Math.max(sec.pilar * escala, 2)
  const espViga = espPilar * (sec.viga / sec.pilar)
  const espMisula = espPilar * (sec.misula / sec.pilar)
  const lMisula = sec.comprimentoDaMisula * escala

  const larguraTela = vao * escala                          // o vão livre, entre faces internas
  const alturaTela = alturaCumeeira * escala + espViga
  const faceEsq = moldura.margem + (util.largura - (larguraTela + 2 * espPilar)) / 2 + espPilar
  const faceDir = faceEsq + larguraTela
  const foraEsq = faceEsq - espPilar
  const foraDir = faceDir + espPilar
  const base = moldura.margem + util.altura - (util.altura - alturaTela) / 2
  const yPe = base - peDireito * escala                     // linha inferior da viga junto ao pilar
  const yCume = base - alturaCumeeira * escala              // linha inferior da viga na cumeeira
  const meio = (faceEsq + faceDir) / 2

  // Linha de referência (face inferior da viga) e face superior, a uma espessura de viga acima.
  const ref = (x: number) => yPe + (yCume - yPe) * (Math.min(x - faceEsq, faceDir - x) / (meio - faceEsq))
  const topo = (x: number) => ref(x) - espViga

  const pilares =
    `M ${r(foraEsq)} ${r(base)} V ${r(topo(foraEsq))} H ${r(faceEsq)} V ${r(base)} `
    + `M ${r(foraDir)} ${r(base)} V ${r(topo(foraDir))} H ${r(faceDir)} V ${r(base)}`

  const cobertura = `M ${r(foraEsq)} ${r(topo(foraEsq))} L ${r(meio)} ${r(topo(meio))} L ${r(foraDir)} ${r(topo(foraDir))}`

  // Face inferior: a mísula desce abaixo da linha de referência no joelho e morre nela; daí em diante é a própria linha.
  const yJoelho = yPe + (espMisula - espViga)
  const xMisula = faceEsq + lMisula
  const alma =
    `M ${r(faceEsq)} ${r(yJoelho)} L ${r(xMisula)} ${r(ref(xMisula))} L ${r(meio)} ${r(yCume)} `
    + `L ${r(faceDir - lMisula)} ${r(ref(xMisula))} L ${r(faceDir)} ${r(yJoelho)} `
    // Chapas de topo: é por elas que o pórtico é parafusado em campo.
    + `M ${r(faceEsq)} ${r(topo(faceEsq))} V ${r(yJoelho)} `
    + `M ${r(faceDir)} ${r(topo(faceDir))} V ${r(yJoelho)} `
    + `M ${r(meio)} ${r(topo(meio))} V ${r(yCume)}`

  const solo = `M ${r(moldura.margem * 0.4)} ${r(base)} H ${r(moldura.largura - moldura.margem * 0.4)}`

  const yCota = base + moldura.margem * 0.45
  const cotaVao = {
    caminho: `M ${r(faceEsq)} ${r(yCota - 5)} V ${r(yCota + 5)} M ${r(faceEsq)} ${r(yCota)} H ${r(faceDir)} M ${r(faceDir)} ${r(yCota - 5)} V ${r(yCota + 5)}`,
    x: r(meio),
    y: r(yCota - 8),
  }

  const xCota = foraDir + moldura.margem * 0.45
  const cotaPeDireito = {
    caminho: `M ${r(xCota - 5)} ${r(base)} H ${r(xCota + 5)} M ${r(xCota)} ${r(base)} V ${r(yPe)} M ${r(xCota - 5)} ${r(yPe)} H ${r(xCota + 5)}`,
    x: r(xCota + 10),
    y: r((base + yPe) / 2),
  }

  return {
    pilares, cobertura, alma, solo, cotaVao, cotaPeDireito, alturaCumeeira: alturaTotalExibida(peDireito, vao, inclinacao),
    referencias: {
      faceInternaEsquerda: faceEsq, faceInternaDireita: faceDir, faceExternaEsquerda: foraEsq, faceExternaDireita: foraDir,
      base, peDireito: yPe, cumeeira: yCume, escala,
    },
  }
}
