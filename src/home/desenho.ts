/**
 * Vocabulário 3D da EIFF: um galpão de 40 m de vão e 12 m de pé-direito desenhado em linhas,
 * um terreno procedural com curvas de nível e o material de linha com ordem de desenho.
 * Usado pelo hero e pela cena do Processo. Sem ficção científica: linguagem de desenho técnico.
 */
import * as THREE from 'three'

export const VAO = 40, PE = 12, BAIAS = 8, PASSO = 6, INCL = Math.tan((10 * Math.PI) / 180)
export const CUME = PE + (VAO / 2) * INCL
export const COMP = BAIAS * PASSO
export const Z0 = -COMP / 2
export const FRAME_CENTRAL = Math.floor(BAIAS / 2)

export const COR_LINHA = new THREE.Color('#f2f0ec')
export const COR_ACENTO = new THREE.Color('#e2582d')

export interface Segmento { a: THREE.Vector3; b: THREE.Vector3; t: number; acento: number }
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/* ---------------------------------------------------------------
   Terreno procedural (ruído de valor determinístico, platô sob a edificação)
--------------------------------------------------------------- */
function hash(ix: number, iz: number) {
  let n = (ix * 374761393 + iz * 668265263) | 0
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}
function ruido(x: number, z: number, celula: number) {
  const gx = x / celula, gz = z / celula
  const ix = Math.floor(gx), iz = Math.floor(gz)
  const fx = gx - ix, fz = gz - iz
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz)
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1)
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz
}
/** Altura do terreno em metros. Zero no platô da edificação, ondulado ao redor. */
export function altura(x: number, z: number) {
  const dx = Math.max(0, Math.abs(x) - (VAO / 2 + 10)), dz = Math.max(0, Math.abs(z) - (COMP / 2 + 10))
  const d = Math.hypot(dx, dz)
  const m = Math.min(1, d / 26)
  const mascara = m * m * (3 - 2 * m)
  const n = (ruido(x + 40, z - 20, 34) - 0.5) * 6 + (ruido(x, z, 11) - 0.5) * 1.6
  return n * mascara
}

export function criarTerreno(tamanho = 280, passo = 2.5) {
  const n = Math.floor(tamanho / passo) + 1
  const pos = new Float32Array(n * n * 3)
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -tamanho / 2 + i * passo, z = -tamanho / 2 + j * passo
    pos.set([x, altura(x, z) - 0.05, z], (j * n + i) * 3)
  }
  const idx: number[] = []
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1
    idx.push(a, c, b, b, c, d)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setIndex(idx)
  const mat = new THREE.ShaderMaterial({
    transparent: true, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2,
    uniforms: { uCam: { value: new THREE.Vector3() }, uFade: { value: new THREE.Vector2(90, 150) }, uOpacidade: { value: 1 } },
    vertexShader: /* glsl */ `
      varying float vH; varying float vDist; uniform vec3 uCam;
      void main() { vH = position.y; vec4 wp = modelMatrix * vec4(position, 1.0); vDist = distance(wp.xyz, uCam); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying float vH; varying float vDist; uniform vec2 uFade; uniform float uOpacidade;
      void main() {
        float h = vH * 2.0;
        float f = fract(h); float dist = min(f, 1.0 - f);
        float w = fwidth(h) * 1.6;
        float linha = 1.0 - smoothstep(0.0, w, dist);
        float grossa = step(0.5, 1.0 - abs(fract(h * 0.25) * 2.0 - 1.0)) ; // a cada 2 m, um pouco mais forte
        vec3 base = vec3(0.062, 0.063, 0.068);
        vec3 cor = mix(base, vec3(0.62, 0.61, 0.59), linha * (0.22 + 0.16 * grossa));
        float fade = 1.0 - smoothstep(uFade.x, uFade.y, vDist);
        gl_FragColor = vec4(cor, fade * uOpacidade);
      }`,
  })
  return new THREE.Mesh(geo, mat)
}

/* ---------------------------------------------------------------
   Segmentos da estrutura, com ordem de desenho (t em 0..1)
--------------------------------------------------------------- */
export interface Partes { grade: Segmento[]; limite: Segmento[]; eixos: Segmento[]; fundacoes: Segmento[]; interfaces: Segmento[]; frames: Segmento[][]; tercas: Segmento[]; contraventos: Segmento[]; cotas: Segmento[] }

