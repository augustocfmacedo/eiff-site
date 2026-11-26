/**
 * Testes COMPORTAMENTAIS do controlador 3D (`visual3d.ts`), sem navegador e sem WebGL.
 *
 * O controlador roda de verdade, contra um DOM mínimo escrito aqui (elementos com pai, eventos que sobem e podem
 * ser barrados) e contra uma cena falsa no lugar de `cena3d.ts`. Cada teste provoca uma situação e confere o que
 * o controlador FEZ: o que chamou, em que estado ficou, o que avisou à página. Nada aqui confere texto de código.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SELO_3D } from './geometria3d'
import type { OpcoesDaCena } from './cena3d'

/* ------------------------------------------------------------------ cena falsa */
const cenaFalsa = {
  chamadas: [] as string[],
  opcoes: null as OpcoesDaCena | null,
  falharAoCriar: false,
  falharAoAtualizar: false,
}
vi.mock('./cena3d', () => ({
  criarCena: (_tela: unknown, _rotulos: unknown, opcoes: OpcoesDaCena) => {
    if (cenaFalsa.falharAoCriar) throw new Error('sem contexto')
    cenaFalsa.opcoes = opcoes
    cenaFalsa.chamadas.push('criar')
    return {
      atualizar: (g: { vaoLivre: number }) => {
        if (cenaFalsa.falharAoAtualizar) throw new Error('quebrou ao montar')
        cenaFalsa.chamadas.push(`atualizar:${g.vaoLivre}`)
      },
      definirModo: (m: string) => { cenaFalsa.chamadas.push(`modo:${m}`) },
      definirVista: (v: string) => { cenaFalsa.chamadas.push(`vista:${v}`) },
      restaurar: () => { cenaFalsa.chamadas.push('restaurar') },
      zoom: (f: number) => { cenaFalsa.chamadas.push(`zoom:${f}`) },
      girar: () => { cenaFalsa.chamadas.push('girar') },
      estatisticas: () => null,
      destruir: () => { cenaFalsa.chamadas.push('destruir') },
    }
  },
}))

/* ------------------------------------------------------------------ DOM mínimo */
interface Evento { type: string; key?: string; target: El; parou: boolean; defaultPrevented: boolean; stopPropagation(): void; preventDefault(): void }

