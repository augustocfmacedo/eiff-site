/**
 * Croqui do pórtico: geometria pura para o SVG da tela.
 *
 * É desenho técnico proporcional ao que o visitante digitou — corte esquemático
 * com pilares, viga e cotas. Não é projeto estrutural e não deriva nenhuma
 * quantidade: só traduz vão e pé-direito em coordenadas de tela.
 *
 * O pórtico é de alma cheia, com mísula no joelho, porque é isso que a EIFF
 * constrói. As alturas de seção estão repetidas aqui de propósito: a cena 3D
 * da home importa three.js, e o simulador não pode carregar isso só para ler
 * três números.
 */

/** Altura de seção, em metros, do pilar, da viga e do joelho. */
const H_PILAR = 0.85
const H_VIGA = 0.7
const H_MISULA = 1.75
/**
 * Teto da espessura desenhada, como fração do vão em tela. Sem ele, um vão
 * pequeno com a proporção real daria um pilar absurdamente gordo no croqui.
 */
const ESPESSURA_MAX = 0.035
/** Comprimento da mísula em tela, como fração da meia-água. */
const MISULA_FRACAO = 0.22

export interface MedidasPortico {
  vao: number
  peDireito: number
  /** Inclinação da cobertura em porcentagem. 10% é a usada no desenho do site. */
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
  /** Cota horizontal do vão: caminho e ponto do rótulo. */
  cotaVao: { caminho: string; x: number; y: number }
  /** Cota vertical do pé-direito. */
  cotaPeDireito: { caminho: string; x: number; y: number }
  /** Altura total até a cumeeira, em metros (geometria, não engenharia). */
  alturaCumeeira: number
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
  const inclinacao = m.inclinacao ?? 10
  const vao = Math.max(1, m.vao)
  const peDireito = Math.max(0.5, m.peDireito)
  const alturaCumeeira = peDireito + (vao / 2) * (inclinacao / 100)

  // Escala única para os dois eixos: o croqui não distorce a proporção real.
  const util = { largura: moldura.largura - moldura.margem * 2, altura: moldura.altura - moldura.margem * 2 }
  const escala = Math.min(util.largura / vao, util.altura / alturaCumeeira)

  const larguraTela = vao * escala
  const alturaTela = alturaCumeeira * escala
  const esquerda = moldura.margem + (util.largura - larguraTela) / 2
  const direita = esquerda + larguraTela
  const base = moldura.margem + util.altura - (util.altura - alturaTela) / 2
  const topoPilar = base - peDireito * escala
  const cumeeira = base - alturaTela
  const meio = (esquerda + direita) / 2

  // Espessura das seções: proporcional ao vão real, com teto em fração da
  // largura desenhada, para o croqui não engordar em vão pequeno.
  const espPilar = Math.min(Math.max(H_PILAR * escala, 2), Math.max(larguraTela * ESPESSURA_MAX, 2))
  const espViga = espPilar * (H_VIGA / H_PILAR)
  const espMisula = espPilar * (H_MISULA / H_PILAR)
  const lMisula = (larguraTela / 2) * MISULA_FRACAO

  const pilares =
    `M ${r(esquerda)} ${r(base)} V ${r(topoPilar)} H ${r(esquerda + espPilar)} V ${r(base)} `
    + `M ${r(direita)} ${r(base)} V ${r(topoPilar)} H ${r(direita - espPilar)} V ${r(base)}`

  const cobertura = `M ${r(esquerda)} ${r(topoPilar)} L ${r(meio)} ${r(cumeeira)} L ${r(direita)} ${r(topoPilar)}`

  // Face inferior: desce a mísula no joelho e corre paralela à água até o cume.
  const yAgua = (x: number) => topoPilar + (cumeeira - topoPilar) * ((x - esquerda) / (meio - esquerda))
  const xMisula = esquerda + lMisula
  const yMisula = yAgua(xMisula) + espViga
  const alma =
    `M ${r(esquerda)} ${r(topoPilar + espMisula)} L ${r(xMisula)} ${r(yMisula)} L ${r(meio)} ${r(cumeeira + espViga)} `
    + `L ${r(direita - lMisula)} ${r(yMisula)} L ${r(direita)} ${r(topoPilar + espMisula)} `
    // Chapas de topo: é por elas que o pórtico é parafusado em campo.
    + `M ${r(esquerda)} ${r(topoPilar)} V ${r(topoPilar + espMisula)} `
    + `M ${r(direita)} ${r(topoPilar)} V ${r(topoPilar + espMisula)} `
    + `M ${r(meio)} ${r(cumeeira)} V ${r(cumeeira + espViga)}`

  const solo = `M ${r(moldura.margem * 0.4)} ${r(base)} H ${r(moldura.largura - moldura.margem * 0.4)}`

  const yCota = base + moldura.margem * 0.45
  const cotaVao = {
    caminho: `M ${r(esquerda)} ${r(yCota - 5)} V ${r(yCota + 5)} M ${r(esquerda)} ${r(yCota)} H ${r(direita)} M ${r(direita)} ${r(yCota - 5)} V ${r(yCota + 5)}`,
    x: r(meio),
    y: r(yCota - 8),
  }

  const xCota = direita + moldura.margem * 0.45
  const cotaPeDireito = {
    caminho: `M ${r(xCota - 5)} ${r(base)} H ${r(xCota + 5)} M ${r(xCota)} ${r(base)} V ${r(topoPilar)} M ${r(xCota - 5)} ${r(topoPilar)} H ${r(xCota + 5)}`,
    x: r(xCota + 10),
    y: r((base + topoPilar) / 2),
  }

  return { pilares, cobertura, alma, solo, cotaVao, cotaPeDireito, alturaCumeeira: r(alturaCumeeira) }
}