export function gerarPartes(): Partes {
  const P: Partes = { grade: [], limite: [], eixos: [], fundacoes: [], interfaces: [], frames: [], tercas: [], contraventos: [], cotas: [] }
  const seg = (lista: Segmento[], a: THREE.Vector3, b: THREE.Vector3, t: number, acento = 0) => lista.push({ a, b, t, acento })

  // Grade do terreno (malha 4 m em 100 x 100 m) acompanhando o relevo
  const G = 52, M = 4, sub = 4
  let k = 0
  const total = (G / M) * 4 + 4
  for (let x = -G; x <= G; x += M) for (let z = -G; z < G; z += sub) seg(P.grade, v(x, altura(x, z), z), v(x, altura(x, z + sub), z + sub), (k / total), 0)
  k += (G / M) * 2 + 1
  for (let z = -G; z <= G; z += M) for (let x = -G; x < G; x += sub) seg(P.grade, v(x, altura(x, z), z), v(x + sub, altura(x + sub, z), z), (k / total), 0)

  // Limite do terreno (laranja)
  const L = { x: VAO / 2 + 16, z: COMP / 2 + 22 }
  const cantos = [v(-L.x, 0, -L.z), v(L.x, 0, -L.z), v(L.x, 0, L.z), v(-L.x, 0, L.z)]
  cantos.forEach((c, i) => {
    const d = cantos[(i + 1) % 4]
    const n = 12
    for (let s = 0; s < n; s++) {
      const a = c.clone().lerp(d, s / n), b = c.clone().lerp(d, (s + 1) / n)
      a.y = altura(a.x, a.z) + 0.2; b.y = altura(b.x, b.z) + 0.2
      seg(P.limite, a, b, (i + s / n) / 4, 1)
    }
  })

  // Eixos A–F / 1–9 sobre o platô
  for (let i = 0; i <= BAIAS; i++) { const z = Z0 + i * PASSO; seg(P.eixos, v(-VAO / 2 - 6, 0, z), v(VAO / 2 + 6, 0, z), i / (BAIAS + 2)) }
  for (const x of [-VAO / 2, 0, VAO / 2]) seg(P.eixos, v(x, 0, Z0 - 6), v(x, 0, -Z0 + 6), 0.85)

  // Fundações e interfaces (piso, instalações)
  for (let i = 0; i <= BAIAS; i++) {
    const z = Z0 + i * PASSO, t = i / BAIAS
    for (const x of [-VAO / 2, VAO / 2]) {
      const s = 1.3
      seg(P.fundacoes, v(x - s, 0, z - s), v(x + s, 0, z - s), t); seg(P.fundacoes, v(x + s, 0, z - s), v(x + s, 0, z + s), t)
      seg(P.fundacoes, v(x + s, 0, z + s), v(x - s, 0, z + s), t); seg(P.fundacoes, v(x - s, 0, z + s), v(x - s, 0, z - s), t)
      seg(P.fundacoes, v(x - s, 0, z - s), v(x - s, -2.4, z - s), t); seg(P.fundacoes, v(x + s, 0, z + s), v(x + s, -2.4, z + s), t)
    }
  }
  seg(P.interfaces, v(-VAO / 2 + 2, 0.15, Z0 + 2), v(VAO / 2 - 2, 0.15, Z0 + 2), 0.2, 1)
  seg(P.interfaces, v(VAO / 2 - 2, 0.15, Z0 + 2), v(VAO / 2 - 2, 0.15, -Z0 - 2), 0.4, 1)
  seg(P.interfaces, v(VAO / 2 - 2, 0.15, -Z0 - 2), v(-VAO / 2 + 2, 0.15, -Z0 - 2), 0.6, 1)
  seg(P.interfaces, v(-VAO / 2 + 2, 0.15, -Z0 - 2), v(-VAO / 2 + 2, 0.15, Z0 + 2), 0.8, 1)
  seg(P.interfaces, v(-VAO / 2 + 1, PE - 1, Z0), v(-VAO / 2 + 1, PE - 1, -Z0), 0.9, 1)
  seg(P.interfaces, v(VAO / 2 - 1, PE - 1, Z0), v(VAO / 2 - 1, PE - 1, -Z0), 0.95, 1)

  // Pórticos: pilares, vigas (tesoura com banzo inferior e montantes)
  for (let i = 0; i <= BAIAS; i++) {
    const z = Z0 + i * PASSO, F: Segmento[] = []
    const ac = i === FRAME_CENTRAL ? 1 : 0
    seg(F, v(-VAO / 2, 0, z), v(-VAO / 2, PE, z), 0.05, ac); seg(F, v(VAO / 2, 0, z), v(VAO / 2, PE, z), 0.05, ac)
    seg(F, v(-VAO / 2, PE, z), v(0, CUME, z), 0.4, ac); seg(F, v(0, CUME, z), v(VAO / 2, PE, z), 0.4, ac)
    seg(F, v(-VAO / 2, PE - 1.6, z), v(0, CUME - 1.8, z), 0.55, ac); seg(F, v(0, CUME - 1.8, z), v(VAO / 2, PE - 1.6, z), 0.55, ac)
    seg(F, v(-VAO / 2, PE - 1.6, z), v(-VAO / 2, PE, z), 0.6, ac); seg(F, v(VAO / 2, PE - 1.6, z), v(VAO / 2, PE, z), 0.6, ac)
    for (let m = 1; m < 5; m++) {
      const x = (-VAO / 2) + (VAO / 2) * (m / 5)
      const ys = PE + (VAO / 2 - Math.abs(x)) * INCL
      seg(F, v(x, ys - 1.7, z), v(x, ys, z), 0.7 + 0.05 * m, ac); seg(F, v(-x, ys - 1.7, z), v(-x, ys, z), 0.7 + 0.05 * m, ac)
      const x2 = (-VAO / 2) + (VAO / 2) * ((m + 0.5) / 5), y2 = PE + (VAO / 2 - Math.abs(x2)) * INCL
      seg(F, v(x, ys - 1.7, z), v(x2, y2, z), 0.75 + 0.05 * m, ac); seg(F, v(-x, ys - 1.7, z), v(-x2, y2, z), 0.75 + 0.05 * m, ac)
    }
    P.frames.push(F)
  }

  // Terças, vigas de beiral e longarinas
  const nT = 6
  for (let j = 0; j <= nT; j++) {
    const x = (-VAO / 2) + (VAO / 2) * (j / nT), y = PE + (VAO / 2 - Math.abs(x)) * INCL, t = j / (nT + 3)
    seg(P.tercas, v(x, y, Z0), v(x, y, -Z0), t)
    if (j !== nT) seg(P.tercas, v(-x, y, Z0), v(-x, y, -Z0), t)
  }
  for (let j = 1; j < 3; j++) { const y = (PE / 3) * j; seg(P.tercas, v(-VAO / 2, y, Z0), v(-VAO / 2, y, -Z0), 0.8 + 0.06 * j); seg(P.tercas, v(VAO / 2, y, Z0), v(VAO / 2, y, -Z0), 0.8 + 0.06 * j) }

  // Contraventamento nas baias extremas
  for (const i of [0, BAIAS - 1]) {
    const za = Z0 + i * PASSO, zb = za + PASSO, t = i === 0 ? 0.1 : 0.6
    for (const x of [-VAO / 2, VAO / 2]) { seg(P.contraventos, v(x, 0, za), v(x, PE, zb), t); seg(P.contraventos, v(x, PE, za), v(x, 0, zb), t) }
    for (let j = 0; j < nT; j++) {
      const xa = (-VAO / 2) + (VAO / 2) * (j / nT), xb = (-VAO / 2) + (VAO / 2) * ((j + 1) / nT)
      const ya = PE + (VAO / 2 - Math.abs(xa)) * INCL, yb = PE + (VAO / 2 - Math.abs(xb)) * INCL
      seg(P.contraventos, v(xa, ya, za), v(xb, yb, zb), t + 0.2); seg(P.contraventos, v(xb, yb, za), v(xa, ya, zb), t + 0.2)
      seg(P.contraventos, v(-xa, ya, za), v(-xb, yb, zb), t + 0.2); seg(P.contraventos, v(-xb, yb, za), v(-xa, ya, zb), t + 0.2)
    }
  }

  // Cotas (laranja)
  const zc = -Z0 + 5
  seg(P.cotas, v(-VAO / 2, 0.4, zc), v(VAO / 2, 0.4, zc), 0.2, 1)
  seg(P.cotas, v(-VAO / 2, 0, zc), v(-VAO / 2, 1.2, zc), 0.2, 1); seg(P.cotas, v(VAO / 2, 0, zc), v(VAO / 2, 1.2, zc), 0.2, 1)
  const xc = VAO / 2 + 5
  seg(P.cotas, v(xc, 0, Z0), v(xc, PE, Z0), 0.6, 1)
  seg(P.cotas, v(xc - 0.8, 0, Z0), v(xc + 0.8, 0, Z0), 0.6, 1); seg(P.cotas, v(xc - 0.8, PE, Z0), v(xc + 0.8, PE, Z0), 0.6, 1)
  seg(P.cotas, v(-VAO / 2 - 4, 0.4, Z0), v(-VAO / 2 - 4, 0.4, -Z0), 0.9, 1)
  seg(P.cotas, v(-VAO / 2 - 4.8, 0.4, Z0), v(-VAO / 2 - 3.2, 0.4, Z0), 0.9, 1); seg(P.cotas, v(-VAO / 2 - 4.8, 0.4, -Z0), v(-VAO / 2 - 3.2, 0.4, -Z0), 0.9, 1)

  return P
}

