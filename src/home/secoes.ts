/**
 * Seções da Home além do hero e do filme:
 * manifesto (palavras acendem no scroll), engenharia (desenho progressivo),
 * projeto destacado (parallax), fabricação (percurso horizontal), soluções (imagem flutuante)
 * e HUD do hero.
 */
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { App } from '../core/app'
import { registrarSite } from '../core/eventos'

const ETAPAS_ENG = ['Grade e eixos', 'Pórtico e cotas', 'Nós e ligações', 'Fundações, piso e interfaces', 'Marcas e lotes', 'Sequência de içamento']
const NOMES_ENG = ['01 · Concepção', '02 · Modelagem', '03 · Detalhamento', '04 · Compatibilização', '05 · Fabricação', '06 · Montagem']

export function iniciarManifesto(reduzMovimento: boolean) {
  const el = document.getElementById('manifestoText')
  if (!el) return
  const partes: string[] = []
  el.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      n.textContent!.split(/\s+/).filter(Boolean).forEach((w) => partes.push(`<span class="w">${w}</span>`))
    } else if (n instanceof HTMLElement) {
      n.textContent!.split(/\s+/).filter(Boolean).forEach((w) => partes.push(`<span class="w w--brand">${w}</span>`))
    }
  })
  el.innerHTML = partes.join(' ')
  const palavras = el.querySelectorAll('.w')
  // Sem movimento: o manifesto é o melhor texto do site, não pode depender do scroll.
  if (reduzMovimento) {
    gsap.set(palavras, { opacity: 1 })
    return
  }
  gsap.to(palavras, {
    opacity: 1, stagger: 0.06, ease: 'none',
    scrollTrigger: { trigger: el, start: 'top 78%', end: 'bottom 45%', scrub: 0.4 },
  })
}

export function iniciarHudHero() {
  const itens = Array.from(document.querySelectorAll<HTMLElement>('#heroHud > div'))
  if (!itens.length) return
  let i = 0
  setInterval(() => {
    i = (i + 1) % itens.length
    itens.forEach((el, k) => el.classList.toggle('is-on', k === i))
  }, 3200)
}

export function iniciarEngenharia(reduzMovimento: boolean) {
  const fig = document.getElementById('engFig')
  const lista = document.getElementById('engList')
  if (!fig || !lista) return
  const itens = Array.from(lista.querySelectorAll<HTMLElement>('.eng__item'))
  const camadas = Array.from(fig.querySelectorAll<SVGGElement>('[data-layer]'))
  const hudA = document.getElementById('engHudA'), hudB = document.getElementById('engHudB')

  const desenhos = camadas.map((c) => Array.from(c.querySelectorAll<SVGElement>('.draw > *')))
  const textos = camadas.map((c) => Array.from(c.querySelectorAll<SVGElement>('.txt')))
  const estado = camadas.map(() => false)

  if (!reduzMovimento) {
    desenhos.forEach((ds) => gsap.set(ds, { drawSVG: '0%' }))
    textos.forEach((ts) => gsap.set(ts, { opacity: 0 }))
  }

  const aplicar = (k: number) => {
    camadas.forEach((_, i) => {
      const deve = i <= k
      if (deve === estado[i]) return
      estado[i] = deve
      if (reduzMovimento) { gsap.set(desenhos[i], { drawSVG: deve ? '100%' : '0%' }); gsap.set(textos[i], { opacity: deve ? 1 : 0 }); return }
      if (deve) {
        gsap.to(desenhos[i], { drawSVG: '100%', duration: 1.1, ease: 'power2.inOut', stagger: 0.03, overwrite: true })
        gsap.to(textos[i], { opacity: 1, duration: 0.5, delay: 0.5, overwrite: true })
      } else {
        gsap.to(desenhos[i], { drawSVG: '0%', duration: 0.5, ease: 'power2.in', overwrite: true })
        gsap.to(textos[i], { opacity: 0, duration: 0.25, overwrite: true })
      }
    })
    itens.forEach((it, i) => it.classList.toggle('is-active', i === k))
    if (hudA) hudA.textContent = NOMES_ENG[k]
    if (hudB) hudB.textContent = ETAPAS_ENG[k]
  }

  itens.forEach((it, i) => {
    ScrollTrigger.create({
      trigger: it, start: 'top 62%', end: 'bottom 62%',
      onEnter: () => aplicar(i), onEnterBack: () => aplicar(i),
    })
  })
  // Desenha a primeira camada assim que a figura aparece.
  ScrollTrigger.create({ trigger: fig, start: 'top 80%', once: true, onEnter: () => aplicar(0) })
  itens.forEach((it, i) => it.addEventListener('click', () => aplicar(i)))
}

