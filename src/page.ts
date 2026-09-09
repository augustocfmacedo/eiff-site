import './styles/main.css'
import { iniciarApp, gsap, ScrollTrigger } from './core/app'

const app = iniciarApp()

// Parallax leve nas mídias de abertura das páginas internas.
document.querySelectorAll<HTMLElement>('.page-hero__media').forEach((m) => {
  const inner = m.querySelector('img, video')
  if (!inner) return
  gsap.fromTo(inner, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: m, start: 'top bottom', end: 'bottom top', scrub: true } })
})

// Desenho progressivo de SVGs marcados.
document.querySelectorAll<SVGElement>('[data-draw]').forEach((svg) => {
  const paths = svg.querySelectorAll('path, line, circle, rect, polyline')
  gsap.set(paths, { drawSVG: '0%' })
  ScrollTrigger.create({ trigger: svg, start: 'top 85%', once: true, onEnter: () => gsap.to(paths, { drawSVG: '100%', duration: 1.6, ease: 'power2.inOut', stagger: 0.04 }) })
})

// Formulário "Iniciar um projeto" (Netlify Forms). Sem destino de e-mail configurado ainda:
// o envio fica registrado no painel do Netlify até a notificação ser definida.
const form = document.querySelector<HTMLFormElement>('form[data-netlify]')
form?.addEventListener('submit', async (e) => {
  e.preventDefault()
  const botao = form.querySelector<HTMLButtonElement>('button[type="submit"]')
  if (botao) { botao.disabled = true; botao.querySelector('span')!.textContent = 'Enviando…' }
  try {
    const dados = new FormData(form)
    const r = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(dados as unknown as Record<string, string>).toString() })
    if (!r.ok) throw new Error(String(r.status))
    form.classList.add('is-sent')
  } catch {
    if (botao) { botao.disabled = false; botao.querySelector('span')!.textContent = 'Tentar novamente' }
    form.querySelector('.form__note')!.textContent = 'Não foi possível enviar agora. Tente novamente em instantes.'
  }
})

void app