/* ---------------------------------------------------------------
   Linhas com ordem de desenho, frente de desenho clara e fade por distância
--------------------------------------------------------------- */
export interface Linhas extends THREE.LineSegments { material: THREE.ShaderMaterial }

export function criarLinhas(segs: Segmento[], opacidade: number, cor = COR_LINHA, acento = COR_ACENTO): Linhas {
  const n = segs.length
  const pos = new Float32Array(n * 6), t = new Float32Array(n * 2), ac = new Float32Array(n * 2)
  segs.forEach((s, i) => {
    pos.set([s.a.x, s.a.y, s.a.z, s.b.x, s.b.y, s.b.z], i * 6)
    t[i * 2] = s.t; t[i * 2 + 1] = s.t; ac[i * 2] = s.acento; ac[i * 2 + 1] = s.acento
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aT', new THREE.BufferAttribute(t, 1))
  geo.setAttribute('aAcento', new THREE.BufferAttribute(ac, 1))
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uProgresso: { value: 0 }, uOpacidade: { value: opacidade }, uCor: { value: cor }, uAcento: { value: acento },
      uCam: { value: new THREE.Vector3() }, uFade: { value: new THREE.Vector2(80, 170) },
    },
    vertexShader: /* glsl */ `
      attribute float aT; attribute float aAcento;
      varying float vT; varying float vAc; varying float vDist; uniform vec3 uCam;
      void main() { vT = aT; vAc = aAcento; vec4 wp = modelMatrix * vec4(position, 1.0); vDist = distance(wp.xyz, uCam); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying float vT; varying float vAc; varying float vDist;
      uniform float uProgresso, uOpacidade; uniform vec3 uCor, uAcento; uniform vec2 uFade;
      void main() {
        if (vT > uProgresso) discard;
        float borda = 1.0 - smoothstep(0.0, 0.07, uProgresso - vT);
        float fade = 1.0 - smoothstep(uFade.x, uFade.y, vDist);
        vec3 cor = mix(uCor, uAcento, vAc);
        float a = uOpacidade * fade * (0.8 + 0.2 * borda) + borda * 0.3 * fade;
        if (vAc > 0.5) a = min(1.0, a * 1.3);
        gl_FragColor = vec4(cor + borda * 0.2, a);
      }`,
  })
  return new THREE.LineSegments(geo, mat) as Linhas
}