export function iniciarDestaque() {
  const bg = document.getElementById('destaqueBg')
  if (!bg) return
  gsap.fromTo(bg, { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: bg.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } })
}

export function iniciarFabricacao(app: App) {
  const pin = document.getElementById('fabPin')
  const track = document.getElementById('fabTrack')
  const barra = document.getElementById('fabProgress')
  const pecas = document.getElementById('fabPecas')
  if (!pin || !track) return
  const paineis = Array.from(track.querySelectorAll<HTMLElement>('.fab__panel'))
  const estacoes = Array.from(pin.querySelectorAll<HTMLButtonElement>('[data-fab]'))
  const distancia = () => Math.max(0, track.scrollWidth - window.innerWidth)

  const marcar = (i: number) => estacoes.forEach((b, k) => {
    b.classList.toggle('is-active', k === i)
    b.setAttribute('aria-selected', String(k === i))
  })

  const tween = gsap.to(track, {
    x: () => -distancia(), ease: 'none',
    scrollTrigger: {
      trigger: pin, pin: true, start: 'top top', end: () => `+=${distancia() + window.innerHeight * 0.4}`, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1,
      onUpdate: (self) => {
        if (barra) barra.style.transform = `scaleX(${self.progress})`
        if (pecas) pecas.style.transform = `translate(${-self.progress * distancia() * 0.35}px, -50%)`
        // Estação ativa: o último painel cuja borda esquerda já passou do lado esquerdo da tela.
        const x = self.progress * distancia()
        let i = 0
        paineis.forEach((p, k) => { if (p.offsetLeft <= x + 8) i = k })
        marcar(i)
      },
    },
  })
  const st = tween.scrollTrigger!

  // Âncoras: cada estação leva ao ponto de scroll em que o painel entra na tela.
  estacoes.forEach((b, k) => b.addEventListener('click', () => {
    const d = distancia()
    const alvo = d === 0 ? 0 : Math.min(1, (paineis[k]?.offsetLeft ?? 0) / d)
    app.scrollPara(st.start + alvo * (st.end - st.start) + 1, { offset: 0 })
  }))

  // Saída para quem não quer percorrer as seis estações pelo scroll.
  document.getElementById('fabPular')?.addEventListener('click', () => {
    app.scrollPara(st.end + 1, { offset: 0 })
  })
}

export function iniciarSolucoes(temMouse: boolean) {
  const rows = document.getElementById('solRows')
  const flutuante = document.getElementById('solFloat')
  if (!rows || !flutuante || !temMouse) return
  const links = Array.from(rows.querySelectorAll<HTMLAnchorElement>('.sol__row'))
  const imgs = links.map((a) => {
    const img = document.createElement('img'); img.src = (a.dataset.img || '').replace(/.jpg$/, '-800.jpg'); img.alt = ''; img.loading = 'lazy'
    flutuante.appendChild(img); return img
  })
  const x = gsap.quickTo(flutuante, 'left', { duration: 0.6, ease: 'power3' })
  const y = gsap.quickTo(flutuante, 'top', { duration: 0.6, ease: 'power3' })
  const mover = (e: MouseEvent) => { x(e.clientX); y(e.clientY) }
  links.forEach((a, i) => {
    a.addEventListener('mouseenter', (e) => { imgs.forEach((im, k) => im.classList.toggle('is-on', k === i)); flutuante.classList.add('is-on'); mover(e) })
    a.addEventListener('mousemove', mover)
    a.addEventListener('mouseleave', () => flutuante.classList.remove('is-on'))
  })
}

export function iniciarProdutoIso() {
  const svg = document.getElementById('produtoIso')
  if (!svg) return
  const paths = svg.querySelectorAll('.iso')
  gsap.set(paths, { drawSVG: '0%' })
  ScrollTrigger.create({ trigger: svg, start: 'top 85%', once: true, onEnter: () => gsap.to(paths, { drawSVG: '100%', duration: 1.4, ease: 'power2.inOut', stagger: 0.08 }) })
}

/**
 * Chegada à seção Projetos: é o sinal de que o visitante quis ver obra feita,
 * e o único ponto de medição de rolagem da home. Dispara uma vez por carga.
 */
function medirChegadaProjetos() {
  const alvo = document.getElementById('projetos')
  if (!alvo) return
  ScrollTrigger.create({ trigger: alvo, start: 'top 70%', once: true, onEnter: () => registrarSite('secao_projetos') })
}

export function iniciarHome(app: App, reduzMovimento: boolean, temMouse: boolean) {
  iniciarManifesto(reduzMovimento)
  iniciarHudHero()
  iniciarEngenharia(reduzMovimento)
  iniciarDestaque()
  iniciarFabricacao(app)
  iniciarSolucoes(temMouse)
  iniciarProdutoIso()
  medirChegadaProjetos()
}
