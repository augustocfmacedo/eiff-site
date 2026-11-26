/**
 * CENA 3D do simulador — o único módulo do simulador que importa three.js.
 *
 * É carregado SOB DEMANDA por `visual3d.ts`; a landing continua abrindo sem
 * three.js. Desenha o que `geometria3d.ts` descreve. Não calcula nada de
 * engenharia e não mostra esforço, deslocamento, peso nem quantidade.
 *
 * Renderização sob demanda: só há quadro novo quando a configuração, o modo, o
 * tamanho ou a câmera mudam. Sem laço contínuo.
 *
 * Eixos da cena: three.js usa Y para cima. O ponto (x, y, z) do adaptador vai
 * para (x − largura/2, z, comprimento/2 − y): o oitão do eixo inicial fica de
 * frente para +Z.
 */

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  HIPOTESES_3D, elementosDaEstrutura, linhaInferiorDaViga, topoDaViga, type Elemento, type Geometria3D, type P3,
} from './geometria3d'

export type Modo = 'arquitetura' | 'estrutura' | 'interior'
export type VistaDaCamera = 'perspectiva' | 'frente' | 'lateral' | 'topo'

export interface OpcoesDaCena {
  reduzMovimento: boolean
  /** Dispositivo de toque: limita a densidade de pixels para poupar a GPU. */
  toque: boolean
  aoPerderContexto: () => void
}

export interface Cena3D {
  atualizar(g: Geometria3D): void
  definirModo(m: Modo): void
  definirVista(v: VistaDaCamera): void
  restaurar(): void
  zoom(fator: number): void
  girar(dAz: number, dEl: number): void
  estatisticas(): { chamadas: number; triangulos: number; ultimaMontagemMs: number; quadros: number }
  destruir(): void
}

const COR = {
  fundo: 0xefede8, solo: 0xe3e0da, piso: 0xcfccc6, aco: 0x2b2f33, secundario: 0x6f757c, laranja: 0xc84119,
  telhaSimples: 0xb9bdc3, termoacustica: 0xe7e8e9, pir: 0xf3f3f1, neutro: 0xd2d4d7, paredeMetalica: 0x3a3e44, alvenaria: 0xbdb7ad,
}
const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

/** Faixas claras e escuras, para a telha parecer nervurada sem geometria extra. */
function texturaDeNervuras(vertical: boolean, contraste: number): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  for (let i = 0; i < 64; i += 1) {
    const t = 0.5 + 0.5 * Math.cos((i / 16) * Math.PI * 2)
    const v = Math.round(255 * (1 - contraste * t))
    ctx.fillStyle = `rgb(${v},${v},${v})`
    if (vertical) ctx.fillRect(i, 0, 1, 64)
    else ctx.fillRect(0, i, 64, 1)
  }
  const tx = new THREE.CanvasTexture(c)
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping
  tx.colorSpace = THREE.SRGBColorSpace
  return tx
}

