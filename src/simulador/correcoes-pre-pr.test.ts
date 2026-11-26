/**
 * Testes dos defeitos apontados na revisão independente da SITE-3D-01 (D1, R10, R11, R3).
 * Cada um exercita a função e confere o que ela DEVOLVE ou FAZ; nenhum confere texto de código-fonte.
 */
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { limparGrupo } from './cena3d'
import { alturaTotalExibida } from './convencao'
import { MOLDURA_PADRAO, desenharPortico } from './croqui'
import { ETAPAS, avancar, estadoInicial, passoDaChamada, type EstadoSimulador, type IdEtapa } from './fluxo'
import { alturaTotalEmTexto, geometriaDoGalpao, hipotesesDeRepresentacao } from './geometria3d'
import { LIMITES, formatarMedida, type ConfiguracaoGalpao } from './parametros'

/* ------------------------------------------------------------------ D1 */
describe('D1 — a «Altura total» é a mesma no painel e no texto das hipóteses', () => {
  /** O que o painel escreve em `#simCumeeira`: é exatamente esta expressão em `tela.ts`. */
  const noPainel = (vao: number, pe: number) => formatarMedida(desenharPortico({ vao, peDireito: pe }, MOLDURA_PADRAO).alturaCumeeira)

  it('na configuração padrão os dois mostram 9,3 m (antes o texto dizia 9,25 m)', () => {
    const g = geometriaDoGalpao({ vao: 25, comprimento: 60, peDireito: 8 })!
    expect(noPainel(25, 8)).toBe('9,3')
    expect(alturaTotalEmTexto(g)).toBe('9,3')
    const frase = hipotesesDeRepresentacao(g).find((h) => h.includes('Altura total'))!
    expect(frase).toContain('(9,3 m)')
    expect(frase).not.toContain('9,25')
  })

  it('coincidem em TODA a faixa do formulário, inclusive nos vãos ímpares, onde divergiam', () => {
    let conferidos = 0
    for (let vao = LIMITES.vao.min; vao <= LIMITES.vao.max; vao += LIMITES.vao.passo) {
      for (let pe = LIMITES.peDireito.min; pe <= LIMITES.peDireito.max; pe += LIMITES.peDireito.passo) {
        const g = geometriaDoGalpao({ vao, comprimento: 60, peDireito: pe })!
        const frase = hipotesesDeRepresentacao(g).find((h) => h.includes('Altura total'))!
        expect(alturaTotalEmTexto(g), `vão ${vao}, pé-direito ${pe}`).toBe(noPainel(vao, pe))
        expect(frase, `vão ${vao}, pé-direito ${pe}`).toContain(`(${noPainel(vao, pe)} m)`)
        conferidos += 1
      }
    }
    expect(conferidos).toBe(55 * 35)                             // 1.925 combinações
  })

  it('a correção é de texto: a geometria desenhada não mudou', () => {
    const g = geometriaDoGalpao({ vao: 25, comprimento: 60, peDireito: 8 })!
    expect(g.alturaDeReferenciaNaCumeeira).toBe(9.25)             // a cena continua em 9,25 m
    expect(alturaTotalExibida(8, 25)).toBe(9.3)                   // só o número MOSTRADO é arredondado, num lugar só
    const ref = desenharPortico({ vao: 25, peDireito: 8 }, MOLDURA_PADRAO).referencias
    expect((ref.base - ref.cumeeira) / ref.escala).toBeCloseTo(9.25, 6)
  })
})

/* ------------------------------------------------------------------ R10 */
describe('R10 — nenhuma quantidade na interface comercial', () => {
  it('as hipóteses não dizem quantos pórticos, peças ou quilos há, em nenhuma configuração', () => {
    for (const c of [{ vao: 25, comprimento: 60, peDireito: 8 }, { vao: 6, comprimento: 10, peDireito: 3 }, { vao: 60, comprimento: 400, peDireito: 20 }] as ConfiguracaoGalpao[]) {
      for (const fechamento of ['metalico', 'pir', 'alvenaria', 'aberto', undefined] as const) {
        const g = geometriaDoGalpao({ ...c, fechamento })!
        const texto = hipotesesDeRepresentacao(g).join(' ')
        expect(texto).not.toMatch(/\d+\s*(pórticos?|terças?|travessas?|peças?|pilares|vigas|kg|toneladas?|t\b)/i)
        expect(texto).not.toContain(String(g.numeroDePorticos) + ' pórtico')
      }
    }
  })

  it('a cena continua tendo o número de pórticos de que precisa para se desenhar', () => {
    expect(geometriaDoGalpao({ vao: 25, comprimento: 60, peDireito: 8 })!.numeroDePorticos).toBe(11)
  })
})

