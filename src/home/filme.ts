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

  if (canvas && window.WebGLRenderingContext) {
    import('./processo3d').then(({ iniciarProcesso3d }) => {
      cena = iniciarProcesso3d(canvas, reduzMovimento)
      cena.progresso = progresso
      cena.ativo = ScrollTrigger.isInViewport(pin)
    }).catch(() => canvas.remove())
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
  mostrar(0)
}
