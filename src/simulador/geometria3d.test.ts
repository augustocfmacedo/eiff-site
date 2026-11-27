import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { H_MISULA, H_PILAR, H_VIGA, MOLDURA_PADRAO, desenharPortico } from './croqui'
import {
  HIPOTESES_3D, SELO_3D, alturaDeReferencia, elementosDaEstrutura, geometriaDoGalpao, hipotesesDeRepresentacao, linhaInferiorDaViga, topoDaViga,
} from './geometria3d'
import { INCLINACAO_DE_REPRESENTACAO, alturaDeReferencia as referenciaDaConvencao, secoesDeDesenho, subidaDaCumeeira } from './convencao'
import { cumeeiraDoVolume, ilustracaoVolumetrica } from './ilustracao'
import { LIMITES, areaCoberta, type ConfiguracaoGalpao } from './parametros'
import { mesmaGeometria, temWebGL } from './visual3d'

const raiz = resolve(__dirname, '../..')
const ler = (arquivo: string) => readFileSync(resolve(raiz, arquivo), 'utf8')
const cfg = (vao: number, comprimento: number, peDireito: number, extra: Partial<ConfiguracaoGalpao> = {}): ConfiguracaoGalpao => ({ vao, comprimento, peDireito, ...extra })

describe('geometria da visualização 3D', () => {
  it('distingue vão livre, distância entre eixos, altura livre e altura de referência', () => {
    const g = geometriaDoGalpao(cfg(25, 60, 8))!
    expect(g.vaoLivre).toBe(25)                                   // o que o visitante digitou
    expect(g.alturaLivre).toBe(8)
    expect(g.comprimento).toBe(60)
    expect(g.secoes.pilar).toBeCloseTo(Math.min(H_PILAR, 25 * 0.035), 6)
    expect(g.distanciaEntreEixos).toBeCloseTo(25 + g.secoes.pilar, 4)   // eixos = vão livre + seção ilustrativa
    expect(g.distanciaEntreEixos).toBeGreaterThan(g.vaoLivre)
    expect(g.alturaDeReferenciaNaCumeeira).toBeCloseTo(8 + 12.5 * 0.10, 6)
    expect(g.alturaDeReferenciaNaCumeeira).toBeGreaterThan(g.alturaLivre)
  })

  it('as faces internas dos pilares ficam exatamente a um vão livre de distância', () => {
    for (const vao of [6, 13, 25, 40, 60]) {
      const g = geometriaDoGalpao(cfg(vao, 60, 8))!
      const faceA = g.secoes.pilar / 2
      const faceB = g.distanciaEntreEixos - g.secoes.pilar / 2
      expect(faceB - faceA).toBeCloseTo(vao, 3)
    }
  })

  it('a linha inferior da viga está no pé-direito junto ao pilar e na altura de referência na cumeeira', () => {
    const g = geometriaDoGalpao(cfg(32, 90, 12))!
    expect(linhaInferiorDaViga(g, g.secoes.pilar / 2)).toBeCloseTo(12, 6)
    expect(linhaInferiorDaViga(g, g.distanciaEntreEixos - g.secoes.pilar / 2)).toBeCloseTo(12, 6)
    expect(linhaInferiorDaViga(g, g.distanciaEntreEixos / 2)).toBeCloseTo(g.alturaDeReferenciaNaCumeeira, 3)
    expect(topoDaViga(g, g.distanciaEntreEixos / 2)).toBeGreaterThan(g.alturaDeReferenciaNaCumeeira)   // a viga fica ACIMA da referência
  })

  it('o 3D e o croqui em corte dão a mesma «Altura total», em toda a faixa do formulário', () => {
    for (let vao = LIMITES.vao.min; vao <= LIMITES.vao.max; vao += 3) {
      for (let pe = LIMITES.peDireito.min; pe <= LIMITES.peDireito.max; pe += 2.5) {
        const croqui = desenharPortico({ vao, peDireito: pe }, MOLDURA_PADRAO)
        const g = geometriaDoGalpao(cfg(vao, 60, pe))!
        expect(Math.round(g.alturaDeReferenciaNaCumeeira * 10) / 10).toBe(croqui.alturaCumeeira)
        expect(alturaDeReferencia(pe, vao)).toBeCloseTo(g.alturaDeReferenciaNaCumeeira, 6)
      }
    }
  })

  it('usa as mesmas proporções ilustrativas do croqui, sem perfil próprio', () => {
    const g = geometriaDoGalpao(cfg(40, 100, 10))!
    expect(g.secoes.pilar).toBe(H_PILAR)
    expect(g.secoes.viga).toBeCloseTo(H_VIGA, 6)
    expect(g.secoes.misula).toBeCloseTo(H_MISULA, 6)
  })

  it('a área que o painel mostra continua sendo vão × comprimento', () => {
    const c = cfg(25, 60, 8)
    const g = geometriaDoGalpao(c)!
    expect(areaCoberta(c)).toBe(g.vaoLivre * g.comprimento)
  })

  it('a modulação é hipótese: pórticos igualmente espaçados perto de 6 m, cobrindo o comprimento inteiro', () => {
    for (const comprimento of [10, 15, 33, 60, 125, 400]) {
      const g = geometriaDoGalpao(cfg(20, comprimento, 6))!
      expect(g.modulo * (g.numeroDePorticos - 1)).toBeCloseTo(comprimento, 3)
      expect(g.numeroDePorticos).toBeGreaterThanOrEqual(2)
      expect(g.modulo).toBeGreaterThanOrEqual(4)
      expect(g.modulo).toBeLessThanOrEqual(10)
      const porticos = elementosDaEstrutura(g).filter((e) => e.tipo === 'portico')
      expect(porticos).toHaveLength(g.numeroDePorticos)
      expect(porticos[0]!.a[1]).toBe(0)
      expect(porticos.at(-1)!.a[1]).toBeCloseTo(comprimento, 3)
    }
    expect(HIPOTESES_3D.moduloAlvo).toBe(6)
    expect(HIPOTESES_3D.inclinacao).toBe(0.10)
  })

  it('fora dos limites do formulário não há geometria', () => {
    expect(geometriaDoGalpao(cfg(LIMITES.vao.max + 1, 60, 8))).toBeNull()
    expect(geometriaDoGalpao(cfg(25, LIMITES.comprimento.min - 1, 8))).toBeNull()
    expect(geometriaDoGalpao(cfg(25, 60, LIMITES.peDireito.max + 0.5))).toBeNull()
    expect(geometriaDoGalpao({ vao: 25, comprimento: 60 })).toBeNull()
    expect(geometriaDoGalpao(cfg(Number.NaN, 60, 8))).toBeNull()
  })

  it('nos limites extremos a geometria é finita e os elementos têm identificador único', () => {
    for (const c of [cfg(6, 10, 3), cfg(60, 400, 20), cfg(6, 400, 20), cfg(60, 10, 3)]) {
      const g = geometriaDoGalpao({ ...c, fechamento: 'metalico' })!
      const el = elementosDaEstrutura(g)
      const ids = el.map((e) => e.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const e of el) for (const n of [...e.a, ...e.b]) expect(Number.isFinite(n)).toBe(true)
      expect(el.length).toBeLessThan(400)                          // a cena não cresce sem controle
    }
  })

  it('o fechamento escolhido decide o que é desenhado', () => {
    const tipos = (f: ConfiguracaoGalpao['fechamento']) => new Set(elementosDaEstrutura(geometriaDoGalpao(cfg(25, 60, 8, { fechamento: f }))!).map((e) => e.tipo))
    expect(tipos('metalico').has('travessa')).toBe(true)
    expect(tipos('pir').has('pilar-de-oitao')).toBe(true)
    expect(tipos('alvenaria').has('travessa')).toBe(false)         // alvenaria não tem travessa metálica
    expect(tipos('aberto').has('travessa')).toBe(false)
    expect(tipos('aberto').has('pilar-de-oitao')).toBe(false)
    const indefinido = geometriaDoGalpao(cfg(25, 60, 8))!
    expect(indefinido.fechamentoIndefinido).toBe(true)
    expect(geometriaDoGalpao(cfg(25, 60, 8, { fechamento: 'aberto' }))!.fechado).toBe(false)
  })

  it('as terças apoiam sobre a viga e as travessas ficam abaixo do beiral', () => {
    const g = geometriaDoGalpao(cfg(25, 60, 8, { fechamento: 'metalico' }))!
    const el = elementosDaEstrutura(g)
    for (const t of el.filter((e) => e.tipo === 'terca')) expect(t.a[2]).toBeGreaterThan(topoDaViga(g, t.a[0]) - 1e-6)
    for (const t of el.filter((e) => e.tipo === 'travessa')) {
      expect(t.a[2]).toBeGreaterThan(0)
      expect(t.a[2]).toBeLessThan(g.alturaLivre + 0.31)
    }
    expect(el.filter((e) => e.id === 'TERCA-CUMEEIRA')).toHaveLength(1)
  })

  it('as hipóteses dizem o que foi presumido e não afirmam dimensionamento', () => {
    const texto = hipotesesDeRepresentacao(geometriaDoGalpao(cfg(25, 60, 8))!).join(' ')
    expect(texto).toMatch(/faces internas/)
    expect(texto).toMatch(/distância entre eixos/)
    expect(texto).toMatch(/linha inferior da viga/)
    expect(texto).toMatch(/Inclinação da cobertura de 10 %/)
    expect(texto).toMatch(/ilustrativos: não foram dimensionados nem verificados/)
    expect(texto).toMatch(/Fechamento ainda não escolhido/)
    expect(SELO_3D).toBe('VISUALIZAÇÃO CONCEITUAL — NÃO É PROJETO EXECUTIVO.')
  })

  it('só remonta a cena quando a geometria muda', () => {
    const a = geometriaDoGalpao(cfg(25, 60, 8, { cidade: 'Goiânia', uso: 'logistico' }))
    const b = geometriaDoGalpao(cfg(25, 60, 8, { cidade: 'Anápolis', uso: 'industrial', piso: 'pesado' }))
    expect(mesmaGeometria(a, b)).toBe(true)                        // cidade, uso e piso não mudam o desenho
    expect(mesmaGeometria(a, geometriaDoGalpao(cfg(26, 60, 8)))).toBe(false)
    expect(mesmaGeometria(a, geometriaDoGalpao(cfg(25, 60, 8, { cobertura: 'pir' })))).toBe(false)
    expect(mesmaGeometria(null, a)).toBe(false)
  })
})

