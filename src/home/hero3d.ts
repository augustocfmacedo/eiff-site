/**
 * Hero 3D — a estrutura enxergada antes de existir.
 * Terreno procedural com curvas de nível, limite do lote e o galpão desenhado em linhas
 * na ordem de montagem: grade → fundações → pórticos → terças → contraventamento → cotas.
 */
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { cotasEscritas, criarLinhas, criarTerreno, gerarPartes, setCam, setFantasma, setO, setP, setPonta, type Linhas } from './desenho'

/** Quem acende as linhas do HUD do hero, quando o desenho manda. */
export interface HudHero { destacar(i: number): void; assumir(): void }

/**
 * Marcos do desenho: a que ponto da construção cada medida do HUD corresponde.
 * O número não acende por relógio, acende quando a estrutura chega nele.
 */
const MARCOS: readonly { p: number; hud: number }[] = [
  { p: 0.34, hud: 1 }, // pilares sobem → pé-direito
  { p: 0.66, hud: 2 }, // pórticos fechados → vão
  { p: 0.86, hud: 3 }, // contraventamento → ligações parafusadas
  { p: 0.96, hud: 0 }, // cotas escritas → repousa no que já foi executado
] as const

/** Em que ponto a cumeeira fecha — o instante que o título acompanha. */
const FECHO = 0.66

