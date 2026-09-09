/**
 * Processo EIFF em uma única cena 3D contínua, conduzida pelo scroll (p de 0 a 7):
 * 0 Entender (terreno e lote) → 1 Projetar (modelo em linhas) → 2 Validar (fundações, piso, interfaces)
 * → 3 Fabricar (um pórtico explode em peças e converge) → 4 Transportar (pórticos chegam deitados)
 * → 5 Montar (pórticos levantam em sequência, cabo do guindaste) → 6 Entregar (painéis, cotas, vista final).
 */
import * as THREE from 'three'
import gsap from 'gsap'
import { COMP, CUME, FRAME_CENTRAL, PASSO, PE, VAO, Z0, criarLinhas, criarPaineis, criarTerreno, gerarPartes, janela, lerp, setCam, setO, setP, suave, type Linhas, type Segmento } from './desenho'

interface Chave { pos: [number, number, number]; alvo: [number, number, number] }
const CAMERA: Chave[] = [
  { pos: [40, 118, 82], alvo: [0, 0, 0] },
  { pos: [78, 46, 78], alvo: [0, 6, 0] },
  { pos: [60, 18, 66], alvo: [0, 4, 0] },
  { pos: [34, 16, 40], alvo: [0, 7, 0] },
  { pos: [120, 34, 40], alvo: [40, 4, 0] },
  { pos: [66, 22, 74], alvo: [0, 8, 0] },
  { pos: [84, 30, 88], alvo: [-6, 6, 0] },
  { pos: [96, 36, 100], alvo: [-6, 6, 0] },
]

/** Um pórtico físico: quatro partes (pilar E, pilar D, viga E, viga D) para poder explodir. */
function criarPortico(F: Segmento[], z: number) {
  const g = new THREE.Group()
  const local = F.map((s) => ({ ...s, a: s.a.clone().setZ(0), b: s.b.clone().setZ(0), t: 0, acento: 0 }))
  const partes: { filtro: (s: Segmento) => boolean; explode: THREE.Vector3 }[] = [
    { filtro: (s) => s.a.x < -1 && s.b.x < -1 && Math.max(s.a.y, s.b.y) <= PE + 0.01 && Math.abs(s.a.x - s.b.x) < 0.01, explode: new THREE.Vector3(-9, -2, 0) },
    { filtro: (s) => s.a.x > 1 && s.b.x > 1 && Math.max(s.a.y, s.b.y) <= PE + 0.01 && Math.abs(s.a.x - s.b.x) < 0.01, explode: new THREE.Vector3(9, -2, 0) },
    { filtro: (s) => (s.a.x + s.b.x) / 2 < 0 && Math.max(s.a.y, s.b.y) > PE - 2, explode: new THREE.Vector3(-4, 7, 0) },
    { filtro: (s) => (s.a.x + s.b.x) / 2 >= 0 && Math.max(s.a.y, s.b.y) > PE - 2, explode: new THREE.Vector3(4, 7, 0) },
  ]
  const usados = new Set<Segmento>()
  const filhos = partes.map(({ filtro, explode }) => {
    const segs = local.filter((s) => !usados.has(s) && filtro(s))
    segs.forEach((s) => usados.add(s))
    const l = criarLinhas(segs, 0.9)
    setP(l, 1); l.userData.explode = explode
    g.add(l)
    return l
  })
  g.position.set(0, 0, z)
  return { g, filhos }
}

