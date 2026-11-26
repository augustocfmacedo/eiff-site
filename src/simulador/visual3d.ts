/**
 * VISUALIZAÇÃO 3D do simulador — o que liga a página à cena, SEM importar three.js.
 *
 * A cena (`cena3d.ts`, com three.js) só é baixada quando o painel entra na tela
 * ou quando o visitante pede o 3D. Se o navegador não tiver WebGL, se o download
 * falhar ou se a cena quebrar, este módulo devolve `false` e a página continua
 * com as ilustrações e o croqui de sempre: o formulário nunca depende do 3D.
 */

import { SELO_3D, geometriaDoGalpao, hipotesesDeRepresentacao, type Geometria3D } from './geometria3d'
import type { ConfiguracaoGalpao } from './parametros'
import type { Cena3D, Modo, VistaDaCamera } from './cena3d'

export type Situacao = 'parada' | 'carregando' | 'pronta' | 'indisponivel'

export interface Visual3D {
  /** O navegador consegue desenhar? Decidido uma vez, sem baixar nada. */
  readonly suportado: boolean
  situacao(): Situacao
  /** Baixa e monta a cena. Resolve `false` se não for possível: quem chama mostra o croqui. */
  ativar(): Promise<boolean>
  /** Nova configuração. Barato: só remonta se a geometria mudou. */
  atualizar(c: ConfiguracaoGalpao): void
  /** A cena está visível? Enquanto não estiver, nada é remontado. */
  mostrar(visivel: boolean): void
  modo(): Modo
}

export interface OpcoesVisual3D {
  reduzMovimento: boolean
  /** Chamado quando a cena deixa de existir depois de ter funcionado (contexto perdido, erro). */
  aoFalhar: () => void
  aoMudarModo?: (m: Modo) => void
}