export const setP = (l: Linhas, p: number) => { l.material.uniforms.uProgresso.value = p }
export const setO = (l: Linhas, o: number) => { l.material.uniforms.uOpacidade.value = o; l.visible = o > 0.002 }
export const setCam = (obj: THREE.Object3D, cam: THREE.Vector3) => {
  obj.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined; if (m?.uniforms?.uCam) m.uniforms.uCam.value.copy(cam) })
}

/* ---------------------------------------------------------------
   Painéis de fechamento e cobertura (faces translúcidas)
--------------------------------------------------------------- */
export function criarPaineis() {
  const q = (a: number[], b: number[], c: number[], d: number[]) => [...a, ...b, ...c, ...a, ...c, ...d]
  const z0 = Z0, z1 = -Z0, W = VAO / 2
  const tri: number[] = [
    ...q([-W, PE, z0], [0, CUME, z0], [0, CUME, z1], [-W, PE, z1]),
    ...q([0, CUME, z0], [W, PE, z0], [W, PE, z1], [0, CUME, z1]),
    ...q([-W, 0, z0], [-W, PE, z0], [-W, PE, z1], [-W, 0, z1]),
    ...q([W, 0, z0], [W, PE, z0], [W, PE, z1], [W, 0, z1]),
  ]
  for (const z of [z0, z1]) {
    tri.push(-W, 0, z, -W, PE, z, 0, CUME, z, -W, 0, z, 0, CUME, z, W, PE, z, -W, 0, z, W, PE, z, W, 0, z)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tri), 3))
  const mat = new THREE.MeshBasicMaterial({ color: 0x24262b, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
  return new THREE.Mesh(geo, mat)
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const suave = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x) }
export const janela = (t: number, a: number, b: number) => suave((t - a) / (b - a))
