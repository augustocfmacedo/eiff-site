/**
 * GEOMETRIA DA VISUALIZAÇÃO 3D — adaptador entre o configurador e a cena.
 *
 * Módulo PURO: sem DOM, sem three.js, sem rede. Recebe a configuração que o
 * visitante digitou e devolve números e eixos de elementos para DESENHAR.
 *
 * NÃO É ENGENHARIA. Nada aqui é dimensionado, verificado ou calculado por
 * norma. As seções são ILUSTRATIVAS (as mesmas proporções do croqui), a
 * inclinação e a modulação são HIPÓTESES DE REPRESENTAÇÃO, e nenhuma
 * quantidade (peso, número de peças, área de fechamento) sai deste módulo
 * para a tela. Os identificadores dos elementos servem ao desenho e aos testes.
 *
 * QUATRO MEDIDAS QUE NÃO SE CONFUNDEM:
 *  - vão livre ............ entre as faces internas dos pilares. É o campo «vão».
 *  - distância entre eixos  vão livre + altura da seção ilustrativa do pilar.
 *  - altura livre ......... o campo «pé-direito»: da base à linha inferior da
 *                           viga, junto à face interna do pilar.
 *  - altura de referência
 *    na cumeeira .......... pé-direito + meio vão × inclinação. É a «Altura
 *                           total» que o painel já mostrava; fica na linha
 *                           inferior da viga e NÃO inclui viga nem cobertura.
 *
 * A mesma conta do croqui (`desenharPortico`) dá a altura de referência: as
 * duas representações mostram os mesmos números (ver `geometria3d.test.ts`).
 *
 * Eixos, iguais aos do laboratório de engenharia: x transversal (vão),
 * y longitudinal (comprimento), z vertical para cima. Origem no eixo do
 * primeiro pilar da fila A, no nível da base.
 */

import { INCLINACAO_DE_REPRESENTACAO, alturaDeReferencia, alturaTotalExibida, secoesDeDesenho } from './convencao'
import { dimensoesParaDesenho } from './ilustracao'
import { formatarMedida, type ConfiguracaoGalpao, type Cobertura, type Fechamento } from './parametros'

/** Hipóteses de representação. Não são dados de projeto. */
export const HIPOTESES_3D = {
  /** Inclinação da cobertura, a mesma do croqui em corte. */
  inclinacao: INCLINACAO_DE_REPRESENTACAO,
  /** Distância-alvo entre pórticos, em metros. */
  moduloAlvo: 6,
  /** Distância-alvo entre terças, medida sobre a água. */
  passoDasTercas: 1.8,
  /** Distância-alvo entre travessas de fechamento, na vertical. */
  passoDasTravessas: 1.8,
  /** Distância-alvo entre pilares de oitão. */
  passoDoOitao: 6,
  /** Altura da figura humana de referência. */
  figura: 1.75,
} as const

export const SELO_3D = 'VISUALIZAÇÃO CONCEITUAL — NÃO É PROJETO EXECUTIVO.'

export type P3 = readonly [number, number, number]

export type TipoDeElemento =
  | 'portico' | 'terca' | 'travessa' | 'longitudinal' | 'contraventamento' | 'pilar-de-oitao'

export interface Elemento {
  id: string
  tipo: TipoDeElemento
  /** Eixo do elemento: do ponto `a` ao ponto `b`. Para o pórtico, `a` e `b` são as bases das filas A e B. */
  a: P3
  b: P3
}

export interface SecoesIlustrativas {
  /** Altura (maior dimensão) da seção desenhada, em metros. Proporção do croqui; não é perfil dimensionado. */
  pilar: number
  viga: number
  misula: number
  /** Comprimento da mísula, medido na horizontal a partir da face interna do pilar. */
  comprimentoDaMisula: number
  secundario: number
}

export interface Geometria3D {
  vaoLivre: number
  distanciaEntreEixos: number
  /** Comprimento entre os eixos dos pórticos extremos: o campo «comprimento». */
  comprimento: number
  alturaLivre: number
  alturaDeReferenciaNaCumeeira: number
  inclinacao: number
  numeroDePorticos: number
  modulo: number
  secoes: SecoesIlustrativas
  cobertura: Cobertura
  fechamento: Fechamento
  /** Há fechamento lateral a desenhar? Falso para «sem fechamento». */
  fechado: boolean
  /** O visitante ainda não escolheu o fechamento: desenhado translúcido, sem material definido. */
  fechamentoIndefinido: boolean
}

const arredondar = (n: number, casas = 4) => Math.round(n * 10 ** casas) / 10 ** casas

export { alturaDeReferencia }

/**
 * Geometria para desenhar. `null` quando as três dimensões não são válidas pelas
 * regras do configurador: fora dos limites não há desenho.
 */