export function iniciarProcesso3d(canvas: HTMLCanvasElement, reduzMovimento: boolean) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 700)

  const P = gerarPartes()
  const terreno = criarTerreno(300)
  const grade = criarLinhas(P.grade, 0.09); setP(grade, 1)
  const limite = criarLinhas(P.limite, 0.85)
  const eixos = criarLinhas(P.eixos, 0.35)
  const fundacoes = criarLinhas(P.fundacoes, 0.6)
  const interfaces = criarLinhas(P.interfaces, 0.9)
  const modelo = criarLinhas(P.frames.flat().map((s, i, arr) => ({ ...s, t: Math.floor(i / (arr.length / 9)) / 9 * 0.8 + s.t * 0.1 })), 0.5)
  const tercas = criarLinhas(P.tercas, 0.45)
  const contraventos = criarLinhas(P.contraventos, 0.4)
  const cotas = criarLinhas(P.cotas, 0.95)
  const paineis = criarPaineis()
  const porticos = P.frames.map((F, i) => criarPortico(F, Z0 + i * PASSO))
  const cabo = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xe2582d, transparent: true, opacity: 0 }))
  scene.add(terreno, grade, limite, eixos, fundacoes, interfaces, modelo, tercas, contraventos, cotas, paineis, cabo, ...porticos.map((p) => p.g))
  // Cena vista de mais longe que o hero: fade por distância mais amplo.
  scene.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined; if (m?.uniforms?.uFade) m.uniforms.uFade.value.set(150, 290) })

  const estado = { p: 0, ativo: false, mouseX: 0, mouseY: 0 }
  const alvoMouse = { x: 0, y: 0 }
  if (!reduzMovimento) window.addEventListener('mousemove', (e) => {
    alvoMouse.x = (e.clientX / window.innerWidth - 0.5) * 2; alvoMouse.y = (e.clientY / window.innerHeight - 0.5) * 2
  }, { passive: true })

  const redimensionar = () => {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix()
  }
  redimensionar(); window.addEventListener('resize', redimensionar)

  const N = porticos.length
  const pos = new THREE.Vector3(), alvo = new THREE.Vector3()
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3()

  const aplicar = (p: number) => {
    const s = Math.min(6, Math.floor(p)), l = Math.min(1, p - s), e = suave(l)

    // Câmera: interpola entre chaves; leve deslocamento pelo mouse.
    const A = CAMERA[s], B = CAMERA[s + 1]
    pos.set(lerp(A.pos[0], B.pos[0], e), lerp(A.pos[1], B.pos[1], e), lerp(A.pos[2], B.pos[2], e))
    alvo.set(lerp(A.alvo[0], B.alvo[0], e), lerp(A.alvo[1], B.alvo[1], e), lerp(A.alvo[2], B.alvo[2], e))
    const larguraTela = canvas.clientWidth || window.innerWidth
    if (larguraTela < 1080) pos.multiplyScalar(1.25)
    pos.x += estado.mouseX * 3; pos.y -= estado.mouseY * 2
    camera.position.copy(pos); camera.lookAt(alvo)

    // 0 · Entender — limite do lote desenha; 1 · Projetar — eixos e modelo; terças no fim
    setP(limite, s === 0 ? l : 1)
    setO(limite, s < 4 ? 0.85 : lerp(0.85, 0.25, s === 4 ? e : 1))
    setP(eixos, s === 0 ? 0 : s === 1 ? Math.min(1, l * 2.5) : 1)
    setP(modelo, s === 0 ? 0 : s === 1 ? l : 1)
    const opModelo = s <= 2 ? 0.5 : s === 3 ? lerp(0.5, 0.2, e) : s < 6 ? 0.2 : lerp(0.2, 0, e)
    setO(modelo, opModelo)
    setP(tercas, s === 1 ? janela(l, 0.7, 1) : s >= 2 ? 1 : 0)
    setP(contraventos, s === 1 ? janela(l, 0.8, 1) : s >= 2 ? 1 : 0)
    const opSec = s <= 2 ? 0.45 : s < 6 ? 0.16 : lerp(0.16, 0.7, e)
    setO(tercas, opSec); setO(contraventos, opSec * 0.9)

    // 2 · Validar — fundações e interfaces
    setP(fundacoes, s === 2 ? l : s > 2 ? 1 : 0)
    setP(interfaces, s === 2 ? janela(l, 0.35, 1) : s > 2 ? 1 : 0)
    setO(interfaces, s === 2 ? 0.9 : s === 3 ? lerp(0.9, 0.3, e) : s < 6 ? 0.3 : lerp(0.3, 0, e))
    setO(fundacoes, s < 6 ? 0.6 : lerp(0.6, 0.3, e))

    // 3 · Fabricar — pórtico central explode e converge; 4 · Transportar — chegam deitados; 5 · Montar — levantam
    let caboOn = false
    porticos.forEach(({ g, filhos }, i) => {
      const zi = Z0 + i * PASSO
      let op = 0, explode = 0, dx = 0, rot = 0, dy = 0
      if (s === 3) {
        if (i === FRAME_CENTRAL) { op = janela(l, 0, 0.15); explode = Math.sin(Math.min(1, l / 0.85) * Math.PI) * (l < 0.85 ? 1 : 0) }
      } else if (s === 4) {
        const chegada = janela(l, 0.05 + (i / N) * 0.55, 0.35 + (i / N) * 0.55)
        op = i === FRAME_CENTRAL ? Math.max(janela(1 - l, 0.85, 1), janela(l, 0.02, 0.1)) : janela(l, 0.02, 0.1)
        dx = (1 - chegada) * 130; rot = -Math.PI / 2; dy = 0.6
      } else if (s === 5) {
        const t0 = (i / N) * 0.78, up = janela(l, t0, t0 + 0.24)
        op = 1; rot = -Math.PI / 2 * (1 - up); dy = 0.6 * (1 - up)
        if (up > 0 && up < 1 && !caboOn) {
          caboOn = true
          tmpA.set(0, CUME, zi).applyAxisAngle(new THREE.Vector3(1, 0, 0), rot).add(new THREE.Vector3(0, dy, 0))
          tmpB.set(-6, CUME + 40, zi)
          cabo.geometry.setFromPoints([tmpB, tmpA])
          ;(cabo.material as THREE.LineBasicMaterial).opacity = 0.9
        }
      } else if (s >= 6) op = 1
      g.position.set(dx, dy, zi); g.rotation.x = rot
      filhos.forEach((f) => { setO(f, op * 0.9); f.position.copy((f.userData.explode as THREE.Vector3)).multiplyScalar(explode) })
    })
    if (!caboOn) (cabo.material as THREE.LineBasicMaterial).opacity = 0

    // 6 · Entregar — painéis, cotas
    ;(paineis.material as THREE.MeshBasicMaterial).opacity = s === 6 ? janela(l, 0, 0.6) * 0.5 : 0
    paineis.visible = s === 6
    setP(cotas, s === 6 ? janela(l, 0.45, 1) : 0)
  }

  const render = () => {
    if (!estado.ativo) return
    estado.mouseX += (alvoMouse.x - estado.mouseX) * 0.05; estado.mouseY += (alvoMouse.y - estado.mouseY) * 0.05
    aplicar(estado.p)
    setCam(scene, camera.position)
    renderer.render(scene, camera)
  }
  gsap.ticker.add(render)
  aplicar(0)

  return {
    set progresso(p: number) { estado.p = p },
    set ativo(a: boolean) { estado.ativo = a; if (a) render() },
    forcar() { aplicar(estado.p); setCam(scene, camera.position); renderer.render(scene, camera) },
  }
}

export type Processo3d = ReturnType<typeof iniciarProcesso3d>
export { COMP, VAO, PE }
