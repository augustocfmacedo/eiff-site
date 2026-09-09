/**
 * Hero 3D — a estrutura enxergada antes de existir.
 * Terreno procedural com curvas de nível, limite do lote e o galpão desenhado em linhas
 * na ordem de montagem: grade → fundações → pórticos → terças → contraventamento → cotas.
 */
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { criarLinhas, criarTerreno, gerarPartes, setCam, setO, setP, type Linhas } from './desenho'

export function iniciarHero3d(canvas: HTMLCanvasElement, pronto: Promise<void>, reduzMovimento: boolean) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 600)
  const alvo = new THREE.Vector3(0, 5, 0)

  const P = gerarPartes()
  const terreno = criarTerreno()
  const grade = criarLinhas(P.grade, 0.09)
  const limite = criarLinhas(P.limite, 0.7)
  const fundacoes = criarLinhas(P.fundacoes, 0.4)
  const frames = criarLinhas(P.frames.flat().map((s, i, arr) => ({ ...s, t: 0.3 + 0.35 * (Math.floor(i / (arr.length / 9)) / 9) + s.t * 0.035 })), 0.55)
  const tercas = criarLinhas(P.tercas.map((s) => ({ ...s, t: 0.66 + s.t * 0.16 })), 0.45)
  const contraventos = criarLinhas(P.contraventos.map((s) => ({ ...s, t: 0.82 + s.t * 0.12 })), 0.4)
  const cotas = criarLinhas(P.cotas.map((s) => ({ ...s, t: 0.94 + s.t * 0.06 })), 0.9)
  const fund = fundacoes; setP(fund, 0)
  scene.add(terreno, grade, limite, fund, frames, tercas, contraventos, cotas)
  const camadas: Linhas[] = [grade, limite, fund, frames, tercas, contraventos, cotas]
  const opacidades = camadas.map((l) => l.material.uniforms.uOpacidade.value as number)

  const estado = { progresso: 0, orbita: 0, mouseX: 0, mouseY: 0, scroll: 0, ativo: true }
  const base = { raio: 82, altura: 28, ang: 0.62, desloc: 0 }

  const redimensionar = () => {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h; camera.updateProjectionMatrix()
    base.raio = w < 700 ? 118 : w < 1100 ? 96 : 82
    base.desloc = w < 1100 ? 0 : -14
  }
  redimensionar()
  window.addEventListener('resize', redimensionar)

  const alvoMouse = { x: 0, y: 0 }
  if (!reduzMovimento) window.addEventListener('mousemove', (e) => {
    alvoMouse.x = (e.clientX / window.innerWidth - 0.5) * 2
    alvoMouse.y = (e.clientY / window.innerHeight - 0.5) * 2
  }, { passive: true })

  // Progresso global → cada camada desenha na sua janela (grade 0–.14, limite .1–.3, fundações .14–.3, resto conforme t)
  const aplicarProgresso = (p: number) => {
    setP(grade, Math.min(1, p / 0.14))
    setP(limite, Math.min(1, Math.max(0, (p - 0.08) / 0.22)))
    setP(fund, Math.min(1, Math.max(0, (p - 0.16) / 0.16)))
    for (const l of [frames, tercas, contraventos, cotas]) setP(l, p)
  }

  const render = () => {
    if (!estado.ativo) return
    estado.mouseX += (alvoMouse.x - estado.mouseX) * 0.04
    estado.mouseY += (alvoMouse.y - estado.mouseY) * 0.04
    const ang = base.ang + estado.orbita + estado.mouseX * 0.06
    const sc = estado.scroll
    camera.position.set(
      Math.sin(ang) * base.raio * (1 + sc * 0.6),
      base.altura + sc * 80 - estado.mouseY * 3,
      Math.cos(ang) * base.raio * (1 + sc * 0.6),
    )
    alvo.set(base.desloc, 5 - sc * 4, 0)
    camera.lookAt(alvo)
    setCam(scene, camera.position)
    aplicarProgresso(estado.progresso)
    renderer.render(scene, camera)
  }
  gsap.ticker.add(render)

  if (reduzMovimento) estado.progresso = 1
  else {
    gsap.to(estado, { orbita: 0.12, duration: 40, ease: 'sine.inOut', yoyo: true, repeat: -1 })
    pronto.then(() => gsap.to(estado, { progresso: 1, duration: 4.6, ease: 'power2.inOut', delay: 0.1 }))
  }

  // Scroll: a câmera sobe e a cena se dissolve conforme o hero sai.
  ScrollTrigger.create({
    trigger: canvas.closest('.hero'), start: 'top top', end: 'bottom top', scrub: 0.5,
    onUpdate: (self) => {
      estado.scroll = self.progress
      const op = 1 - Math.min(1, self.progress * 1.3)
      camadas.forEach((l, i) => setO(l, opacidades[i] * op))
      ;(terreno.material as THREE.ShaderMaterial).uniforms.uOpacidade.value = op
    },
    onLeave: () => { estado.ativo = false },
    onEnterBack: () => { estado.ativo = true },
  })
  document.addEventListener('visibilitychange', () => { estado.ativo = !document.hidden && ScrollTrigger.isInViewport(canvas) })
}
