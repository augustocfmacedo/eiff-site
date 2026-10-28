/**
 * Croqui do pórtico: geometria pura para o SVG da tela.
 *
 * É desenho técnico proporcional ao que o visitante digitou — corte esquemático
 * com pilares, tesoura e cotas. Não é projeto estrutural e não deriva nenhuma
 * quantidade: só traduz vão e pé-direito em coordenadas de tela.
 */

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
  /** Caminho dos dois pilares. */
  pilares: string
  /** Caminho das duas águas da cobertura. */
  cobertura: string
  /** Banzo inferior da tesoura. */
  banzo: string
  /** Montantes e diagonais da tesoura. */
  trelica: string
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

  const pilares = `M ${r(esquerda)} ${r(base)} V ${r(topoPilar)} M ${r(direita)} ${r(base)} V ${r(topoPilar)}`
  const cobertura = `M ${r(esquerda)} ${r(topoPilar)} L ${r(meio)} ${r(cumeeira)} L ${r(direita)} ${r(topoPilar)}`

  // Banzo inferior a uma fração da altura da tesoura, só para leitura do desenho.
  const alturaTesoura = Math.max(6, (alturaTela - peDireito * escala) * 0.55)
  const banzoY = topoPilar - alturaTesoura * 0.08
  const banzoMeio = cumeeira + alturaTesoura
  const banzo = `M ${r(esquerda)} ${r(banzoY)} L ${r(meio)} ${r(banzoMeio)} L ${r(direita)} ${r(banzoY)}`

  // Montantes verticais ligando banzo e cobertura, em 4 divisões por água.
  const montantes: string[] = []
  const divisoes = 4
  for (let i = 1; i < divisoes; i++) {
    const t = i / divisoes
    for (const sentido of [-1, 1] as const) {
      const x = meio + sentido * (larguraTela / 2) * t
      const yCobertura = cumeeira + (topoPilar - cumeeira) * t
      const yBanzo = banzoMeio + (banzoY - banzoMeio) * t
      montantes.push(`M ${r(x)} ${r(yCobertura)} V ${r(yBanzo)}`)
    }
  }
  const trelica = montantes.join(' ')

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

  return { pilares, cobertura, banzo, trelica, solo, cotaVao, cotaPeDireito, alturaCumeeira: r(alturaCumeeira) }
}