/** WebGL disponível? Testa num canvas à parte e solta o contexto em seguida. */
export function temWebGL(doc: Document = document): boolean {
  try {
    const c = doc.createElement('canvas')
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

/** Duas geometrias desenham a mesma cena? Evita remontar a cada tecla que não muda nada. */
export function mesmaGeometria(a: Geometria3D | null, b: Geometria3D | null): boolean {
  return a !== null && b !== null && JSON.stringify(a) === JSON.stringify(b)
}

const NOME_DO_MODO: Record<Modo, string> = { arquitetura: 'Arquitetura', estrutura: 'Estrutura', interior: 'Interior' }
const DESCRICAO_DO_MODO: Record<Modo, string> = {
  arquitetura: 'cobertura, fechamentos e volumetria',
  estrutura: 'componentes metálicos, em representação conceitual',
  interior: 'o espaço interno e a altura pretendida',
}

export function iniciarVisual3D(raiz: Document | HTMLElement, opcoes: OpcoesVisual3D): Visual3D | null {
  const caixa = raiz.querySelector<HTMLElement>('#sim3d')
  const tela = raiz.querySelector<HTMLCanvasElement>('#sim3dTela')
  const rotulos = raiz.querySelector<HTMLElement>('#sim3dRotulos')
  const estadoEl = raiz.querySelector<HTMLElement>('#sim3dEstado')
  const hipoteses = raiz.querySelector<HTMLElement>('#sim3dHipoteses')
  const selo = raiz.querySelector<HTMLElement>('#sim3dSelo')
  if (!caixa || !tela || !rotulos) return null

  // `?3d=0` desliga a visualização para um visitante com problema de vídeo: a página fica com os croquis.
  const desligado = new URLSearchParams(window.location.search).get('3d') === '0'
  const suportado = !desligado && temWebGL()
  let situacao: Situacao = suportado ? 'parada' : 'indisponivel'
  let cena: Cena3D | null = null
  let pedido: Promise<boolean> | null = null
  let modoAtual: Modo = 'arquitetura'
  let visivel = false
  let desenhada: Geometria3D | null = null
  let pendente: Geometria3D | null = null
  let agendado = 0
  if (selo) selo.textContent = SELO_3D

  const dizer = (texto: string): void => {
    if (!estadoEl) return
    estadoEl.textContent = texto
    estadoEl.hidden = texto === ''
  }

  const descrever = (g: Geometria3D): void => {
    const f = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
    tela.setAttribute('aria-label', `Visualização conceitual em 3D, modo ${NOME_DO_MODO[modoAtual]}: ${DESCRICAO_DO_MODO[modoAtual]}. `
      + `Vão livre de ${f.format(g.vaoLivre)} metros, comprimento de ${f.format(g.comprimento)} metros e pé-direito de ${f.format(g.alturaLivre)} metros. Não é projeto executivo.`)
    if (hipoteses) hipoteses.innerHTML = hipotesesDeRepresentacao(g).map((h) => `<li>${h.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)}</li>`).join('')
  }

  /** No máximo uma remontagem por quadro, e só com a cena à vista. */
  const aplicar = (): void => {
    agendado = 0
    if (!cena || !visivel || !pendente || mesmaGeometria(pendente, desenhada)) return
    try {
      cena.atualizar(pendente)
      desenhada = pendente
      descrever(pendente)
    } catch {
      falhar()
    }
  }
  const agendar = (): void => {
    if (!agendado) agendado = requestAnimationFrame(aplicar)
  }

  const falhar = (): void => {
    ampliar(false)
    try { cena?.destruir() } catch { /* a cena já se foi */ }
    cena = null
    situacao = 'indisponivel'
    caixa.hidden = true
    opcoes.aoFalhar()
  }

  const marcar = (grupo: string, valor: string): void => {
    caixa.querySelectorAll<HTMLButtonElement>(`[data-${grupo}]`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[grupo] === valor)))
  }

  /*
   * Ampliada, a caixa vai para dentro de um <dialog> modal, na CAMADA SUPERIOR do navegador: fica acima do menu,
   * do título e de qualquer seção, independentemente de empilhamento, e o resto da página fica inerte. Esc fecha
   * (evento nativo do diálogo). Ao fechar, a caixa volta para o lugar marcado. O canvas e a cena são os mesmos.
   * Sem suporte a <dialog>, cai no modo fixo com Esc tratado no documento.
   */
  const marcador = document.createComment('sim3d')
  let dialogo: HTMLDialogElement | null = null
  const ampliada = (): boolean => caixa.classList.contains('sim-3d--ampliada')
  const aoEscape = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && ampliada()) { e.preventDefault(); ampliar(false) }
  }
  const ampliar = (sim: boolean): void => {
    if (sim === ampliada()) return
    const bt = caixa.querySelector<HTMLButtonElement>('[data-cam="ampliar"]')
    if (sim) {
      caixa.before(marcador)
      if (!dialogo) {
        dialogo = document.createElement('dialog')
        dialogo.className = 'sim-3d-dialogo'
        dialogo.setAttribute('aria-label', 'Visualização 3D ampliada')
        // Esc e qualquer outro fechamento nativo passam por aqui: o estado nunca fica pela metade
        dialogo.addEventListener('close', () => ampliar(false))
        document.body.appendChild(dialogo)
      }
      dialogo.appendChild(caixa)
      caixa.classList.add('sim-3d--ampliada')
      if (typeof dialogo.showModal === 'function') {
        try { dialogo.showModal() } catch { dialogo.setAttribute('open', '') }
      } else {
        dialogo.setAttribute('open', '')
        document.addEventListener('keydown', aoEscape)
      }
    } else {
      caixa.classList.remove('sim-3d--ampliada')
      document.removeEventListener('keydown', aoEscape)
      if (marcador.parentNode) marcador.replaceWith(caixa)
      if (dialogo?.open) dialogo.close()
    }
    if (bt) {
      bt.setAttribute('aria-pressed', String(sim))
      bt.textContent = sim ? 'Fechar' : 'Ampliar'
      bt.setAttribute('aria-label', sim ? 'Fechar a visualização ampliada' : 'Ampliar a visualização')
      bt.focus({ preventScroll: true })
    }
    document.documentElement.classList.toggle('sim-3d-travada', sim)
  }

  caixa.addEventListener('click', (e) => {
    const bt = (e.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (!bt || !cena) return
    if (bt.dataset.modo) {
      modoAtual = bt.dataset.modo as Modo
      marcar('modo', modoAtual)
      cena.definirModo(modoAtual)
      if (desenhada) descrever(desenhada)
      opcoes.aoMudarModo?.(modoAtual)
    } else if (bt.dataset.cam === 'ampliar') ampliar(!caixa.classList.contains('sim-3d--ampliada'))
    else if (bt.dataset.cam === 'mais') cena.zoom(0.82)
    else if (bt.dataset.cam === 'menos') cena.zoom(1.22)
    else if (bt.dataset.cam === 'restaurar') cena.restaurar()
    else if (bt.dataset.cam) cena.definirVista(bt.dataset.cam as VistaDaCamera)
  })
  // Dentro do formulário (no celular o painel é movido para lá), Enter num botão
  // do 3D não pode ser lido como «avançar etapa».
  caixa.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).closest('button')) e.stopPropagation()
  })

  const api: Visual3D = {
    suportado,
    situacao: () => situacao,
    modo: () => modoAtual,
    ativar() {
      if (!suportado || situacao === 'indisponivel') return Promise.resolve(false)
      if (pedido) return pedido
      situacao = 'carregando'
      dizer('Carregando a visualização 3D…')
      pedido = import('./cena3d').then((m) => {
        cena = m.criarCena(tela, rotulos, {
          reduzMovimento: opcoes.reduzMovimento,
          toque: window.matchMedia('(pointer: coarse)').matches,
          aoPerderContexto: falhar,
        })
        situacao = 'pronta'
        dizer('')
        agendar()
        return true
      }).catch(() => {
        situacao = 'indisponivel'
        dizer('')
        return false
      })
      return pedido
    },
    atualizar(c) {
      pendente = geometriaDoGalpao(c)
      if (cena && visivel) agendar()
    },
    mostrar(v) {
      if (!v && visivel) ampliar(false)
      visivel = v
      if (v) agendar()
    },
  }
  ;(caixa as HTMLElement & { __sim3d?: unknown }).__sim3d = { estatisticas: () => cena?.estatisticas() ?? null, situacao: () => situacao }
  return api
}
