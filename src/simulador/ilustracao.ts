/**
 * ILUSTRAÇÃO das dimensões informadas — volumetria e implantação conceitual.
 *
 * É DESENHO, não modelo. Usa só três números que o visitante digitou (vão,
 * comprimento, pé-direito) e os desenha em proporção. Não há pórtico, perfil,
 * contraventamento, fundação, terça nem quantitativo, e nada aqui é calculado
 * por engenharia.
 *
 * O caimento da cobertura é uma CONSTANTE DE DESENHO (`CAIMENTO_DO_DESENHO`),
 * escolhida para a cobertura aparecer como duas águas. Não é inclinação de
 * projeto: a inclinação real é definida pela engenharia.
 *
 * Módulo puro: devolve SVG em texto. Sem DOM, sem rede.
 */

import { areaCoberta, formatarArea, formatarMedida, validarMedida, type ConfiguracaoGalpao } from './parametros'

/** Só para o desenho ter duas águas visíveis. Não é dado de projeto. */
export const CAIMENTO_DO_DESENHO = 0.07
/** Altura da figura humana de referência, em metros. Só escala visual. */
export const FIGURA_DE_ESCALA = 1.75

export const AVISO_DA_ILUSTRACAO = 'Ilustração das dimensões informadas. Não é modelo estrutural calculado.'

export interface Dimensoes { vao: number; comprimento: number; peDireito: number }

/** Há dados suficientes para desenhar? Só com as três dimensões válidas pelas regras do configurador. */
export function dimensoesParaDesenho(c: ConfiguracaoGalpao): Dimensoes | null {
  for (const campo of ['vao', 'comprimento', 'peDireito'] as const) if (validarMedida(campo, c[campo]) !== null) return null
  return { vao: c.vao!, comprimento: c.comprimento!, peDireito: c.peDireito! }
}

type P2 = readonly [number, number]
const n2 = (v: number) => (Math.round(v * 100) / 100).toString()
const pts = (ps: readonly P2[]) => ps.map(([x, y]) => `${n2(x)},${n2(y)}`).join(' ')

/* ---------------------------------------------------------------- Rótulos que cabem */

/**
 * Tamanhos do texto dentro do desenho, em unidades do viewBox. Têm de bater com
 * `.sim-ilu-cota`, `.sim-ilu-area` e `.sim-ilu-selo` no CSS (um teste confere).
 * `avanco` é a largura de um caractere em fração do tamanho: a cota e o selo
 * usam fonte monoespaçada (0,6 em, mais o espaçamento entre letras do selo);
 * a área usa a fonte de títulos, e 0,62 é um teto folgado para ela.
 */
export const TEXTO_DO_DESENHO = {
  cota: { tamanho: 20, avanco: 0.6 },
  area: { tamanho: 22, avanco: 0.62 },
  selo: { tamanho: 15, avanco: 0.72 },
} as const

export interface CaixaDeTexto { x0: number; x1: number; y0: number; y1: number }
interface Rotulo {
  tipo: keyof typeof TEXTO_DO_DESENHO
  texto: string
  x: number
  y: number
  ancora: 'start' | 'middle' | 'end'
  /** Texto girado −90° em torno de (x, y), centrado. */
  girado?: boolean
  atributos?: string
}

/** A caixa que um rótulo ocupa, em unidades do viewBox. */
export function caixaDoRotulo(r: Pick<Rotulo, 'tipo' | 'texto' | 'x' | 'y' | 'ancora' | 'girado'>): CaixaDeTexto {
  const { tamanho, avanco } = TEXTO_DO_DESENHO[r.tipo]
  const largura = [...r.texto].length * tamanho * avanco
  const sobe = tamanho * 0.8
  const desce = tamanho * 0.25
  if (r.girado) return { x0: r.x - sobe, x1: r.x + desce, y0: r.y - largura / 2, y1: r.y + largura / 2 }
  const x0 = r.ancora === 'start' ? r.x : r.ancora === 'end' ? r.x - largura : r.x - largura / 2
  return { x0, x1: x0 + largura, y0: r.y - sobe, y1: r.y + desce }
}

const encostam = (a: CaixaDeTexto, b: CaixaDeTexto, folga = 2) =>
  a.x0 < b.x1 + folga && b.x0 < a.x1 + folga && a.y0 < b.y1 + folga && b.y0 < a.y1 + folga

/**
 * Desenha os rótulos na ordem de prioridade e PULA o que sairia do quadro ou
 * encostaria num rótulo já desenhado ou num obstáculo. Nada se sobrepõe, em
 * proporção nenhuma. As medidas não se perdem: a página as repete numa linha de
 * texto abaixo do desenho.
 */