/* ------------------------------------------------------------------ R11 */
describe('R11 — «Solicitar meu projeto» passa pela Especificação e não inventa nada', () => {
  const comDimensoes = (): EstadoSimulador => ({ ...estadoInicial({ uso: 'logistico', vao: 25, comprimento: 60, peDireito: 8 }), etapa: 'dimensoes' })

  /** Clica na chamada até ela não ter mais o que fazer, preenchendo só o que ela pedir. Devolve por onde passou. */
  function percorrer(inicio: EstadoSimulador, respostas: Partial<Record<string, Partial<ConfiguracaoGalpao>>> = {}) {
    let estado = inicio
    const chegadas: IdEtapa[] = []
    const pedidos: string[] = []
    for (let i = 0; i < 20; i += 1) {
      const passo = passoDaChamada(estado)
      if (passo.acao === 'NENHUMA') break
      if (passo.acao === 'PREENCHER') {
        pedidos.push(`${passo.etapa}:${passo.campo}`)
        const resposta = respostas[passo.campo]
        if (!resposta) break
        estado = { ...estado, configuracao: { ...estado.configuracao, ...resposta } }
        continue
      }
      const antes = estado.etapa
      estado = avancar(estado)                                   // é o que `irAdiante` faz na tela
      expect(estado.etapa).toBe(passo.para)
      expect(ETAPAS.find((e) => e.id === estado.etapa)!.indice).toBe(ETAPAS.find((e) => e.id === antes)!.indice + 1)   // sempre UMA etapa
      chegadas.push(estado.etapa)
    }
    return { estado, chegadas, pedidos }
  }

  it('da etapa Dimensões a chamada leva à Especificação, não ao Contexto nem ao Contato', () => {
    const passo = passoDaChamada(comDimensoes())
    expect(passo).toEqual({ acao: 'AVANCAR', de: 'dimensoes', para: 'especificacao' })
  })

  it('o caminho inteiro passa por todas as etapas, uma vez cada, na ordem', () => {
    const { chegadas, pedidos, estado } = percorrer(comDimensoes(), { cidade: { cidade: 'Goiânia, GO' } })
    expect(chegadas).toEqual(['especificacao', 'contexto', 'contato'])
    expect(pedidos).toEqual(['contexto:cidade'])
    expect(estado.etapa).toBe('contato')
    expect(estado.concluidas).toEqual(['dimensoes', 'especificacao', 'contexto'])
  })

  it('cobertura, fechamento e piso seguem opcionais e ninguém os preenche pelo visitante', () => {
    const { estado } = percorrer(comDimensoes(), { cidade: { cidade: 'Goiânia, GO' } })
    expect(estado.configuracao).toEqual({ uso: 'logistico', vao: 25, comprimento: 60, peDireito: 8, cidade: 'Goiânia, GO' })
    expect('cobertura' in estado.configuracao || 'fechamento' in estado.configuracao || 'piso' in estado.configuracao).toBe(false)
  })

  it('o que o visitante escolheu na Especificação é mantido', () => {
    const inicio = { ...comDimensoes(), configuracao: { ...comDimensoes().configuracao, cobertura: 'pir', fechamento: 'metalico', piso: 'pesado' } } as EstadoSimulador
    const { estado } = percorrer(inicio, { cidade: { cidade: 'Goiânia, GO' } })
    expect(estado.configuracao).toMatchObject({ cobertura: 'pir', fechamento: 'metalico', piso: 'pesado' })
  })

  it('com campo obrigatório vazio a chamada pede o campo e não avança nem acusa erro', () => {
    const semUso = estadoInicial({ vao: 25, comprimento: 60, peDireito: 8 })
    expect(passoDaChamada(semUso)).toEqual({ acao: 'PREENCHER', etapa: 'uso', campo: 'uso' })
    const semCidade = percorrer(comDimensoes())
    expect(semCidade.estado.etapa).toBe('contexto')
    expect(semCidade.estado.erros).toEqual([])
    expect(semCidade.chegadas).toEqual(['especificacao', 'contexto'])
  })

  it('dimensão inválida segura a chamada na etapa Dimensões', () => {
    const invalido = { ...comDimensoes(), configuracao: { uso: 'logistico', vao: 200, comprimento: 60, peDireito: 8 } } as EstadoSimulador
    expect(passoDaChamada(invalido)).toEqual({ acao: 'PREENCHER', etapa: 'dimensoes', campo: 'vao' })
  })

  it('no Contato e depois do envio a chamada não faz nada', () => {
    expect(passoDaChamada({ ...comDimensoes(), etapa: 'contato' })).toEqual({ acao: 'NENHUMA', etapa: 'contato' })
    expect(passoDaChamada({ ...comDimensoes(), enviado: true }).acao).toBe('NENHUMA')
  })
})

/* ------------------------------------------------------------------ R3 */
describe('R3 — descarte dos objetos WebGL', () => {
  it('esvazia o grupo e descarta a geometria de cada objeto e o próprio InstancedMesh', () => {
    const grupo = new THREE.Group()
    const material = new THREE.MeshBasicMaterial()
    const descartados: string[] = []
    const vigiar = (alvo: THREE.EventDispatcher<{ dispose: object }>, nome: string) => alvo.addEventListener('dispose', () => descartados.push(nome))

    const gInst = new THREE.BoxGeometry(1, 1, 1)
    const instancias = new THREE.InstancedMesh(gInst, material, 11)
    const gMalha = new THREE.BoxGeometry(2, 2, 2)
    const malha = new THREE.Mesh(gMalha, material)
    const gLinhas = new THREE.BufferGeometry()
    const linhas = new THREE.LineSegments(gLinhas, new THREE.LineBasicMaterial())
    vigiar(gInst, 'geometria das instâncias')
    vigiar(instancias as unknown as THREE.EventDispatcher<{ dispose: object }>, 'InstancedMesh')
    vigiar(gMalha, 'geometria da malha')
    vigiar(gLinhas, 'geometria das linhas')
    let materialDescartado = false
    material.addEventListener('dispose', () => { materialDescartado = true })
    grupo.add(instancias, malha, linhas)

    limparGrupo(grupo)

    expect(grupo.children).toHaveLength(0)
    expect(descartados.sort()).toEqual(['InstancedMesh', 'geometria da malha', 'geometria das instâncias', 'geometria das linhas'])
    expect(materialDescartado).toBe(false)                      // materiais são compartilhados: só saem em `destruir`
  })

  it('grupo vazio e objeto sem geometria não quebram', () => {
    const grupo = new THREE.Group()
    grupo.add(new THREE.Group())
    expect(() => { limparGrupo(grupo); limparGrupo(grupo) }).not.toThrow()
    expect(grupo.children).toHaveLength(0)
  })
})