export function iniciarHero3d(canvas: HTMLCanvasElement, pronto: Promise<void>, reduzMovimento: boolean, hud?: HudHero | null) {
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
  // As cotas ficam com os últimos 10% para terem tempo de serem lidas.
  const JANELA_COTAS = { base: 0.9, largura: 0.1 }
  const cotas = criarLinhas(P.cotas.map((s) => ({ ...s, t: JANELA_COTAS.base + s.t * JANELA_COTAS.largura })), 0.9)
  const fund = fundacoes; setP(fund, 0)
  scene.add(terreno, grade, limite, fund, frames, tercas, contraventos, cotas)
  const camadas: Linhas[] = [grade, limite, fund, frames, tercas, contraventos, cotas]
  const opacidades = camadas.map((l) => l.material.uniforms.uOpacidade.value as number)

  // A estrutura aparece como intenção antes de ser executada: o traço fantasma
  // cobre toda a camada à frente da linha de desenho. Vale só para o que é
  // estrutura — grade, limite e cotas não têm "projeto" a antecipar.
  const estruturais: Linhas[] = [frames, tercas, contraventos]
  for (const l of estruturais) setFantasma(l, 0, 1)
  for (const l of camadas) setPonta(l, 1)

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

  /* -------------------------------------------------------------
     Cotas escritas: o número sai do mesmo lugar de onde sai a linha
  ------------------------------------------------------------- */
  const caixaCotas = document.getElementById('heroCotas')
  const rotulos = caixaCotas
    ? cotasEscritas().map((c) => {
      const el = document.createElement('span')
      el.className = 'cota'
      el.textContent = c.texto
      caixaCotas.appendChild(el)
      // Progresso global em que a medida termina de ser desenhada.
      return { el, pos: c.pos, p: JANELA_COTAS.base + c.t * JANELA_COTAS.largura + 0.004, dentro: false }
    })
    : []
  const projetado = new THREE.Vector3()

  // Caixas realmente ocupadas pelo texto do hero. Medir `.hero__content`
  // inteiro não serve: ele é a grade e cobre também o vão vazio entre a coluna
  // de texto e o HUD, onde a cota cabe bem.
  const MARGEM = 22
  const SELETORES_OCUPADOS = '.hero__title, .hero__lead, .hero__actions, #heroHud'
  let ocupadas: DOMRect[] = []
  const medirTexto = () => {
    ocupadas = Array.from(document.querySelectorAll<HTMLElement>(SELETORES_OCUPADOS)).map((el) => el.getBoundingClientRect())
  }
  medirTexto()
  window.addEventListener('resize', medirTexto)
  // O texto entra animado: a medida definitiva só vale depois da entrada.
  pronto.then(() => setTimeout(medirTexto, 1600))

  // Histerese: a cota aparece só com folga e só desaparece quando entra fundo no
  // texto. A câmera orbita devagar e acompanha o ponteiro; sem essa banda morta
  // um rótulo parado na fronteira ficaria piscando.
  const FOLGA_SOME = -16
  const sobreTexto = (x: number, y: number, margem: number) => ocupadas.some((b) =>
    x > b.left - margem && x < b.right + margem && y > b.top - margem && y < b.bottom + margem)

  const posicionarCotas = () => {
    // offsetParent nulo = o bloco está escondido pelo CSS (telas estreitas).
    if (!rotulos.length || !caixaCotas || caixaCotas.offsetParent === null) return
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight
    for (const r of rotulos) {
      if (estado.progresso < r.p) {
        if (r.dentro) { r.dentro = false; r.el.classList.remove('is-on') }
        continue
      }
      projetado.copy(r.pos).project(camera)
      const x = (projetado.x * 0.5 + 0.5) * w
      const y = (-projetado.y * 0.5 + 0.5) * h
      const naTela = projetado.z <= 1 && x > MARGEM && x < w - MARGEM && y > MARGEM && y < h - MARGEM
      const mostrar = naTela && !sobreTexto(x, y, r.dentro ? FOLGA_SOME : MARGEM)
      // A posição é escrita mesmo quando a cota está escondida: assim ela
      // reaparece no lugar certo quando a órbita a traz de volta, sem salto.
      r.el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
      if (mostrar !== r.dentro) { r.dentro = mostrar; r.el.classList.toggle('is-on', mostrar) }
    }
  }

  /* -------------------------------------------------------------
     Marcos: o HUD e o título acompanham a estrutura, não o relógio
  ------------------------------------------------------------- */
  // O SplitText reconstrói o título (e refaz tudo ao redimensionar, com
  // autoSplit), deixando mais de um nó com a classe — um deles vazio. Por isso
  // a consulta é feita na hora e marca todos.
  const marcarFecho = (ligado: boolean) => {
    document.querySelectorAll<HTMLElement>('.hero__fecho').forEach((el) => el.classList.toggle('is-fechado', ligado))
  }
  let marco = -1
  let fechado = false
  const aplicarMarcos = (p: number) => {
    let i = -1
    MARCOS.forEach((m, k) => { if (p >= m.p) i = k })
    if (i !== marco) {
      marco = i
      if (i >= 0 && hud) hud.destacar(MARCOS[i].hud)
    }
    const fecha = p >= FECHO
    if (fecha !== fechado) { fechado = fecha; marcarFecho(fecha) }
  }

  // Progresso global → cada camada desenha na sua janela (grade 0–.14, limite .1–.3, fundações .14–.3, resto conforme t)
  const aplicarProgresso = (p: number) => {
    setP(grade, Math.min(1, p / 0.14))
    setP(limite, Math.min(1, Math.max(0, (p - 0.08) / 0.22)))
    setP(fund, Math.min(1, Math.max(0, (p - 0.16) / 0.16)))
    for (const l of [frames, tercas, contraventos, cotas]) setP(l, p)
    // O fantasma entra depois das fundações — antes disso não há o que antecipar —
    // e sai de cena quando a estrutura alcança o próprio projeto.
    const peso = Math.min(1, Math.max(0, (p - 0.2) / 0.14)) * (1 - Math.min(1, Math.max(0, (p - 0.86) / 0.12))) * 0.16
    for (const l of estruturais) setFantasma(l, peso, 1)
    aplicarMarcos(p)
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
    posicionarCotas()
  }
  gsap.ticker.add(render)

  // A partir daqui é o desenho que comanda o HUD, não o relógio.
  hud?.assumir()

  if (reduzMovimento) {
    estado.progresso = 1
    aplicarProgresso(1)
  } else {
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
      // As medidas saem junto com o desenho a que pertencem.
      if (caixaCotas) caixaCotas.style.opacity = String(op)
    },
    onLeave: () => { estado.ativo = false },
    onEnterBack: () => { estado.ativo = true },
  })
  document.addEventListener('visibilitychange', () => { estado.ativo = !document.hidden && ScrollTrigger.isInViewport(canvas) })
}