function rotulosQueCabem(lista: readonly Rotulo[], largura: number, altura: number, obstaculos: readonly CaixaDeTexto[] = []): string {
  const ocupadas: CaixaDeTexto[] = [...obstaculos]
  const saida: string[] = []
  for (const r of lista) {
    const c = caixaDoRotulo(r)
    if (c.x0 < 2 || c.y0 < 2 || c.x1 > largura - 2 || c.y1 > altura - 2) continue
    if (ocupadas.some((o) => encostam(o, c))) continue
    ocupadas.push(c)
    const giro = r.girado ? ` transform="rotate(-90 ${n2(r.x)} ${n2(r.y)})"` : ''
    saida.push(`<text class="sim-ilu-${r.tipo}" x="${n2(r.x)}" y="${n2(r.y)}" text-anchor="${r.ancora}"${giro}${r.atributos ?? ''}>${r.texto}</text>`)
  }
  return saida.join('\n  ')
}

const LARGURA = 640
const ALTURA = 400
const MARGEM = 56

/**
 * Volumetria em perspectiva isométrica: piso, duas paredes visíveis e a
 * cobertura de duas águas. Proporcional às três dimensões.
 */
export function ilustracaoVolumetrica(c: ConfiguracaoGalpao): string | null {
  const d = dimensoesParaDesenho(c)
  if (!d) return null
  const { vao: W, comprimento: L, peDireito: H } = d
  const r = W * CAIMENTO_DO_DESENHO
  const cos = Math.cos(Math.PI / 6)
  const sen = Math.sin(Math.PI / 6)
  const bruto = (x: number, y: number, z: number): P2 => [(x - y) * cos, (x + y) * sen - z]

  const cantos = [bruto(0, 0, 0), bruto(W, 0, 0), bruto(W, L, 0), bruto(0, L, 0), bruto(W / 2, 0, H + r), bruto(W / 2, L, H + r), bruto(0, 0, H), bruto(W, L + 2.5, 0)]
  const xs = cantos.map((p) => p[0]); const ys = cantos.map((p) => p[1])
  const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys)
  const k = Math.min((LARGURA - 2 * MARGEM) / (maxX - minX), (ALTURA - 2 * MARGEM) / (maxY - minY))
  const dx = (LARGURA - (maxX - minX) * k) / 2 - minX * k
  const dy = (ALTURA - (maxY - minY) * k) / 2 - minY * k
  const p = (x: number, y: number, z: number): P2 => { const [a, b] = bruto(x, y, z); return [a * k + dx, b * k + dy] }

  const piso = [p(0, 0, 0), p(W, 0, 0), p(W, L, 0), p(0, L, 0)]
  const aguaDeTras = [p(0, 0, H), p(0, L, H), p(W / 2, L, H + r), p(W / 2, 0, H + r)]
  const aguaDaFrente = [p(W, 0, H), p(W, L, H), p(W / 2, L, H + r), p(W / 2, 0, H + r)]
  const parede = [p(W, 0, 0), p(W, L, 0), p(W, L, H), p(W, 0, H)]
  const oitao = [p(0, L, 0), p(W, L, 0), p(W, L, H), p(W / 2, L, H + r), p(0, L, H)]

  const meio = (a: P2, b: P2): P2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const rotVao = meio(p(0, L, 0), p(W, L, 0))
  const rotComp = meio(p(W, 0, 0), p(W, L, 0))
  const rotPe = meio(p(W, L, 0), p(W, L, H))
  // A figura fica à frente do oitão, longe do rótulo do pé-direito, para os dois não se encostarem.
  const pe = p(W, L + 2, 0)
  const cabeca = p(W, L + 2, FIGURA_DE_ESCALA)

  const descricao = `Volume de ${formatarMedida(W)} metros de vão por ${formatarMedida(L)} metros de comprimento, com ${formatarMedida(H)} metros de pé-direito, coberto em duas águas. ${AVISO_DA_ILUSTRACAO}`
  return `
<svg class="sim-ilu-svg" viewBox="0 0 ${LARGURA} ${ALTURA}" role="img" aria-labelledby="simVolTitulo simVolDesc" data-ilustracao="volumetria" preserveAspectRatio="xMidYMid meet">
  <title id="simVolTitulo">Volumetria ilustrativa</title>
  <desc id="simVolDesc">${descricao}</desc>
  <polygon class="sim-ilu-piso" points="${pts(piso)}"/>
  <polygon class="sim-ilu-agua sim-ilu-agua--tras" points="${pts(aguaDeTras)}"/>
  <polygon class="sim-ilu-agua" points="${pts(aguaDaFrente)}"/>
  <polygon class="sim-ilu-parede" points="${pts(parede)}"/>
  <polygon class="sim-ilu-oitao" points="${pts(oitao)}"/>
  <line class="sim-ilu-figura" data-figura="escala" x1="${n2(pe[0])}" y1="${n2(pe[1])}" x2="${n2(cabeca[0])}" y2="${n2(cabeca[1])}"/>
  <circle class="sim-ilu-figura" cx="${n2(cabeca[0])}" cy="${n2(cabeca[1] - 2.5)}" r="2.5"/>
  ${rotulosQueCabem([
    { tipo: 'cota', texto: `vão ${formatarMedida(W)} m`, x: rotVao[0] - 10, y: rotVao[1] + 22, ancora: 'end' },
    { tipo: 'cota', texto: `comprimento ${formatarMedida(L)} m`, x: rotComp[0] + 12, y: rotComp[1] + 18, ancora: 'start' },
    { tipo: 'cota', texto: `pé-direito ${formatarMedida(H)} m`, x: rotPe[0] + 16, y: rotPe[1] + 4, ancora: 'start', atributos: ' data-rotulo="pe-direito"' },
    { tipo: 'selo', texto: 'ILUSTRAÇÃO · não é modelo estrutural', x: LARGURA / 2, y: ALTURA - 12, ancora: 'middle' },
  ], LARGURA, ALTURA, [{ x0: Math.min(pe[0], cabeca[0]) - 6, x1: Math.max(pe[0], cabeca[0]) + 6, y0: Math.min(pe[1], cabeca[1]) - 8, y1: Math.max(pe[1], cabeca[1]) + 4 }])}
</svg>`
}