function texturaDeSombra(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 20, 64, 64, 64)
  g.addColorStop(0, 'rgba(20,22,24,0.28)')
  g.addColorStop(1, 'rgba(20,22,24,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

export function criarCena(tela: HTMLCanvasElement, rotulos: HTMLElement, opcoes: OpcoesDaCena): Cena3D {
  const renderizador = new THREE.WebGLRenderer({ canvas: tela, antialias: true, powerPreference: 'low-power' })
  renderizador.setPixelRatio(Math.min(window.devicePixelRatio || 1, opcoes.toque ? 1.5 : 2))
  renderizador.setClearColor(COR.fundo)
  const cena = new THREE.Scene()
  cena.fog = new THREE.Fog(COR.fundo, 200, 900)
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 4000)
  cena.add(new THREE.HemisphereLight(0xffffff, 0xb9b4ab, 1.05))
  const sol = new THREE.DirectionalLight(0xffffff, 1.5)
  sol.position.set(0.6, 1, 0.8)
  cena.add(sol)

  const nervV = texturaDeNervuras(true, 0.3)
  const nervH = texturaDeNervuras(false, 0.3)
  const sombra = texturaDeSombra()
  const mat = {
    aco: new THREE.MeshStandardMaterial({ color: COR.aco, roughness: 0.55, metalness: 0.35 }),
    secundario: new THREE.MeshStandardMaterial({ color: COR.secundario, roughness: 0.6, metalness: 0.3 }),
    laranja: new THREE.MeshStandardMaterial({ color: COR.laranja, roughness: 0.5, metalness: 0.2 }),
    piso: new THREE.MeshStandardMaterial({ color: COR.piso, roughness: 0.95 }),
    solo: new THREE.MeshBasicMaterial({ color: COR.solo }),
    sombra: new THREE.MeshBasicMaterial({ map: sombra, transparent: true, depthWrite: false }),
    cobertura: new THREE.MeshStandardMaterial({ color: COR.neutro, roughness: 0.6, metalness: 0.25, side: THREE.DoubleSide, map: nervH }),
    parede: new THREE.MeshStandardMaterial({ color: COR.neutro, roughness: 0.7, metalness: 0.15, side: THREE.DoubleSide, map: nervV }),
    oitao: new THREE.MeshStandardMaterial({ color: COR.neutro, roughness: 0.7, metalness: 0.15, side: THREE.DoubleSide }),
    cota: new THREE.LineBasicMaterial({ color: COR.laranja }),
  }

  const grupos = { base: new THREE.Group(), estrutura: new THREE.Group(), envoltoria: new THREE.Group(), cotas: new THREE.Group(), figuras: new THREE.Group() }
  Object.values(grupos).forEach((g) => cena.add(g))

  let geo: Geometria3D | null = null
  let modo: Modo = 'arquitetura'
  let quadroPedido = 0
  let quadros = 0
  let ultimaMontagemMs = 0
  let destruida = false
  let animacao = 0
  let etiquetas: { el: HTMLElement; ponto: THREE.Vector3; modos: Modo[] }[] = []

  // órbita externa e olhar interno
  const orbita = { alvo: new THREE.Vector3(), raio: 60, az: 0.95, el: 0.36 }
  const interior = { pos: new THREE.Vector3(), yaw: 0, pitch: 0.05, avanco: 0 }
  const limites = { raioMin: 5, raioMax: 600, avancoMax: 1 }
  const PADRAO: Record<VistaDaCamera, { az: number; el: number }> = {
    perspectiva: { az: 0.95, el: 0.36 }, frente: { az: Math.PI / 2, el: 0.1 }, lateral: { az: 0, el: 0.1 }, topo: { az: Math.PI / 2, el: 1.5 },
  }

  const v = (p: P3): THREE.Vector3 => new THREE.Vector3(p[0] - geo!.distanciaEntreEixos / 2, p[2], geo!.comprimento / 2 - p[1])

  function limpar(grupo: THREE.Group): void {
    while (grupo.children.length) {
      const o = grupo.children.pop() as THREE.Mesh
      o.geometry?.dispose()
    }
  }

  /** Caixa com o eixo X ao longo de a→b. `cima` orienta a altura da seção. */
  function caixaEntre(a: THREE.Vector3, b: THREE.Vector3, altura: number, largura: number, cima = new THREE.Vector3(0, 1, 0)): THREE.BufferGeometry {
    const dir = b.clone().sub(a)
    const comp = dir.length()
    dir.normalize()
    let up = cima.clone().addScaledVector(dir, -cima.dot(dir))
    if (up.lengthSq() < 1e-8) up = new THREE.Vector3(1, 0, 0).addScaledVector(dir, -dir.x)
    up.normalize()
    const lado = new THREE.Vector3().crossVectors(dir, up)
    const g = new THREE.BoxGeometry(comp, altura, largura)
    g.applyMatrix4(new THREE.Matrix4().makeBasis(dir, up, lado).setPosition(a.clone().add(b).multiplyScalar(0.5)))
    return g
  }

  /** Um pórtico de alma cheia no plano Z = 0 da cena: pilares, vigas com mísula, chapas. Seções ilustrativas. */
  function geometriaDoPortico(g: Geometria3D): THREE.BufferGeometry {
    const de = g.distanciaEntreEixos
    const { pilar: dp, viga: dv, misula: dm, comprimentoDaMisula: lm } = g.secoes
    const bf = dp * 0.45
    const tf = Math.max(0.02, dp * 0.045)
    const tw = Math.max(0.012, dp * 0.03)
    const cos = 1 / Math.sqrt(1 + g.inclinacao ** 2)
    const P = (x: number, z: number) => new THREE.Vector3(x - de / 2, z, 0)
    const partes: THREE.BufferGeometry[] = []
    const eixoZ = new THREE.Vector3(0, 0, 1)
    const barra = (a: THREE.Vector3, b: THREE.Vector3, esp: number, larg: number) => partes.push(caixaEntre(a, b, esp, larg, eixoZ.clone().cross(b.clone().sub(a)).normalize()))
    const alma = (pts: THREE.Vector3[]) => {
      const forma = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, p.y)))
      const ex = new THREE.ExtrudeGeometry(forma, { depth: tw, bevelEnabled: false })
      ex.translate(0, 0, -tw / 2)
      partes.push(ex)
    }
    for (const lado of [1, -1]) {
      const X = (x: number) => (lado === 1 ? x : de - x)
      const xi = dp / 2
      const topo = (x: number) => topoDaViga(g, x)          // o pórtico é simétrico: a cota vale para os dois lados
      const zTopoPilar = topo(dp / 2)                       // o pilar sobe até a face superior da viga, na face interna
      // pilar: duas mesas e a alma
      barra(P(X(-dp / 2), 0), P(X(-dp / 2), topo(-dp / 2)), tf, bf)
      barra(P(X(dp / 2), 0), P(X(dp / 2), g.alturaLivre - (dm - dv) / cos), tf, bf)
      alma([P(X(-dp / 2), 0), P(X(dp / 2), 0), P(X(dp / 2), zTopoPilar), P(X(-dp / 2), topo(-dp / 2))])
      // viga com mísula: mesa superior, duas mesas inferiores e a alma
      const zMis = g.alturaLivre - (dm - dv) / cos
      const meio = de / 2
      barra(P(X(-dp / 2), topo(-dp / 2)), P(X(meio), topo(meio)), tf, bf)
      barra(P(X(xi), zMis), P(X(xi + lm), linhaInferiorDaViga(g, xi + lm)), tf, bf)
      barra(P(X(xi + lm), linhaInferiorDaViga(g, xi + lm)), P(X(meio), linhaInferiorDaViga(g, meio)), tf, bf)
      alma([P(X(xi), zMis), P(X(xi + lm), linhaInferiorDaViga(g, xi + lm)), P(X(meio), linhaInferiorDaViga(g, meio)), P(X(meio), topo(meio)), P(X(xi), topo(xi))])
      // chapa de base
      partes.push(new THREE.BoxGeometry(dp + 0.16, 0.03, bf + 0.16).translate(X(0) - de / 2, 0.015, 0))
    }
    // chapa de topo na cumeeira
    partes.push(new THREE.BoxGeometry(tf, dv / cos + 0.06, bf).translate(0, linhaInferiorDaViga(g, de / 2) + dv / cos / 2, 0))
    const unido = mergeGeometries(partes.map((p) => (p.index ? p.toNonIndexed() : p)), false)!
    partes.forEach((p) => p.dispose())
    return unido
  }

  function unir(lista: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
    if (lista.length === 0) return null
    const u = mergeGeometries(lista.map((p) => (p.index ? p.toNonIndexed() : p)), false)
    lista.forEach((p) => p.dispose())
    return u
  }

  function montar(): void {
    const g = geo
    if (!g) return
    const t0 = performance.now()
    Object.values(grupos).forEach(limpar)
    rotulos.textContent = ''
    etiquetas = []
    const de = g.distanciaEntreEixos
    const L = g.comprimento
    const sec = g.secoes.secundario
    const dp = g.secoes.pilar
    const cos = 1 / Math.sqrt(1 + g.inclinacao ** 2)
    const elementos = elementosDaEstrutura(g)
    const dos = (tipo: Elemento['tipo']) => elementos.filter((e) => e.tipo === tipo)

    // ---- base: solo, sombra e piso
    const raioSolo = Math.max(de, L) * 6
    const solo = new THREE.Mesh(new THREE.CircleGeometry(raioSolo, 48).rotateX(-Math.PI / 2), mat.solo)
    solo.position.y = -0.02
    grupos.base.add(solo)
    const sb = new THREE.Mesh(new THREE.PlaneGeometry(de * 1.9 + 10, L * 1.5 + 10).rotateX(-Math.PI / 2), mat.sombra)
    sb.position.y = -0.01
    grupos.base.add(sb)
    grupos.base.add(new THREE.Mesh(new THREE.BoxGeometry(de + dp + 0.6, 0.06, L + dp + 0.6).translate(0, 0.03, 0), mat.piso))

    // ---- estrutura
    const porticos = dos('portico')
    const malha = new THREE.InstancedMesh(geometriaDoPortico(g), mat.aco, porticos.length)
    porticos.forEach((p, i) => malha.setMatrixAt(i, new THREE.Matrix4().makeTranslation(0, 0, L / 2 - p.a[1])))
    grupos.estrutura.add(malha)
    const inclinada = (e: Elemento) => (e.a[0] < de / 2 ? new THREE.Vector3(-g.inclinacao, 1, 0) : new THREE.Vector3(g.inclinacao, 1, 0)).normalize()
    const tercas = unir(dos('terca').map((e) => caixaEntre(v(e.a), v(e.b), sec, sec * 0.4, e.id === 'TERCA-CUMEEIRA' ? new THREE.Vector3(0, 1, 0) : inclinada(e))))
    if (tercas) grupos.estrutura.add(new THREE.Mesh(tercas, mat.secundario))
    const travessas = unir(dos('travessa').map((e) => caixaEntre(v(e.a), v(e.b), sec * 0.4, sec)))
    if (travessas) grupos.estrutura.add(new THREE.Mesh(travessas, mat.secundario))
    const beirais = unir(dos('longitudinal').map((e) => caixaEntre(v(e.a), v(e.b), sec, sec * 0.6)))
    if (beirais) grupos.estrutura.add(new THREE.Mesh(beirais, mat.aco))
    const oitoes = unir(dos('pilar-de-oitao').map((e) => caixaEntre(v(e.a), v(e.b), dp * 0.5, dp * 0.3, new THREE.Vector3(0, 0, 1))))
    if (oitoes) grupos.estrutura.add(new THREE.Mesh(oitoes, mat.aco))
    const raioX = Math.max(0.025, dp * 0.035)
    const xs = unir(dos('contraventamento').map((e) => {
      const a = v(e.a), b = v(e.b)
      const c = new THREE.CylinderGeometry(raioX, raioX, a.distanceTo(b), 6)
      c.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())).setPosition(a.add(b).multiplyScalar(0.5)))
      return c
    }))
    if (xs) grupos.estrutura.add(new THREE.Mesh(xs, mat.laranja))

    // ---- envoltória: cobertura e fechamentos
    const esp = g.cobertura === 'pir' ? 0.1 : g.cobertura === 'termoacustica' ? 0.06 : 0.03
    const corCob = { 'telha-simples': COR.telhaSimples, termoacustica: COR.termoacustica, pir: COR.pir, indefinido: COR.neutro }[g.cobertura]
    mat.cobertura.color.setHex(corCob)
    mat.cobertura.map = g.cobertura === 'pir' || g.cobertura === 'indefinido' ? null : nervH
    mat.cobertura.needsUpdate = true
    nervH.repeat.set(1, Math.max(1, L / 1.2))
    const xFora = dp / 2 + sec + 0.04                     // face externa das travessas
    const beiral = 0.25
    const zCob = (x: number) => topoDaViga(g, Math.max(0, Math.min(de, x))) + sec + esp / 2 + (x < 0 ? x * g.inclinacao : x > de ? (de - x) * g.inclinacao : 0)
    const frente = dp * 0.225 + sec + 0.04                // face externa do oitão, além do eixo do pórtico extremo
    for (const lado of [1, -1]) {
      const xe = lado === 1 ? -xFora - beiral : de + xFora + beiral
      const a = new THREE.Vector3(xe - de / 2, zCob(xe), 0)
      const b = new THREE.Vector3(0, zCob(de / 2), 0)
      const agua = caixaEntre(a, b, esp, L + 2 * (frente + beiral), new THREE.Vector3(0, 1, 0))
      grupos.envoltoria.add(new THREE.Mesh(agua, mat.cobertura))
    }
    // cumeeira e rufo de beiral em laranja: a assinatura da EIFF na volumetria
    const cume = new THREE.BoxGeometry(0.5, 0.05, L + 2 * (frente + beiral)).translate(0, zCob(de / 2) + esp / 2 + 0.03, 0)
    grupos.envoltoria.add(new THREE.Mesh(cume, mat.laranja))

    if (g.fechado) {
      const corPar = g.fechamento === 'pir' ? COR.pir : g.fechamento === 'alvenaria' ? COR.alvenaria : g.fechamento === 'metalico' ? COR.paredeMetalica : COR.neutro
      for (const m of [mat.parede, mat.oitao]) {
        m.color.setHex(corPar)
        m.transparent = g.fechamentoIndefinido
        m.opacity = g.fechamentoIndefinido ? 0.42 : 1
        m.depthWrite = !g.fechamentoIndefinido
      }
      mat.parede.map = g.fechamento === 'metalico' ? nervV : null
      mat.parede.needsUpdate = true
      nervV.repeat.set(Math.max(1, L / 1.2), 1)
      const tp = g.fechamento === 'alvenaria' ? 0.18 : g.fechamento === 'pir' ? 0.1 : 0.04
      const hPar = zCob(-xFora) - esp / 2 - 0.02
      for (const lado of [1, -1]) {
        const x = (lado === 1 ? -xFora - tp / 2 : de + xFora + tp / 2) - de / 2
        grupos.envoltoria.add(new THREE.Mesh(new THREE.BoxGeometry(tp, hPar, L + 2 * frente).translate(x, hPar / 2, 0), mat.parede))
        // rufo laranja no topo da fachada
        grupos.envoltoria.add(new THREE.Mesh(new THREE.BoxGeometry(tp + 0.06, 0.08, L + 2 * frente).translate(x, hPar - 0.04, 0), mat.laranja))
      }
      const x0 = -xFora - de / 2, x1 = de + xFora - de / 2
      const forma = new THREE.Shape([new THREE.Vector2(x0, 0), new THREE.Vector2(x1, 0), new THREE.Vector2(x1, hPar), new THREE.Vector2(0, zCob(de / 2) - esp / 2 - 0.02), new THREE.Vector2(x0, hPar)])
      for (const z of [L / 2 + frente, -L / 2 - frente - tp]) {
        grupos.envoltoria.add(new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: tp, bevelEnabled: false }).translate(0, 0, z), mat.oitao))
      }
    }

    // ---- figura humana de referência (fora e dentro)
    const figura = (x: number, z: number) => {
      const h = HIPOTESES_3D.figura
      const corpo = new THREE.CylinderGeometry(0.17, 0.2, h - 0.34, 10).translate(x, (h - 0.34) / 2, z)
      const cabeca = new THREE.SphereGeometry(0.15, 12, 8).translate(x, h - 0.15, z)
      grupos.figuras.add(new THREE.Mesh(unir([corpo, cabeca])!, mat.laranja))
    }
    figura(-de * 0.22, L / 2 + frente + 2.2)
    const zDentro = L / 2 - Math.min(L * 0.45, 13)
    figura(g.vaoLivre * 0.22, zDentro)

    // ---- cotas: vão livre, comprimento e pé-direito, com os mesmos números do formulário
    const pts: THREE.Vector3[] = []
    const cota = (a: THREE.Vector3, b: THREE.Vector3, tique: THREE.Vector3, texto: string, modos: Modo[], onde = 0.5) => {
      pts.push(a, b, a.clone().add(tique), a.clone().sub(tique), b.clone().add(tique), b.clone().sub(tique))
      const el = document.createElement('span')
      el.className = 'sim-3d__cota'
      el.textContent = texto
      el.hidden = true
      rotulos.appendChild(el)
      etiquetas.push({ el, ponto: a.clone().lerp(b, onde), modos })
    }
    const zF = L / 2 + frente + 1.2
    const y0 = 0.08
    cota(new THREE.Vector3(-g.vaoLivre / 2, y0, zF), new THREE.Vector3(g.vaoLivre / 2, y0, zF), new THREE.Vector3(0, 0, 0.4), `vão livre ${fmt.format(g.vaoLivre)} m`, ['arquitetura', 'estrutura'])
    const xL = de / 2 + xFora + 1.4
    cota(new THREE.Vector3(xL, y0, L / 2), new THREE.Vector3(xL, y0, -L / 2), new THREE.Vector3(0.4, 0, 0), `comprimento ${fmt.format(L)} m`, ['arquitetura', 'estrutura'])
    cota(new THREE.Vector3(g.vaoLivre / 2 - 0.05, 0.06, zF - 0.6), new THREE.Vector3(g.vaoLivre / 2 - 0.05, g.alturaLivre, zF - 0.6), new THREE.Vector3(0.35, 0, 0), `pé-direito ${fmt.format(g.alturaLivre)} m`, ['arquitetura', 'estrutura'], 0.92)
    const zI = zDentro
    const xI = g.vaoLivre * 0.22 + 0.9
    cota(new THREE.Vector3(xI, 0.06, zI), new THREE.Vector3(xI, g.alturaLivre, zI), new THREE.Vector3(0.3, 0, 0), `pé-direito ${fmt.format(g.alturaLivre)} m`, ['interior'], Math.min(0.7, 2.4 / g.alturaLivre))
    grupos.cotas.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat.cota))

    // ---- câmera: enquadra o volume novo sem perder o ângulo escolhido
    const alturaTotal = zCob(de / 2) + 0.5
    orbita.alvo.set(0, alturaTotal * 0.42, 0)
    const raioDoVolume = 0.5 * Math.hypot(de + 4, L + 4, alturaTotal)
    const aspecto = Math.max(0.5, camera.aspect)
    const ajuste = (raioDoVolume / Math.sin(THREE.MathUtils.degToRad(35 / 2))) * Math.max(1, 1.36 / aspecto) * 0.72
    orbita.raio = encaixe.manual ? THREE.MathUtils.clamp(orbita.raio * (ajuste / (encaixe.ultimo || ajuste)), ajuste * 0.25, ajuste * 3) : ajuste
    encaixe.ultimo = ajuste
    limites.raioMin = ajuste * 0.2
    limites.raioMax = ajuste * 3
    cena.fog = new THREE.Fog(COR.fundo, ajuste * 1.6, ajuste * 6)
    camera.far = ajuste * 8 + raioSolo
    interior.pos.set(0, Math.min(1.7, g.alturaLivre * 0.6), L / 2 - Math.min(L * 0.12, 4))
    limites.avancoMax = Math.max(0, L - 2 * Math.min(L * 0.12, 4))
    interior.avanco = Math.min(interior.avanco, limites.avancoMax)
    ultimaMontagemMs = performance.now() - t0
    aplicarModo()
  }
  const encaixe = { manual: false, ultimo: 0 }

  function aplicarModo(): void {
    grupos.envoltoria.visible = modo !== 'estrutura'
    grupos.cotas.visible = true
    camera.fov = modo === 'interior' ? 68 : 35
    camera.near = modo === 'interior' ? 0.05 : 0.1
    camera.updateProjectionMatrix()
    pedirQuadro()
  }

  function posicionarCamera(): void {
    if (modo === 'interior') {
      const p = interior.pos.clone()
      p.z -= interior.avanco
      camera.position.copy(p)
      const c = Math.cos(interior.pitch)
      camera.lookAt(p.x + Math.sin(interior.yaw) * c, p.y + Math.sin(interior.pitch), p.z - Math.cos(interior.yaw) * c)
      return
    }
    const c = Math.cos(orbita.el)
    camera.position.set(orbita.alvo.x + orbita.raio * c * Math.cos(orbita.az), orbita.alvo.y + orbita.raio * Math.sin(orbita.el), orbita.alvo.z + orbita.raio * c * Math.sin(orbita.az))
    camera.lookAt(orbita.alvo)
  }

  function desenhar(): void {
    quadroPedido = 0
    if (destruida || !geo) return
    posicionarCamera()
    renderizador.render(cena, camera)
    quadros += 1
    const w = tela.clientWidth, h = tela.clientHeight
    for (const e of etiquetas) {
      const p = e.ponto.clone().project(camera)
      const visivel = e.modos.includes(modo) && p.z < 1 && p.z > -1 && Math.abs(p.x) < 0.98 && Math.abs(p.y) < 0.96
      e.el.hidden = !visivel
      if (visivel) e.el.style.transform = `translate(-50%, -50%) translate(${((p.x + 1) / 2 * w).toFixed(1)}px, ${((1 - p.y) / 2 * h).toFixed(1)}px)`
    }
  }
  function pedirQuadro(): void {
    if (!quadroPedido && !destruida) quadroPedido = requestAnimationFrame(desenhar)
  }

  function redimensionar(): void {
    const w = tela.clientWidth, h = tela.clientHeight
    if (w === 0 || h === 0) return
    renderizador.setSize(w, h, false)
    const antes = camera.aspect
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    if (geo && Math.abs(antes - camera.aspect) > 0.05 && !encaixe.manual) montar()
    pedirQuadro()
  }
  const observador = new ResizeObserver(redimensionar)
  observador.observe(tela)

  /** Leva a câmera a um ângulo. Com movimento reduzido, troca de uma vez. */
  function irPara(az: number, el: number, raio: number): void {
    cancelAnimationFrame(animacao)
    if (opcoes.reduzMovimento) {
      Object.assign(orbita, { az, el, raio })
      pedirQuadro()
      return
    }
    const de = { az: orbita.az, el: orbita.el, raio: orbita.raio }
    // pelo caminho mais curto em torno do eixo vertical
    const dAz = ((az - de.az + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
    const t0 = performance.now()
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - t0) / 420)
      const k = 1 - (1 - t) ** 3
      orbita.az = de.az + dAz * k
      orbita.el = de.el + (el - de.el) * k
      orbita.raio = de.raio + (raio - de.raio) * k
      pedirQuadro()
      if (t < 1 && !destruida) animacao = requestAnimationFrame(passo)
    }
    animacao = requestAnimationFrame(passo)
  }

  // ---- interação: arrastar gira, pinça e roda aproximam, teclado também
  const ponteiros = new Map<number, { x: number; y: number }>()
  let pinca = 0
  let emUso = false
  const aoBaixar = (e: PointerEvent) => {
    ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY })
    emUso = true
    try { tela.setPointerCapture(e.pointerId) } catch { /* ponteiro já solto */ }
  }
  const aoMover = (e: PointerEvent) => {
    const p = ponteiros.get(e.pointerId)
    if (!p) return
    const dx = e.clientX - p.x, dy = e.clientY - p.y
    p.x = e.clientX
    p.y = e.clientY
    if (ponteiros.size === 2) {
      const [a, b] = [...ponteiros.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinca > 0 && d > 0) api.zoom(pinca / d)
      pinca = d
      return
    }
    cancelAnimationFrame(animacao)
    api.girar(-dx * 0.0065, dy * 0.0055)
  }
  const aoSoltar = (e: PointerEvent) => {
    ponteiros.delete(e.pointerId)
    pinca = 0
  }
  const aoRodar = (e: WheelEvent) => {
    if (!emUso && !e.ctrlKey) return                     // sem ter tocado na cena, a roda continua rolando a página
    e.preventDefault()
    api.zoom(e.deltaY > 0 ? 1.1 : 0.9)
  }
  const aoSair = () => { emUso = false }
  const aoTeclar = (e: KeyboardEvent) => {
    const passo = 0.12
    const acao: Record<string, () => void> = {
      ArrowLeft: () => api.girar(passo, 0), ArrowRight: () => api.girar(-passo, 0), ArrowUp: () => api.girar(0, passo), ArrowDown: () => api.girar(0, -passo),
      '+': () => api.zoom(0.88), '=': () => api.zoom(0.88), '-': () => api.zoom(1.14), '0': () => api.restaurar(), Home: () => api.restaurar(),
    }
    const f = acao[e.key]
    if (!f) return
    e.preventDefault()
    e.stopPropagation()
    f()
  }
  const aoPerder = (e: Event) => { e.preventDefault(); opcoes.aoPerderContexto() }
  tela.addEventListener('pointerdown', aoBaixar)
  tela.addEventListener('pointermove', aoMover)
  tela.addEventListener('pointerup', aoSoltar)
  tela.addEventListener('pointercancel', aoSoltar)
  tela.addEventListener('pointerleave', aoSair)
  tela.addEventListener('wheel', aoRodar, { passive: false })
  tela.addEventListener('keydown', aoTeclar)
  tela.addEventListener('webglcontextlost', aoPerder)

  const api: Cena3D = {
    atualizar(g) {
      geo = g
      montar()
    },
    definirModo(m) {
      if (m === modo) return
      modo = m
      if (m === 'interior') Object.assign(interior, { yaw: 0, pitch: 0.05, avanco: 0 })
      aplicarModo()
    },
    definirVista(nome) {
      if (modo === 'interior') { Object.assign(interior, { yaw: nome === 'lateral' ? Math.PI / 2 : 0, pitch: nome === 'topo' ? 0.9 : 0.05 }); pedirQuadro(); return }
      irPara(PADRAO[nome].az, PADRAO[nome].el, encaixe.ultimo)
    },
    restaurar() {
      encaixe.manual = false
      if (modo === 'interior') { Object.assign(interior, { yaw: 0, pitch: 0.05, avanco: 0 }); pedirQuadro(); return }
      irPara(PADRAO.perspectiva.az, PADRAO.perspectiva.el, encaixe.ultimo)
    },
    zoom(fator) {
      if (modo === 'interior') interior.avanco = THREE.MathUtils.clamp(interior.avanco + (1 - fator) * 12, 0, limites.avancoMax)
      else { orbita.raio = THREE.MathUtils.clamp(orbita.raio * fator, limites.raioMin, limites.raioMax); encaixe.manual = true }
      pedirQuadro()
    },
    girar(dAz, dEl) {
      if (modo === 'interior') {
        interior.yaw -= dAz
        interior.pitch = THREE.MathUtils.clamp(interior.pitch + dEl, -0.6, 1.2)
      } else {
        orbita.az += dAz
        orbita.el = THREE.MathUtils.clamp(orbita.el + dEl, 0.03, 1.52)
      }
      pedirQuadro()
    },
    estatisticas: () => ({ chamadas: renderizador.info.render.calls, triangulos: renderizador.info.render.triangles, ultimaMontagemMs, quadros }),
    destruir() {
      destruida = true
      cancelAnimationFrame(quadroPedido)
      cancelAnimationFrame(animacao)
      observador.disconnect()
      tela.removeEventListener('pointerdown', aoBaixar)
      tela.removeEventListener('pointermove', aoMover)
      tela.removeEventListener('pointerup', aoSoltar)
      tela.removeEventListener('pointercancel', aoSoltar)
      tela.removeEventListener('pointerleave', aoSair)
      tela.removeEventListener('wheel', aoRodar)
      tela.removeEventListener('keydown', aoTeclar)
      tela.removeEventListener('webglcontextlost', aoPerder)
      Object.values(grupos).forEach(limpar)
      Object.values(mat).forEach((m) => m.dispose())
      nervV.dispose(); nervH.dispose(); sombra.dispose()
      renderizador.dispose()
      rotulos.textContent = ''
    },
  }
  redimensionar()
  return api
}
