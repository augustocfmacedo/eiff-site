/**
 * Núcleo compartilhado por todas as páginas:
 * scroll suave (Lenis + GSAP), preloader, transição entre páginas, cursor,
 * navegação, reveals, split de texto, botões magnéticos, lightbox e contadores.
 */
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin)

export const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
export const temMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches
const CHAVE_TRANSICAO = 'eiff:transicao'
const CHAVE_VISITA = 'eiff:visitou'

export interface App {
  lenis: Lenis | null
  pronto: Promise<void>
  scrollPara(alvo: number | string | HTMLElement, opts?: { offset?: number; immediate?: boolean }): void
}

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)
const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel))

/* ---------------------------------------------------------------
   Scroll suave
--------------------------------------------------------------- */
function iniciarScroll(): Lenis | null {
  if (reduzMovimento) return null
  const lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95 })
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((t) => lenis.raf(t * 1000))
  gsap.ticker.lagSmoothing(0)
  return lenis
}

/* ---------------------------------------------------------------
   Preloader + transição de entrada
--------------------------------------------------------------- */
function iniciarPreloader(lenis: Lenis | null): Promise<void> {
  const pre = $('#preloader')
  const curtain = $('#curtain')
  const html = document.documentElement
  const veioDeTransicao = sessionStorage.getItem(CHAVE_TRANSICAO) === '1'
  sessionStorage.removeItem(CHAVE_TRANSICAO)
  lenis?.stop()

  const liberar = () => {
    html.classList.remove('is-loading')
    lenis?.start()
    ScrollTrigger.refresh()
  }

  if (!pre || !curtain) return Promise.resolve().then(liberar)

  // Chegando por transição interna: a cortina já cobre a tela, basta abrir.
  if (veioDeTransicao || reduzMovimento) {
    pre.remove()
    gsap.set(curtain, { scaleY: 1, transformOrigin: 'top' })
    return new Promise((res) => {
      gsap.to(curtain, { scaleY: 0, duration: reduzMovimento ? 0.01 : 0.9, ease: 'power4.inOut', delay: 0.05, onComplete: () => { liberar(); res() } })
    })
  }

  const rapido = sessionStorage.getItem(CHAVE_VISITA) === '1'
  sessionStorage.setItem(CHAVE_VISITA, '1')
  const pecas = $$('.pz', pre)
  const pct = $('#preloaderPct', pre)
  const bar = $('#preloaderBar', pre)
  const dur = rapido ? 0.7 : 1.5

  // Peças do símbolo entram de fora para a posição final (montagem).
  // Deslocamentos em unidades do viewBox do símbolo (549 de altura).
  const origem = [
    [0, -160], [-200, -30], [-240, 16], [-190, 140], [0, 200], [0, 160], [200, -50], [230, 90],
  ]
  pecas.forEach((p, i) => gsap.set(p, { x: origem[i][0], y: origem[i][1], opacity: 0, transformOrigin: '50% 50%' }))

  const tl = gsap.timeline()
  tl.to(pecas, { x: 0, y: 0, opacity: 1, duration: dur * 0.8, ease: 'expo.out', stagger: { each: dur * 0.05, from: 'center' } }, 0)
  const contador = { v: 0 }
  tl.to(contador, { v: 100, duration: dur, ease: 'power2.inOut', onUpdate: () => { if (pct) pct.textContent = String(Math.round(contador.v)).padStart(2, '0') } }, 0)
  if (bar) tl.to(bar, { scaleX: 1, duration: dur, ease: 'power2.inOut' }, 0)

  const fontes = (document.fonts?.ready ?? Promise.resolve()).then(() => undefined)
  const timeout = new Promise<void>((r) => setTimeout(r, 2200))

  return Promise.all([fontes, Promise.race([timeout, new Promise<void>((r) => tl.eventCallback('onComplete', () => r()))])]).then(
    () =>
      new Promise<void>((res) => {
        gsap.timeline({ onComplete: () => { pre.remove(); liberar(); res() } })
          .to(pecas, { opacity: 0, y: -10, duration: 0.35, ease: 'power2.in', stagger: 0.02 })
          .to(pre, { yPercent: -100, duration: 0.9, ease: 'power4.inOut' }, '-=0.1')
      }),
  )
}