const PL_LARGURA = 640
const PL_ALTURA = 320
const PL_MARGEM = 64

/**
 * Implantação conceitual: só a projeção do galpão em planta, com as cotas e a
 * área. Terreno, recuos, acessos e orientação não foram informados e não são
 * desenhados.
 */
export function implantacaoConceitual(c: ConfiguracaoGalpao): string | null {
  const d = dimensoesParaDesenho(c)
  if (!d) return null
  const { vao: W, comprimento: L } = d
  const k = Math.min((PL_LARGURA - 2 * PL_MARGEM) / L, (PL_ALTURA - 2 * PL_MARGEM) / W)
  const w = L * k
  const h = W * k
  const x = (PL_LARGURA - w) / 2
  const y = (PL_ALTURA - h) / 2
  const area = areaCoberta(c)!
  const descricao = `Projeção em planta de ${formatarMedida(L)} por ${formatarMedida(W)} metros, com ${formatarArea(area)} metros quadrados. Terreno, recuos e acessos não foram informados. ${AVISO_DA_ILUSTRACAO}`
  return `
<svg class="sim-ilu-svg" viewBox="0 0 ${PL_LARGURA} ${PL_ALTURA}" role="img" aria-labelledby="simPlTitulo simPlDesc" data-ilustracao="implantacao" preserveAspectRatio="xMidYMid meet">
  <title id="simPlTitulo">Implantação conceitual</title>
  <desc id="simPlDesc">${descricao}</desc>
  <rect class="sim-ilu-projecao" x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}"/>
  <line class="sim-ilu-cumeeira" x1="${n2(x)}" y1="${n2(y + h / 2)}" x2="${n2(x + w)}" y2="${n2(y + h / 2)}"/>
  <line class="sim-ilu-linha-cota" x1="${n2(x)}" y1="${n2(y + h + 18)}" x2="${n2(x + w)}" y2="${n2(y + h + 18)}"/>
  <line class="sim-ilu-linha-cota" x1="${n2(x - 18)}" y1="${n2(y)}" x2="${n2(x - 18)}" y2="${n2(y + h)}"/>
  ${rotulosQueCabem([
    { tipo: 'cota', texto: `comprimento ${formatarMedida(L)} m`, x: x + w / 2, y: y + h + 38, ancora: 'middle' },
    { tipo: 'cota', texto: `vão ${formatarMedida(W)} m`, x: x - 26, y: y + h / 2, ancora: 'middle', girado: true },
    { tipo: 'area', texto: `${formatarArea(area)} m² de projeção`, x: x + w / 2, y: y - 12, ancora: 'middle' },
    { tipo: 'selo', texto: 'IMPLANTAÇÃO CONCEITUAL · terreno não informado', x: PL_LARGURA / 2, y: PL_ALTURA - 10, ancora: 'middle' },
  ], PL_LARGURA, PL_ALTURA)}
</svg>`
}