export function geometriaDoGalpao(c: ConfiguracaoGalpao): Geometria3D | null {
  const d = dimensoesParaDesenho(c)
  if (!d) return null
  const { pilar, viga, misula, comprimentoDaMisula } = secoesDeDesenho(d.vao)
  const modulos = Math.max(1, Math.round(d.comprimento / HIPOTESES_3D.moduloAlvo))
  const fechamento: Fechamento = c.fechamento ?? 'indefinido'
  return {
    vaoLivre: d.vao,
    distanciaEntreEixos: arredondar(d.vao + pilar),
    comprimento: d.comprimento,
    alturaLivre: d.peDireito,
    alturaDeReferenciaNaCumeeira: arredondar(alturaDeReferencia(d.peDireito, d.vao)),
    inclinacao: HIPOTESES_3D.inclinacao,
    numeroDePorticos: modulos + 1,
    modulo: d.comprimento / modulos,
    secoes: {
      pilar: arredondar(pilar), viga: arredondar(viga), misula: arredondar(misula),
      comprimentoDaMisula: arredondar(comprimentoDaMisula),
      secundario: arredondar(Math.max(0.12, pilar * 0.3)),
    },
    cobertura: c.cobertura ?? 'indefinido',
    fechamento,
    fechado: fechamento !== 'aberto',
    fechamentoIndefinido: fechamento === 'indefinido',
  }
}

/** Cota z da linha inferior da viga numa posição x (0 = eixo da fila A). */
export function linhaInferiorDaViga(g: Geometria3D, x: number): number {
  const face = g.secoes.pilar / 2
  const meio = g.distanciaEntreEixos / 2
  const dist = Math.max(0, Math.min(x, g.distanciaEntreEixos - x) - face)
  return g.alturaLivre + Math.min(dist, meio - face) * g.inclinacao
}

/** Cota z da face superior da viga (onde as terças apoiam) numa posição x. */
export function topoDaViga(g: Geometria3D, x: number): number {
  const cos = 1 / Math.sqrt(1 + g.inclinacao ** 2)
  // do pilar para fora a viga segue a mesma reta: a linha de referência prolongada até o eixo
  const meio = g.distanciaEntreEixos / 2
  const dist = Math.min(x, g.distanciaEntreEixos - x) - g.secoes.pilar / 2
  return g.alturaLivre + Math.min(dist, meio) * g.inclinacao + g.secoes.viga / cos
}

const id2 = (n: number) => String(n).padStart(2, '0')

/**
 * Eixos dos elementos a desenhar. Os pórticos saem como um elemento por eixo
 * (a cena desenha pilares, vigas e mísulas a partir das seções ilustrativas).
 */