/* ---------------------------------------------------------------
   Transição de saída entre páginas
--------------------------------------------------------------- */
function iniciarTransicoes(lenis: Lenis | null) {
  const curtain = $('#curtain')
  if (!curtain) return
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]')
    if (!a) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank' || a.hasAttribute('download')) return
    const url = new URL(a.href, location.href)
    if (url.origin !== location.origin) return
    if (url.pathname === location.pathname && url.hash) return
    e.preventDefault()
    if (reduzMovimento) { location.href = url.href; return }
    sessionStorage.setItem(CHAVE_TRANSICAO, '1')
    document.body.classList.remove('menu-open')
    lenis?.stop()
    gsap.set(curtain, { transformOrigin: 'bottom' })
    gsap.to(curtain, { scaleY: 1, duration: 0.7, ease: 'power4.inOut', onComplete: () => { location.href = url.href } })
  })
  window.addEventListener('pageshow', (e) => { if (e.persisted) { gsap.set(curtain, { scaleY: 0 }); lenis?.start() } })
}

/* ---------------------------------------------------------------
   Navegação
--------------------------------------------------------------- */
function iniciarNav(lenis: Lenis | null) {
  const nav = $('#nav')
  const burger = $('#burger')
  const menu = $('#menu')
  if (!nav) return

  const pagina = document.body.dataset.page
  $$('[data-nav]', nav).forEach((a) => { if (a.dataset.nav === pagina) a.setAttribute('aria-current', 'page') })

  let ultimo = 0
  const atualizar = (y: number) => {
    nav.classList.toggle('is-scrolled', y > 40)
    const desce = y > ultimo && y > 240
    nav.classList.toggle('is-hidden', desce && !document.body.classList.contains('menu-open'))
    ultimo = y
  }
  if (lenis) lenis.on('scroll', (e: { scroll: number }) => atualizar(e.scroll))
  else window.addEventListener('scroll', () => atualizar(window.scrollY), { passive: true })

  const alternar = (abrir?: boolean) => {
    const aberto = abrir ?? !document.body.classList.contains('menu-open')
    document.body.classList.toggle('menu-open', aberto)
    burger?.setAttribute('aria-expanded', String(aberto))
    burger?.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu')
    menu?.setAttribute('aria-hidden', String(!aberto))
    if (aberto) { lenis?.stop(); nav.classList.remove('is-hidden') } else lenis?.start()
  }
  burger?.addEventListener('click', () => alternar())
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu-open')) alternar(false) })
  const ano = $('#ano'); if (ano) ano.textContent = String(new Date().getFullYear())
}

/* ---------------------------------------------------------------
   Cursor + botões magnéticos
--------------------------------------------------------------- */
function iniciarCursor() {
  const cursor = $('#cursor')
  const label = $('#cursorLabel')
  if (!cursor || !temMouse || reduzMovimento) return
  const xTo = gsap.quickTo(cursor, 'x', { duration: 0.28, ease: 'power3' })
  const yTo = gsap.quickTo(cursor, 'y', { duration: 0.28, ease: 'power3' })
  window.addEventListener('mousemove', (e) => {
    xTo(e.clientX); yTo(e.clientY)
    document.body.classList.add('has-cursor')
  }, { passive: true })
  document.addEventListener('mouseleave', () => cursor.classList.add('is-hidden'))
  document.addEventListener('mouseenter', () => cursor.classList.remove('is-hidden'))

  document.addEventListener('mouseover', (e) => {
    const t = e.target as HTMLElement
    const view = t.closest<HTMLElement>('[data-cursor]')
    const drag = t.closest<HTMLElement>('[data-cursor-drag]')
    const link = t.closest('a, button, [role="button"], label, input, select, textarea')
    cursor.classList.toggle('is-view', !!view && !drag)
    cursor.classList.toggle('is-drag', !!drag)
    cursor.classList.toggle('is-link', !!link && !view && !drag)
    if (label) label.textContent = view?.dataset.cursor || drag?.dataset.cursorDrag || 'Ver'
  })

  $$('[data-magnetic]').forEach((el) => {
    const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' })
    const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' })
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect()
      x((e.clientX - (r.left + r.width / 2)) * 0.28)
      y((e.clientY - (r.top + r.height / 2)) * 0.28)
    })
    el.addEventListener('mouseleave', () => { x(0); y(0) })
  })
}

/* ---------------------------------------------------------------
   Reveals, split de texto, linhas e contadores
--------------------------------------------------------------- */
export function dividirTexto(el: HTMLElement) {
  const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'line', autoSplit: true })
  return split
}