class El {
  parent: El | null = null
  children: El[] = []
  dataset: Record<string, string> = {}
  attrs: Record<string, string> = {}
  hidden = false
  textContent = ''
  innerHTML = ''
  className = ''
  open = false
  focado = 0
  private classes = new Set<string>()
  private ouvintes: Record<string, ((e: Evento) => void)[]> = {}
  constructor(public tag: string, public id = '') {}
  classList = {
    add: (c: string) => { this.classes.add(c) },
    remove: (c: string) => { this.classes.delete(c) },
    contains: (c: string) => this.classes.has(c),
    toggle: (c: string, sim?: boolean) => { (sim ?? !this.classes.has(c)) ? this.classes.add(c) : this.classes.delete(c) },
  }
  get parentNode() { return this.parent }
  addEventListener(tipo: string, f: (e: Evento) => void) { (this.ouvintes[tipo] ??= []).push(f) }
  removeEventListener(tipo: string, f: (e: Evento) => void) { this.ouvintes[tipo] = (this.ouvintes[tipo] ?? []).filter((x) => x !== f) }
  setAttribute(n: string, v: string) { this.attrs[n] = v }
  getAttribute(n: string) { return this.attrs[n] ?? null }
  focus() { this.focado += 1 }
  appendChild(f: El) { f.remover(); f.parent = this; this.children.push(f); return f }
  remover() { if (this.parent) this.parent.children = this.parent.children.filter((x) => x !== this); this.parent = null }
  before(novo: El) { const p = this.parent!; novo.remover(); novo.parent = p; p.children.splice(p.children.indexOf(this), 0, novo) }
  replaceWith(novo: El) { const p = this.parent!; const i = p.children.indexOf(this); novo.remover(); novo.parent = p; p.children.splice(i, 1, novo); this.parent = null }
  closest(sel: string): El | null { for (let e: El | null = this; e; e = e.parent) if (e.casa(sel)) return e; return null }
  casa(sel: string): boolean {
    if (sel === 'button') return this.tag === 'button'
    if (sel.startsWith('#')) return this.id === sel.slice(1)
    const m = sel.match(/^\[data-([a-z]+)(?:="([^"]*)")?\]$/)
    return m ? (m[2] === undefined ? m[1]! in this.dataset : this.dataset[m[1]!] === m[2]) : false
  }
  descendentes(): El[] { return this.children.flatMap((c) => [c, ...c.descendentes()]) }
  querySelector(sel: string): El | null { return this.descendentes().find((e) => e.casa(sel)) ?? null }
  querySelectorAll(sel: string): El[] { return this.descendentes().filter((e) => e.casa(sel)) }
  /** Dispara um evento que SOBE pelos pais, como no navegador, e para em `stopPropagation`. */
  disparar(tipo: string, extra: { key?: string } = {}): Evento {
    const e: Evento = { type: tipo, ...extra, target: this, parou: false, defaultPrevented: false, stopPropagation() { this.parou = true }, preventDefault() { this.defaultPrevented = true } }
    for (let no: El | null = this; no && !e.parou; no = no.parent) for (const f of no.ouvintes[tipo] ?? []) f(e)
    return e
  }
  // <dialog>
  showModal() { this.open = true }
  close() { if (!this.open) return; this.open = false; this.disparar('close') }
}

interface Pagina { form: El; painel: El; caixa: El; tela: El; modos: Record<string, El>; cam: Record<string, El>; selo: El; hipoteses: El; corpo: El; raiz: El; quadros: (() => void)[]; teclasNoForm: string[] }

function montarPagina(opcoes: { webgl?: boolean; busca?: string; dialogoNativo?: boolean } = {}): Pagina {
  const raiz = new El('html')
  const corpo = raiz.appendChild(new El('body'))
  const form = corpo.appendChild(new El('form', 'sim'))
  const painel = form.appendChild(new El('aside'))          // no celular o painel fica DENTRO do formulário
  const caixa = painel.appendChild(new El('div', 'sim3d'))
  const modos: Record<string, El> = {}
  for (const m of ['arquitetura', 'estrutura', 'interior']) { const b = caixa.appendChild(new El('button')); b.dataset.modo = m; modos[m] = b }
  const palco = caixa.appendChild(new El('div'))
  const tela = palco.appendChild(new El('canvas', 'sim3dTela'))
  palco.appendChild(new El('div', 'sim3dRotulos'))
  const selo = palco.appendChild(new El('p', 'sim3dSelo'))
  palco.appendChild(new El('p', 'sim3dEstado'))
  const cam: Record<string, El> = {}
  for (const c of ['perspectiva', 'frente', 'lateral', 'topo', 'menos', 'mais', 'restaurar', 'ampliar']) { const b = caixa.appendChild(new El('button')); b.dataset.cam = c; cam[c] = b }
  const hipoteses = caixa.appendChild(new El('ul', 'sim3dHipoteses'))
  const teclasNoForm: string[] = []
  form.addEventListener('keydown', (e) => { teclasNoForm.push(e.key ?? '') })     // o «Enter avança etapa» do formulário real
  const quadros: (() => void)[] = []
  const documento = {
    body: corpo, documentElement: raiz,
    createElement: (tag: string) => {
      if (tag === 'canvas') return { getContext: () => (opcoes.webgl === false ? null : { getExtension: () => null }) }
      const el = new El(tag)
      if (tag === 'dialog' && opcoes.dialogoNativo === false) (el as unknown as { showModal: undefined }).showModal = undefined
      return el
    },
    createComment: () => new El('#comentario'),
    addEventListener: (t: string, f: (e: Evento) => void) => raiz.addEventListener(t, f),
    removeEventListener: (t: string, f: (e: Evento) => void) => raiz.removeEventListener(t, f),
  }
  vi.stubGlobal('document', documento)
  vi.stubGlobal('window', { location: { search: opcoes.busca ?? '' }, matchMedia: () => ({ matches: false }) })
  vi.stubGlobal('requestAnimationFrame', (f: () => void) => { quadros.push(f); return quadros.length })
  return { form, painel, caixa, tela, modos, cam, selo, hipoteses, corpo, raiz, quadros, teclasNoForm }
}

const proximoQuadro = (p: Pagina) => { const fila = p.quadros.splice(0); fila.forEach((f) => f()) }
const GALPAO = { vao: 25, comprimento: 60, peDireito: 8 }

async function iniciar(p: Pagina) {
  const { iniciarVisual3D } = await import('./visual3d')
  const avisos: string[] = []
  const v = iniciarVisual3D(p.raiz as unknown as HTMLElement, {
    reduzMovimento: false,
    aoFalhar: () => avisos.push('falhou'), aoPausar: () => avisos.push('pausou'), aoRetomar: () => avisos.push('retomou'),
  })!
  return { v, avisos }
}

beforeEach(() => { cenaFalsa.chamadas = []; cenaFalsa.opcoes = null; cenaFalsa.falharAoCriar = false; cenaFalsa.falharAoAtualizar = false })
afterEach(() => { vi.unstubAllGlobals() })

/* ------------------------------------------------------------------ fallback */
describe('fallback: a página nunca depende do 3D', () => {
  it('sem WebGL o 3D nem tenta carregar', async () => {
    const p = montarPagina({ webgl: false })
    const { v } = await iniciar(p)
    expect(v.suportado).toBe(false)
    expect(await v.ativar()).toBe(false)
    expect(cenaFalsa.chamadas).toEqual([])
    expect(v.situacao()).toBe('indisponivel')
  })

  it('com ?3d=0 na URL o 3D fica desligado mesmo havendo WebGL', async () => {
    const p = montarPagina({ busca: '?utm_source=x&3d=0' })
    const { v } = await iniciar(p)
    expect(v.suportado).toBe(false)
    expect(await v.ativar()).toBe(false)
    expect(cenaFalsa.chamadas).toEqual([])
  })

  it('se a cena não puder ser criada, ativar devolve falso e o controlador fica indisponível', async () => {
    const p = montarPagina()
    cenaFalsa.falharAoCriar = true
    const { v } = await iniciar(p)
    expect(await v.ativar()).toBe(false)
    expect(v.situacao()).toBe('indisponivel')
    expect(await v.ativar()).toBe(false)                       // não tenta de novo em laço
  })

  it('erro ao montar o modelo desliga o 3D, destrói a cena, esconde a caixa e avisa a página', async () => {
    const p = montarPagina()
    const { v, avisos } = await iniciar(p)
    expect(await v.ativar()).toBe(true)
    cenaFalsa.falharAoAtualizar = true
    v.atualizar(GALPAO)
    v.mostrar(true)
    proximoQuadro(p)
    expect(avisos).toEqual(['falhou'])
    expect(cenaFalsa.chamadas).toContain('destruir')
    expect(p.caixa.hidden).toBe(true)
    expect(v.situacao()).toBe('indisponivel')
  })

  it('erro de desenho avisado pela cena (R4) tem o mesmo efeito', async () => {
    const p = montarPagina()
    const { v, avisos } = await iniciar(p)
    await v.ativar()
    cenaFalsa.opcoes!.aoErro()
    expect(avisos).toEqual(['falhou'])
    expect(cenaFalsa.chamadas).toContain('destruir')
    expect(v.situacao()).toBe('indisponivel')
    expect(await v.ativar()).toBe(false)
  })
})

/* ------------------------------------------------------------------ montagem sob demanda */
describe('o modelo só é remontado quando precisa', () => {
  it('monta ao ficar visível, ignora mudança que não altera o desenho e remonta quando a dimensão muda', async () => {
    const p = montarPagina()
    const { v } = await iniciar(p)
    await v.ativar()
    v.atualizar(GALPAO)
    proximoQuadro(p)
    expect(cenaFalsa.chamadas.filter((c) => c.startsWith('atualizar'))).toEqual([])          // ainda não está à vista
    v.mostrar(true)
    proximoQuadro(p)
    v.atualizar({ ...GALPAO, cidade: 'Goiânia, GO', uso: 'logistico' })                      // não muda o desenho
    proximoQuadro(p)
    v.atualizar({ ...GALPAO, vao: 30 })
    proximoQuadro(p)
    expect(cenaFalsa.chamadas.filter((c) => c.startsWith('atualizar'))).toEqual(['atualizar:25', 'atualizar:30'])
  })

  it('várias mudanças no mesmo quadro viram uma remontagem só, com o último valor', async () => {
    const p = montarPagina()
    const { v } = await iniciar(p)
    await v.ativar()
    v.mostrar(true)
    for (const vao of [20, 21, 22, 23]) v.atualizar({ ...GALPAO, vao })
    expect(p.quadros.length).toBe(1)
    proximoQuadro(p)
    expect(cenaFalsa.chamadas.filter((c) => c.startsWith('atualizar'))).toEqual(['atualizar:23'])
  })

  it('dimensão fora dos limites não derruba nem remonta: fica o último modelo válido', async () => {
    const p = montarPagina()
    const { v, avisos } = await iniciar(p)
    await v.ativar()
    v.mostrar(true)
    v.atualizar(GALPAO)
    proximoQuadro(p)
    v.atualizar({ ...GALPAO, vao: 200 })
    proximoQuadro(p)
    expect(cenaFalsa.chamadas.filter((c) => c.startsWith('atualizar'))).toEqual(['atualizar:25'])
    expect(avisos).toEqual([])
  })
})

/* ------------------------------------------------------------------ R5: contexto WebGL */
describe('perda e recuperação do contexto WebGL (R5)', () => {
  it('perder o contexto pausa (não desliga); recuperar remonta o modelo e avisa a página', async () => {
    const p = montarPagina()
    const { v, avisos } = await iniciar(p)
    await v.ativar()
    v.mostrar(true)
    v.atualizar(GALPAO)
    proximoQuadro(p)
    cenaFalsa.opcoes!.aoPerderContexto()
    expect(v.situacao()).toBe('pausada')
    expect(avisos).toEqual(['pausou'])
    expect(cenaFalsa.chamadas).not.toContain('destruir')       // a cena é guardada para a volta
    expect(await v.ativar()).toBe(false)                        // enquanto pausado, a página fica nas ilustrações
    cenaFalsa.opcoes!.aoRecuperarContexto()
    expect(v.situacao()).toBe('pronta')
    expect(avisos).toEqual(['pausou', 'retomou'])
    proximoQuadro(p)
    expect(cenaFalsa.chamadas.filter((c) => c.startsWith('atualizar'))).toEqual(['atualizar:25', 'atualizar:25'])   // remontado no contexto novo
  })

  it('perder o contexto com a cena ampliada fecha a ampliação e devolve a caixa ao painel', async () => {
    const p = montarPagina()
    const { v } = await iniciar(p)
    await v.ativar()
    p.cam.ampliar!.disparar('click')
    expect(p.caixa.parent!.tag).toBe('dialog')
    cenaFalsa.opcoes!.aoPerderContexto()
    expect(p.caixa.parent).toBe(p.painel)
    expect(p.caixa.classList.contains('sim-3d--ampliada')).toBe(false)
    expect(v.situacao()).toBe('pausada')
  })

  it('aviso de recuperação sem ter havido perda não muda nada', async () => {
    const p = montarPagina()
    const { v, avisos } = await iniciar(p)
    await v.ativar()
    cenaFalsa.opcoes!.aoRecuperarContexto()
    expect(v.situacao()).toBe('pronta')
    expect(avisos).toEqual([])
  })
})

/* ------------------------------------------------------------------ R1: teclado */
describe('teclado dentro do bloco 3D (R1)', () => {
  it('Enter com o foco na cena NÃO chega ao formulário', async () => {
    const p = montarPagina()
    await iniciar(p)
    p.tela.disparar('keydown', { key: 'Enter' })
    expect(p.teclasNoForm).toEqual([])
  })

  it('Enter num botão do 3D não chega ao formulário e não tem o clique cancelado', async () => {
    const p = montarPagina()
    await iniciar(p)
    for (const b of [p.modos.estrutura!, p.cam.frente!, p.cam.ampliar!]) {
      const e = b.disparar('keydown', { key: 'Enter' })
      expect(e.defaultPrevented).toBe(false)                    // o Enter continua sendo o clique do botão
    }
    expect(p.teclasNoForm).toEqual([])
  })

  it('Tab, setas e Escape continuam subindo: só o Enter é barrado', async () => {
    const p = montarPagina()
    await iniciar(p)
    for (const key of ['Tab', 'ArrowLeft', 'Escape', ' ']) p.tela.disparar('keydown', { key })
    expect(p.teclasNoForm).toEqual(['Tab', 'ArrowLeft', 'Escape', ' '])
  })

  it('Enter num campo do formulário, fora do bloco 3D, continua chegando ao formulário', async () => {
    const p = montarPagina()
    await iniciar(p)
    const campo = p.form.appendChild(new El('input'))
    campo.disparar('keydown', { key: 'Enter' })
    expect(p.teclasNoForm).toEqual(['Enter'])
  })
})

/* ------------------------------------------------------------------ controles */
describe('controles do 3D', () => {
  it('os três modos chegam à cena, marcam o botão e não tocam no selo', async () => {
    const p = montarPagina()
    const { v } = await iniciar(p)
    await v.ativar()
    expect(p.selo.textContent).toBe(SELO_3D)
    for (const m of ['estrutura', 'interior', 'arquitetura']) {
      p.modos[m]!.disparar('click')
      expect(v.modo()).toBe(m)
      expect(p.modos[m]!.attrs['aria-pressed']).toBe('true')
      expect(p.selo.textContent).toBe(SELO_3D)
      expect(p.selo.hidden).toBe(false)
    }
    expect(cenaFalsa.chamadas.filter((c) => c.startsWith('modo:'))).toEqual(['modo:estrutura', 'modo:interior', 'modo:arquitetura'])
  })

  it('vistas, zoom e restaurar chegam à cena', async () => {
    const p = montarPagina()
    const { v } = await iniciar(p)
    await v.ativar()
    for (const c of ['frente', 'topo', 'mais', 'menos', 'restaurar']) p.cam[c]!.disparar('click')
    expect(cenaFalsa.chamadas.slice(1)).toEqual(['vista:frente', 'vista:topo', 'zoom:0.82', 'zoom:1.22', 'restaurar'])
  })

  it('antes de a cena existir, os botões não fazem nada e não lançam erro', async () => {
    const p = montarPagina()
    await iniciar(p)
    expect(() => { p.modos.estrutura!.disparar('click'); p.cam.ampliar!.disparar('click') }).not.toThrow()
    expect(cenaFalsa.chamadas).toEqual([])
  })

  it('ampliar leva a caixa para um diálogo modal; fechar (botão ou Esc nativo) devolve ao mesmo lugar', async () => {
    const p = montarPagina()
    const { v } = await iniciar(p)
    await v.ativar()
    const indice = p.painel.children.indexOf(p.caixa)
    p.cam.ampliar!.disparar('click')
    const dialogo = p.caixa.parent!
    expect(dialogo.tag).toBe('dialog')
    expect(dialogo.open).toBe(true)
    expect(p.cam.ampliar!.textContent).toBe('Fechar')
    expect(p.raiz.classList.contains('sim-3d-travada')).toBe(true)
    dialogo.close()                                             // é o que o Esc faz num <dialog> modal
    expect(p.caixa.parent).toBe(p.painel)
    expect(p.painel.children.indexOf(p.caixa)).toBe(indice)
    expect(p.cam.ampliar!.textContent).toBe('Ampliar')
    expect(p.raiz.classList.contains('sim-3d-travada')).toBe(false)
    p.cam.ampliar!.disparar('click')
    p.cam.ampliar!.disparar('click')                            // pelo botão
    expect(p.caixa.parent).toBe(p.painel)
    expect(dialogo.open).toBe(false)
  })

  it('sem <dialog> nativo, Esc no documento fecha a ampliação', async () => {
    const p = montarPagina({ dialogoNativo: false })
    const { v } = await iniciar(p)
    await v.ativar()
    p.cam.ampliar!.disparar('click')
    expect(p.caixa.classList.contains('sim-3d--ampliada')).toBe(true)
    p.raiz.disparar('keydown', { key: 'Escape' })
    expect(p.caixa.classList.contains('sim-3d--ampliada')).toBe(false)
    expect(p.caixa.parent).toBe(p.painel)
  })

  it('esconder a vista 3D com a cena ampliada fecha a ampliação', async () => {
    const p = montarPagina()
    const { v } = await iniciar(p)
    await v.ativar()
    v.mostrar(true)
    p.cam.ampliar!.disparar('click')
    v.mostrar(false)
    expect(p.caixa.parent).toBe(p.painel)
  })
})