export function elementosDaEstrutura(g: Geometria3D): Elemento[] {
  const el: Elemento[] = []
  const de = g.distanciaEntreEixos
  const L = g.comprimento
  const n = g.numeroDePorticos
  const y = (i: number) => arredondar((i * L) / (n - 1))

  for (let i = 0; i < n; i += 1) el.push({ id: `PORTICO-${id2(i + 1)}`, tipo: 'portico', a: [0, y(i), 0], b: [de, y(i), 0] })

  // terças: linhas ao longo do comprimento, sobre a viga, do beiral à cumeeira
  const cos = 1 / Math.sqrt(1 + g.inclinacao ** 2)
  const agua = (de / 2) / cos
  const intervalos = Math.max(2, Math.round(agua / HIPOTESES_3D.passoDasTercas))
  const folga = g.secoes.secundario / 2
  for (const lado of ['A', 'B'] as const) {
    for (let k = 0; k <= intervalos; k += 1) {
      const u = k / intervalos
      const xa = (de / 2) * u
      const x = lado === 'A' ? xa : de - xa
      const z = arredondar(topoDaViga(g, x) + folga)
      if (k === intervalos && lado === 'B') continue        // a linha de cumeeira é uma só
      el.push({ id: k === intervalos ? 'TERCA-CUMEEIRA' : `TERCA-${lado}${id2(k)}`, tipo: 'terca', a: [arredondar(x), 0, z], b: [arredondar(x), L, z] })
    }
  }

  // longitudinais de beiral, no topo dos pilares
  for (const [fila, x] of [['A', 0], ['B', de]] as const) {
    el.push({ id: `BEIRAL-${fila}`, tipo: 'longitudinal', a: [x, 0, g.alturaLivre], b: [x, L, g.alturaLivre] })
  }

  if (g.fechado && g.fechamento !== 'alvenaria') {
    // travessas das fachadas longitudinais, na face externa dos pilares
    const linhas = Math.max(1, Math.floor((g.alturaLivre - 0.6) / HIPOTESES_3D.passoDasTravessas))
    const fora = g.secoes.pilar / 2 + g.secoes.secundario / 2
    for (const [fila, x] of [['A', -fora], ['B', de + fora]] as const) {
      for (let k = 1; k <= linhas; k += 1) {
        const z = arredondar((g.alturaLivre * k) / (linhas + 1) + 0.3)
        el.push({ id: `TRAVESSA-${fila}${id2(k)}`, tipo: 'travessa', a: [arredondar(x), 0, z], b: [arredondar(x), L, z] })
      }
    }
  }

  if (g.fechado) {
    // pilares de oitão nos dois pórticos de extremidade
    const vaos = Math.max(1, Math.round(g.vaoLivre / HIPOTESES_3D.passoDoOitao))
    for (const [nome, yy] of [['INICIAL', 0], ['FINAL', L]] as const) {
      for (let k = 1; k < vaos; k += 1) {
        const x = arredondar((de * k) / vaos)
        el.push({ id: `OITAO-${nome}-${id2(k)}`, tipo: 'pilar-de-oitao', a: [x, yy, 0], b: [x, yy, arredondar(linhaInferiorDaViga(g, x))] })
      }
    }
  }

  // contraventamentos em X no primeiro e no último módulo: cobertura e fachadas
  const modulos = n - 1
  const paineis = modulos === 1 ? [0] : [0, modulos - 1]
  for (const m of paineis) {
    const y0 = y(m)
    const y1 = y(m + 1)
    const zb = g.alturaLivre
    const zc = arredondar(topoDaViga(g, de / 2) - g.secoes.viga / 2)
    const zv = arredondar(topoDaViga(g, 0) - g.secoes.viga / 2)
    for (const [fila, x] of [['A', 0], ['B', de]] as const) {
      el.push({ id: `X-FACHADA-${fila}-${id2(m + 1)}-1`, tipo: 'contraventamento', a: [x, y0, 0], b: [x, y1, zb] })
      el.push({ id: `X-FACHADA-${fila}-${id2(m + 1)}-2`, tipo: 'contraventamento', a: [x, y1, 0], b: [x, y0, zb] })
      el.push({ id: `X-COBERTURA-${fila}-${id2(m + 1)}-1`, tipo: 'contraventamento', a: [x, y0, zv], b: [de / 2, y1, zc] })
      el.push({ id: `X-COBERTURA-${fila}-${id2(m + 1)}-2`, tipo: 'contraventamento', a: [x, y1, zv], b: [de / 2, y0, zc] })
    }
  }
  return el
}

/** Só a distância entre eixos precisa de duas casas (soma a seção ilustrativa). O resto usa a formatação do painel. */
const fmtEixos = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

/** A «Altura total» em texto, igual à do painel: mesma função de origem e mesma formatação. */
export function alturaTotalEmTexto(g: Geometria3D): string {
  return formatarMedida(alturaTotalExibida(g.alturaLivre, g.vaoLivre, g.inclinacao))
}

/**
 * O que a visualização presume, em frases para a tela. Nenhuma delas é dado de projeto, e nenhuma traz
 * quantidade (número de pórticos, de peças, peso): quantidade só existe depois do estudo de engenharia.
 */
export function hipotesesDeRepresentacao(g: Geometria3D): string[] {
  const lista = [
    `Vão livre de ${formatarMedida(g.vaoLivre)} m entre as faces internas dos pilares. A distância entre eixos desenhada (${fmtEixos.format(g.distanciaEntreEixos)} m) soma a seção ilustrativa do pilar.`,
    `Pé-direito de ${formatarMedida(g.alturaLivre)} m até a linha inferior da viga, junto ao pilar. A mísula ilustrativa fica abaixo dessa linha no encontro com o pilar.`,
    `Inclinação da cobertura de ${formatarMedida(g.inclinacao * 100)} % adotada só para o desenho. A «Altura total» do painel (${alturaTotalEmTexto(g)} m) é a linha inferior da viga na cumeeira e não inclui viga nem cobertura.`,
    `Pórticos desenhados a cada ${formatarMedida(g.modulo)} m, só para compor a figura. A modulação real é definida pela engenharia.`,
    'Perfis, mísulas, terças, travessas e contraventamentos são ilustrativos: não foram dimensionados nem verificados.',
    'Portas, docas, aberturas, fundações, piso e instalações não foram informados e não são desenhados.',
  ]
  if (g.fechamentoIndefinido) lista.push('Fechamento ainda não escolhido: desenhado translúcido, sem material definido.')
  if (g.cobertura === 'indefinido') lista.push('Cobertura ainda não escolhida: desenhada em material neutro.')
  return lista
}