function iniciarReveals(pronto: Promise<void>) {
  const heroSel = '.hero, .page-hero'
  const dentroDoHero = (el: Element) => !!el.closest(heroSel)

  // Elementos fora do hero animam ao entrar na viewport.
  $$('[data-reveal]').filter((el) => !dentroDoHero(el)).forEach((el) => {
    gsap.to(el, {
      opacity: 1, y: 0, duration: 1.1, ease: 'power3.out',
      delay: parseFloat(el.dataset.revealDelay || '0'),
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    })
  })
  $$('.hr--grow').forEach((el) => {
    gsap.to(el, { scaleX: 1, duration: 1.4, ease: 'power3.inOut', scrollTrigger: { trigger: el, start: 'top 92%', once: true } })
  })

  $$('[data-split]').forEach((el) => {
    if (reduzMovimento) return
    const split = dividirTexto(el)
    const linhas = split.lines as HTMLElement[]
    gsap.set(linhas, { yPercent: 110 })
    const anim = () => gsap.to(linhas, { yPercent: 0, duration: 1.15, ease: 'power4.out', stagger: 0.09 })
    if (dentroDoHero(el)) pronto.then(() => anim())
    else ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: anim })
  })

  // Hero: espera o preloader e entra em sequência.
  pronto.then(() => {
    $$('[data-reveal]').filter(dentroDoHero).forEach((el) => {
      gsap.to(el, { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', delay: parseFloat(el.dataset.revealDelay || '0.2') })
    })
  })

  $$('[data-count]').forEach((el) => {
    const alvo = parseFloat(el.dataset.count || '0')
    const decimais = parseInt(el.dataset.decimals || '0', 10)
    const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimais, maximumFractionDigits: decimais })
    const obj = { v: 0 }
    ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: () => gsap.to(obj, { v: alvo, duration: 1.8, ease: 'power3.out', onUpdate: () => { el.textContent = fmt.format(obj.v) } }),
    })
  })
}

/* ---------------------------------------------------------------
   Lightbox de vídeo (YouTube)
--------------------------------------------------------------- */
function iniciarLightbox(lenis: Lenis | null) {
  const box = $('#lightbox')
  const frame = $('#lightboxFrame')
  const fechar = $('#lightboxClose')
  if (!box || !frame) return
  let ultimoFoco: HTMLElement | null = null
  const abrir = (id: string) => {
    frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1" title="Vídeo do projeto" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`
    box.classList.add('is-open'); box.setAttribute('aria-hidden', 'false')
    lenis?.stop(); fechar?.focus()
  }
  const close = () => {
    box.classList.remove('is-open'); box.setAttribute('aria-hidden', 'true')
    setTimeout(() => { frame.innerHTML = '' }, 400)
    lenis?.start(); ultimoFoco?.focus()
  }
  document.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-video]')
    if (t) { ultimoFoco = t; abrir(t.dataset.video!) }
  })
  fechar?.addEventListener('click', close)
  box.addEventListener('click', (e) => { if (e.target === box) close() })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && box.classList.contains('is-open')) close() })
}

/* ---------------------------------------------------------------
   Âncoras suaves
--------------------------------------------------------------- */
function iniciarAncoras(app: App) {
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]')
    if (!a || a.getAttribute('href') === '#') return
    const alvo = document.querySelector<HTMLElement>(a.getAttribute('href')!)
    if (!alvo) return
    e.preventDefault()
    app.scrollPara(alvo)
  })
  if (location.hash) {
    const alvo = document.querySelector<HTMLElement>(location.hash)
    if (alvo) app.pronto.then(() => setTimeout(() => app.scrollPara(alvo, { immediate: true }), 50))
  }
}

/* ---------------------------------------------------------------
   Bootstrap
--------------------------------------------------------------- */
export function iniciarApp(): App {
  const lenis = iniciarScroll()
  const pronto = iniciarPreloader(lenis)
  const app: App = {
    lenis,
    pronto,
    scrollPara(alvo, opts) {
      const offset = opts?.offset ?? -12
      if (lenis) lenis.scrollTo(alvo, { offset, duration: 1.4, immediate: opts?.immediate, easing: (t) => 1 - Math.pow(1 - t, 4) })
      else {
        const y = typeof alvo === 'number' ? alvo : (typeof alvo === 'string' ? document.querySelector<HTMLElement>(alvo) : alvo)?.getBoundingClientRect().top! + window.scrollY + offset
        window.scrollTo({ top: y, behavior: opts?.immediate ? 'auto' : 'smooth' })
      }
    },
  }
  iniciarTransicoes(lenis)
  iniciarNav(lenis)
  iniciarCursor()
  iniciarReveals(pronto)
  iniciarLightbox(lenis)
  iniciarAncoras(app)
  pronto.then(() => ScrollTrigger.refresh())
  window.addEventListener('load', () => ScrollTrigger.refresh())
  return app
}

export { gsap, ScrollTrigger }
