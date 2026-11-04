/**
 * Processo EIFF conduzido pelo scroll: uma cena 3D contínua (terreno → modelo → fundações →
 * fabricação → transporte → montagem → entrega), copy sincronizada e trilho de navegação.
 */
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { App } from '../core/app'
import type { Processo3d } from './processo3d'

const NOMES = ['Entender', 'Projetar', 'Validar', 'Fabricar', 'Transportar', 'Montar', 'Entregar']
const N = NOMES.length

export function iniciarFilme(app: App, reduzMovimento: boolean) {
  const pin = document.getElementById('filmePin')
  const canvas = document.getElementById('filmeCanvas') as HTMLCanvasElement | null
  if (!pin) return
  const passos = Array.from(pin.querySelectorAll<HTMLElement>('#filmeStep > div'))
  const nums = Array.from(pin.querySelectorAll<HTMLElement>('#filmeNum span'))
  const botoes = Array.from(pin.querySelectorAll<HTMLButtonElement>('#filmeRail button'))
  const cur = document.getElementById('filmeCur')
  const nome = document.getElementById('filmeName')
  let atual = -1
  let cena: Processo3d | null = null
  let progresso = 0

  // A cena do Processo não é mais baixada no carregamento. Ela ficava a umas
  // cinco mil linhas de rolagem do topo e, ao ser importada de imediato,
  // arrastava o three.js inteiro junto — 469 KB chegando aos 269 ms, antes
  // mesmo de o hero precisar dele, para uma seção que muita gente não alcança.
  //
  // Agora carrega quando a seção se aproxima, com uma tela de antecedência:
  // tempo de sobra para montar antes de entrar em quadro, e nada baixado para
  // quem não desce até lá. Quem abre a página já perto dela (link direto,
  // recarga no meio do caminho) carrega na hora.
  if (canvas && window.WebGLRenderingContext) {
    let pedida = false
    const carregar = () => {
      if (pedida) return
      pedida = true
      import('./processo3d').then(({ iniciarProcesso3d }) => {
        cena = iniciarProcesso3d(canvas, reduzMovimento)
        cena.progresso = progresso
        cena.ativo = ScrollTrigger.isInViewport(pin)
      }).catch(() => canvas.remove())
    }
    const pertoDaqui = () => pin.getBoundingClientRect().top < window.innerHeight * 2
    ScrollTrigger.create({ trigger: pin, start: 'top bottom+=100%', once: true, onEnter: carregar })
    if (pertoDaqui()) carregar()
    // Entrada por âncora (#processo) salta para cá depois do preloader, quando a
    // conta acima já rodou e ainda dava "longe". Confere de novo no fim da entrada.
    app.pronto.then(() => { if (pertoDaqui()) carregar() })
  }

  gsap.set(passos, { opacity: 0, y: 24 })
  gsap.set(nums, { yPercent: (i) => i * 100 })

  const mostrar = (i: number) => {
    if (i === atual) return
    const anterior = atual
    atual = i
    if (anterior >= 0) gsap.to(passos[anterior], { opacity: 0, y: -18, duration: 0.45, ease: 'power2.in', overwrite: true })
    gsap.fromTo(passos[i], { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: anterior >= 0 ? 0.25 : 0, overwrite: true })
    gsap.to(nums, { yPercent: (k) => (k - i) * 100, duration: 0.9, ease: 'power4.inOut' })
    botoes.forEach((b, k) => { b.classList.toggle('is-active', k === i); b.setAttribute('aria-selected', String(k === i)) })
    if (cur) cur.textContent = String(i + 1).padStart(2, '0')
    if (nome) nome.textContent = NOMES[i]
  }

  const st = ScrollTrigger.create({
    trigger: pin, pin: true, start: 'top top', end: `+=${N * 95}%`, scrub: true, anticipatePin: 1,
    onUpdate: (self) => {
      progresso = self.progress * N
      if (cena) cena.progresso = progresso
      const i = Math.min(N - 1, Math.floor(progresso)), local = progresso - i
      botoes.forEach((b, k) => b.style.setProperty('--p', k < i ? '1' : k === i ? String(local) : '0'))
      mostrar(i)
    },
    onEnter: () => { if (cena) cena.ativo = true }, onEnterBack: () => { if (cena) cena.ativo = true },
    onLeave: () => { if (cena) cena.ativo = false },
  })
  // Renderiza também um pouco antes/depois do pin, para não haver quadro vazio na chegada.
  ScrollTrigger.create({ trigger: pin, start: 'top bottom', onEnter: () => { if (cena) cena.ativo = true }, onLeaveBack: () => { if (cena) cena.ativo = false } })

  botoes.forEach((b, k) => b.addEventListener('click', () => {
    const y = st.start + ((k + 0.08) / N) * (st.end - st.start)
    app.scrollPara(y, { offset: 0 })
  }))

  // Saída para quem não quer percorrer as sete etapas pelo scroll.
  document.getElementById('filmePular')?.addEventListener('click', () => {
    app.scrollPara(st.end + 1, { offset: 0 })
  })

  mostrar(0)
}