describe('isolamento da visualização 3D', () => {
  const fonte = (nome: string) => ler(`src/simulador/${nome}`)

  it('sem WebGL o navegador é dado como não suportado, sem lançar erro', () => {
    const semContexto = { createElement: () => ({ getContext: () => null }) } as unknown as Document
    const quebrado = { createElement: () => { throw new Error('sem canvas') } } as unknown as Document
    expect(temWebGL(semContexto)).toBe(false)
    expect(temWebGL(quebrado)).toBe(false)
  })

  it('three.js só entra pela cena, que é importada sob demanda', () => {
    for (const nome of ['tela.ts', 'visual3d.ts', 'geometria3d.ts', 'parametros.ts', 'croqui.ts', 'ilustracao.ts', 'fluxo.ts']) {
      expect(fonte(nome)).not.toMatch(/from 'three/)
    }
    expect(ler('src/simulador.ts')).not.toMatch(/three|cena3d/)
    expect(fonte('cena3d.ts')).toMatch(/from 'three'/)
    expect(fonte('visual3d.ts')).toMatch(/import\('\.\/cena3d'\)/)   // importação dinâmica
    expect(fonte('visual3d.ts')).toMatch(/import type \{[^}]*\} from '\.\/cena3d'/)
  })

  it('a cena e o adaptador não falam com rede, laboratório ou serviço de engenharia', () => {
    for (const nome of ['cena3d.ts', 'visual3d.ts', 'geometria3d.ts']) {
      const s = fonte(nome)
      expect(s).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\//)
      expect(s).not.toMatch(/8765|8766|pynite|eiff_lab|\/api\//i)
    }
  })

  it('nada de engenharia calculada chega à tela pelo 3D', () => {
    // só o que pode ir à tela: os comentários do código explicam justamente o que NÃO é mostrado
    const semComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const s = semComentarios(fonte('cena3d.ts')) + semComentarios(fonte('visual3d.ts'))
    for (const proibido of [/esfor[cç]o/i, /deslocamento/i, /\bkN\b/, /\bkg\b/i, /tonelada/i, /NBR/i, /coeficiente/i, /momento fletor/i, /dimensionad[oa]s? (pela|por)/i]) {
      expect(s).not.toMatch(proibido)
    }
  })
})

describe('a página com a visualização 3D', () => {
  const html = ler('simular-galpao.html')
  const principal = (h: string) => [...h.matchAll(/\sname="([^"]+)"/g)].map((m) => m[1])

  it('traz o selo, os três modos, as vistas de câmera e a chamada comercial', () => {
    expect(html).toContain('VISUALIZAÇÃO CONCEITUAL — NÃO É PROJETO EXECUTIVO.')
    for (const modo of ['arquitetura', 'estrutura', 'interior']) expect(html).toContain(`data-modo="${modo}"`)
    for (const cam of ['perspectiva', 'frente', 'lateral', 'topo', 'mais', 'menos', 'restaurar', 'ampliar']) expect(html).toContain(`data-cam="${cam}"`)
    expect(html).toContain('Seu galpão começou a tomar forma.')
    expect(html).toContain('Transforme sua configuração em um projeto de engenharia.')
    expect(html).toContain('Solicitar meu projeto')
  })

  it('o 3D nasce oculto: sem JavaScript ou sem WebGL a página é a de antes', () => {
    expect(html).toMatch(/<div class="sim-3d" id="sim3d" hidden>/)
    expect(html).toMatch(/data-vista="3d" aria-pressed="false" hidden>/)
    expect(html).toMatch(/<div class="sim-cta3d" id="simCta3d" hidden>/)
    expect(html).toContain('id="simCroqui"')                       // o croqui e as ilustrações continuam lá
    expect(html).toContain('data-vista="volume" aria-pressed="true"')
  })

  it('não acrescenta campo nenhum ao formulário: os botões do 3D não têm nome e não enviam', () => {
    const bloco = html.slice(html.indexOf('id="sim3d"'), html.indexOf('id="simEnquadramento"'))
    expect(bloco).not.toMatch(/\sname="/)
    expect(bloco).not.toMatch(/<input|<select|<textarea/)
    for (const bt of bloco.match(/<button[^>]*>/g) ?? []) expect(bt).toContain('type="button"')
    expect(new Set(principal(html)).size).toBeGreaterThan(10)       // os campos de sempre seguem no HTML
  })

  it('não promete projeto aprovado nem mostra preço', () => {
    const bloco = html.slice(html.indexOf('id="sim3d"'), html.indexOf('id="simEnquadramento"'))
    expect(bloco).not.toMatch(/aprovad|homologad|R\$|or[cç]amento|checkout|comprar|pagamento/i)
  })
})

describe('convenção única: croqui, Volume e 3D desenham o mesmo galpão', () => {
  /*
   * Decisão da Direção de 26/11/2026 (opção A): inclinação ilustrativa de 10 % sobre o meio vão em todas as
   * representações, definida num só lugar (`convencao.ts`). É convenção de desenho; não é inclinação de projeto.
   */
  const numeros = (d: string) => d.match(/-?\d+(\.\d+)?/g)!.map(Number)

  it('a inclinação de representação é 10 % sobre o meio vão, e mora num só lugar', () => {
    expect(INCLINACAO_DE_REPRESENTACAO).toBe(0.10)
    expect(subidaDaCumeeira(25)).toBeCloseTo(1.25, 9)
    expect(HIPOTESES_3D.inclinacao).toBe(INCLINACAO_DE_REPRESENTACAO)
    for (const nome of ['croqui.ts', 'ilustracao.ts', 'geometria3d.ts', 'cena3d.ts', 'tela.ts']) {
      const fonte = ler(`src/simulador/${nome}`)
      expect(fonte, nome).not.toMatch(/CAIMENTO_DO_DESENHO/)
      // nenhuma figura define inclinação por conta própria: todas importam a convenção ou recebem a geometria pronta
      expect(fonte, nome).not.toMatch(/inclinacao\s*[:=]\s*0?\.\d|\?\?\s*10\b|\*\s*0\.07/)
    }
    for (const nome of ['croqui.ts', 'ilustracao.ts', 'geometria3d.ts']) expect(ler(`src/simulador/${nome}`), nome).toMatch(/from '\.\/convencao'/)
  })

  it('as três representações dão a mesma altura de cumeeira, em toda a faixa do formulário', () => {
    for (let vao = LIMITES.vao.min; vao <= LIMITES.vao.max; vao += 2) {
      for (let pe = LIMITES.peDireito.min; pe <= LIMITES.peDireito.max; pe += 1.5) {
        const esperado = pe + (vao / 2) * 0.10                      // a conta, escrita à mão
        const c = desenharPortico({ vao, peDireito: pe }, MOLDURA_PADRAO)
        const ref = c.referencias
        const noCroqui = (ref.base - ref.cumeeira) / ref.escala     // medido no próprio desenho
        const no3d = geometriaDoGalpao(cfg(vao, 60, pe))!.alturaDeReferenciaNaCumeeira
        const noVolume = cumeeiraDoVolume({ vao, peDireito: pe })
        expect(noCroqui).toBeCloseTo(esperado, 6)
        expect(no3d).toBeCloseTo(esperado, 4)
        expect(noVolume).toBeCloseTo(esperado, 9)
        expect(referenciaDaConvencao(pe, vao)).toBeCloseTo(esperado, 9)
        expect(c.alturaCumeeira).toBe(Math.round(esperado * 10) / 10)          // o número do painel não mudou
      }
    }
  })

  it('a «Altura total» do painel continua a mesma de antes da unificação', () => {
    expect(desenharPortico({ vao: 25, peDireito: 8 }, MOLDURA_PADRAO).alturaCumeeira).toBe(9.3)
    expect(desenharPortico({ vao: 40, peDireito: 12 }, MOLDURA_PADRAO).alturaCumeeira).toBe(14)
    expect(desenharPortico({ vao: 32, peDireito: 12 }, MOLDURA_PADRAO).alturaCumeeira).toBe(13.6)
  })

  it('a ilustração Volume desenha a cumeeira na altura de referência (antes subia 7 % do vão inteiro)', () => {
    // Num desenho isométrico, dois pontos na mesma vertical distam (diferença de altura × escala) em tela.
    // O oitão do Volume tem a cumeeira e a base no mesmo x: a razão entre as duas alturas desenhadas é a razão real.
    for (const [vao, pe] of [[25, 8], [60, 3], [6, 20], [40, 12]] as const) {
      const svg = ilustracaoVolumetrica(cfg(vao, 60, pe))!
      const oitao = svg.match(/class="sim-ilu-oitao" points="([^"]+)"/)![1].split(' ').map((p) => p.split(',').map(Number))
      // pontos do oitão: base esquerda, base direita, beiral direito, cumeeira, beiral esquerdo
      const [, baseDir, beiralDir, cume] = oitao
      const alturaDoBeiral = baseDir[1] - beiralDir[1]                 // pé-direito em tela
      const yDaBaseSobACumeeira = (oitao[0][1] + baseDir[1]) / 2       // ponto médio da base, sob a cumeeira
      const alturaDaCumeeira = yDaBaseSobACumeeira - cume[1]
      expect(alturaDaCumeeira / alturaDoBeiral).toBeCloseTo((pe + (vao / 2) * 0.10) / pe, 1)
    }
    expect(cumeeiraDoVolume({ vao: 25, peDireito: 8 })).toBeCloseTo(9.25, 9)      // era 9,75 com a regra antiga
  })

  it('a ilustração Volume segue sem mostrar número de altura', () => {
    const svg = ilustracaoVolumetrica(cfg(25, 60, 8))!
    expect(svg).toContain('pé-direito 8 m')
    expect(svg).not.toMatch(/9,[0-9] m|altura total|cumeeira \d/i)
  })

  it('croqui: os pilares ficam FORA do vão livre, e a cota do vão vai de face interna a face interna', () => {
    for (const [vao, pe] of [[25, 8], [6, 3], [60, 20], [12, 5], [40, 12]] as const) {
      const c = desenharPortico({ vao, peDireito: pe }, MOLDURA_PADRAO)
      const ref = c.referencias
      expect((ref.faceInternaDireita - ref.faceInternaEsquerda) / ref.escala).toBeCloseTo(vao, 6)   // o vão livre, inteiro
      expect(ref.faceExternaEsquerda).toBeLessThan(ref.faceInternaEsquerda)
      expect(ref.faceExternaDireita).toBeGreaterThan(ref.faceInternaDireita)
      const cota = c.cotaVao.caminho
      expect(Number(cota.match(/^M (-?[\d.]+)/)![1])).toBeCloseTo(ref.faceInternaEsquerda, 1)
      expect(Number(cota.match(/H (-?[\d.]+)/)![1])).toBeCloseTo(ref.faceInternaDireita, 1)
      // nenhum traço do pilar entra no vão: todos os x do contorno ficam nas faces ou para fora delas
      const xs = numeros(c.pilares).filter((_, i) => [0, 3, 5, 8].includes(i))
      for (const x of xs) expect(x <= ref.faceInternaEsquerda + 0.06 || x >= ref.faceInternaDireita - 0.06).toBe(true)
    }
  })

  it('croqui: a cota do pé-direito mede exatamente o pé-direito, até a linha inferior da viga', () => {
    for (const [vao, pe] of [[25, 8], [6, 20], [60, 3]] as const) {
      const c = desenharPortico({ vao, peDireito: pe }, MOLDURA_PADRAO)
      const ref = c.referencias
      expect((ref.base - ref.peDireito) / ref.escala).toBeCloseTo(pe, 6)
      const n = numeros(c.cotaPeDireito.caminho)
      expect(n).toContain(Math.round(ref.peDireito * 10) / 10)
      // a viga fica acima da linha de referência; a mísula, abaixo dela, só no joelho
      const yTopoNaCumeeira = numeros(c.cobertura)[3]
      expect(yTopoNaCumeeira).toBeLessThan(ref.cumeeira)
      expect(numeros(c.alma)[1]).toBeGreaterThan(ref.peDireito)
    }
  })

  it('croqui e 3D usam as mesmas seções ilustrativas e a mesma posição dos pilares', () => {
    for (const vao of [6, 12, 25, 40, 60]) {
      const g = geometriaDoGalpao(cfg(vao, 60, 8))!
      const sec = secoesDeDesenho(vao)
      expect(g.secoes.pilar).toBeCloseTo(sec.pilar, 4)
      expect(g.secoes.viga).toBeCloseTo(sec.viga, 4)
      expect(g.secoes.misula).toBeCloseTo(sec.misula, 4)
      expect(g.distanciaEntreEixos).toBeCloseTo(vao + sec.pilar, 4)           // 3D: eixos = vão livre + um pilar
      const ref = desenharPortico({ vao, peDireito: 8 }, MOLDURA_PADRAO).referencias
      const espessuraNoCroqui = (ref.faceInternaEsquerda - ref.faceExternaEsquerda) / ref.escala
      expect(espessuraNoCroqui).toBeGreaterThanOrEqual(sec.pilar - 1e-6)      // igual, salvo o mínimo de 2 px do traço
    }
  })

  it('nada na convenção fala de dimensionamento', () => {
    const fonte = ler('src/simulador/convencao.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(fonte).not.toMatch(/NBR|kN|esfor|flecha|tens[aã]o|resist/i)
    expect(ler('src/simulador/convencao.ts')).toMatch(/Nenhuma foi dimensionada nem verificada/)
  })
})

describe('modo ampliado e rótulos', () => {
  const visual = ler('src/simulador/visual3d.ts')
  const cena = ler('src/simulador/cena3d.ts')
  const css = ler('src/styles/simulador.css')
  const pagina = ler('simular-galpao.html')

  it('amplia dentro de um diálogo modal: camada superior do navegador, Esc nativo', () => {
    expect(visual).toMatch(/createElement\('dialog'\)/)
    expect(visual).toMatch(/showModal\(\)/)
    expect(visual).toMatch(/addEventListener\('close'/)
    expect(css).toMatch(/\.sim-3d-dialogo \{[^}]*inset: 0/)
    expect(css).toMatch(/\.sim-3d-dialogo \{[^}]*100dvh/)
  })

  it('o selo fica dentro do palco, que é o que vai para o diálogo: aparece nos três modos e ampliado', () => {
    const palco = pagina.slice(pagina.indexOf('class="sim-3d__palco"'), pagina.indexOf('class="sim-3d__camera"'))
    expect(palco).toContain('id="sim3dSelo"')
    expect(palco).toContain('VISUALIZAÇÃO CONCEITUAL — NÃO É PROJETO EXECUTIVO.')
    expect(cena).not.toMatch(/sim3dSelo|__selo'\)\.hidden|selo\.hidden/)   // nenhum modo esconde o selo
    expect(css).not.toMatch(/sim-3d__selo[^{]*\{[^}]*display:\s*none/)
  })

  it('os rótulos são posicionados com medida, limite de área e teste de sobreposição', () => {
    expect(cena).toMatch(/function posicionarRotulos/)
    expect(cena).toMatch(/ocupadas\.some/)
    expect(cena).toMatch(/offsetWidth/)
    expect(css).toMatch(/\.sim-3d__cota\[data-visivel="0"\] \{ visibility: hidden; \}/)
  })

  it('a chamada comercial não pode estourar o cartão', () => {
    expect(css).toMatch(/\.sim-cta3d \{[^}]*grid-template-columns: minmax\(0, 1fr\)/)
    expect(css).toMatch(/\.sim-cta3d \.btn \{[^}]*max-width: 100%/)
    expect(css).toMatch(/\.sim-cta3d \.btn \{[^}]*white-space: normal/)
  })
})
