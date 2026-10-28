import { describe, expect, it } from 'vitest'
import {
  ETAPAS, TOTAL_ETAPAS, type EstadoSimulador,
  avancar, definirConfiguracao, definirContato, erroDoCampo, estadoInicial,
  irPara, podeEnviar, progresso, validarEtapa, voltar,
} from './fluxo'

const completo = (): EstadoSimulador => ({
  ...estadoInicial({ uso: 'industrial', vao: 25, comprimento: 60, peDireito: 8, cidade: 'Goiânia, GO' }),
  contato: { nome: 'Ana Souza', email: 'ana@exemplo.com.br' },
})

/** Percorre o funil do início ao fim, como o visitante faria. */
const percorrer = (inicial = completo()): EstadoSimulador => {
  let e = inicial
  for (let i = 0; i < TOTAL_ETAPAS; i++) e = avancar(e)
  return e
}

describe('etapas', () => {
  it('são cinco, com índice coerente com a ordem', () => {
    expect(ETAPAS).toHaveLength(5)
    ETAPAS.forEach((e, i) => expect(e.indice).toBe(i))
  })

  it('começa na primeira etapa, sem nada concluído', () => {
    const e = estadoInicial()
    expect(e.etapa).toBe('uso')
    expect(e.concluidas).toEqual([])
    expect(progresso(e)).toBe(0)
  })
})

describe('validação por etapa', () => {
  it('cada etapa valida só os seus campos', () => {
    const vazio = estadoInicial()
    expect(validarEtapa('uso', vazio).map((x) => x.campo)).toEqual(['uso'])
    expect(validarEtapa('dimensoes', vazio).map((x) => x.campo)).toEqual(['vao', 'comprimento', 'peDireito'])
    expect(validarEtapa('contexto', vazio).map((x) => x.campo)).toEqual(['cidade'])
    expect(validarEtapa('contato', vazio).map((x) => x.campo)).toEqual(['nome', 'email'])
  })

  it('erro de dimensão aponta o campo exato, não o conjunto', () => {
    const e = estadoInicial({ vao: 25, comprimento: 60, peDireito: 99 })
    expect(validarEtapa('dimensoes', e).map((x) => x.campo)).toEqual(['peDireito'])
  })
})

describe('navegação', () => {
  it('não avança com a etapa inválida e devolve os erros', () => {
    const depois = avancar(estadoInicial())
    expect(depois.etapa).toBe('uso')
    expect(depois.erros).toHaveLength(1)
    expect(erroDoCampo(depois, 'uso')).toMatch(/uso/i)
    expect(depois.concluidas).toEqual([])
  })

  it('avança e marca a etapa como concluída', () => {
    const depois = avancar(estadoInicial({ uso: 'industrial' }))
    expect(depois.etapa).toBe('dimensoes')
    expect(depois.concluidas).toEqual(['uso'])
    expect(depois.erros).toEqual([])
  })

  it('percorre o funil inteiro e chega pronto para enviar', () => {
    const fim = percorrer()
    expect(fim.etapa).toBe('contato')
    expect(fim.concluidas).toHaveLength(TOTAL_ETAPAS)
    expect(progresso(fim)).toBe(1)
    expect(podeEnviar(fim)).toBe(true)
  })

  it('não conclui duas vezes a mesma etapa', () => {
    let e = avancar(estadoInicial({ uso: 'industrial' }))
    e = voltar(e)
    e = avancar(e)
    expect(e.concluidas).toEqual(['uso'])
  })

  it('a última etapa não avança para lugar nenhum', () => {
    const fim = percorrer()
    expect(avancar(fim).etapa).toBe('contato')
  })

  it('voltar na primeira etapa não faz nada', () => {
    const e = estadoInicial()
    expect(voltar(e)).toBe(e)
  })

  it('o salto direto só vai para trás ou para etapa já concluída', () => {
    const inicio = estadoInicial({ uso: 'industrial' })
    expect(irPara(inicio, 'contato').etapa).toBe('uso')
    const depois = avancar(inicio)
    expect(irPara(depois, 'uso').etapa).toBe('uso')
  })

  it('voltar limpa os erros exibidos', () => {
    let e = avancar(estadoInicial({ uso: 'industrial' }))
    e = avancar(e)
    expect(e.erros.length).toBeGreaterThan(0)
    expect(voltar(e).erros).toEqual([])
  })
})

describe('envio', () => {
  it('bloqueia enquanto faltar qualquer etapa', () => {
    expect(podeEnviar(estadoInicial())).toBe(false)
    expect(podeEnviar({ ...completo(), contato: { nome: 'Ana', email: 'invalido' } })).toBe(false)
    expect(podeEnviar({ ...completo(), configuracao: { ...completo().configuracao, cidade: '' } })).toBe(false)
  })
})

describe('edição de campos', () => {
  it('não mostra erro antes de o visitante tentar avançar', () => {
    const e = definirConfiguracao(estadoInicial(), { vao: 999 })
    expect(e.erros).toEqual([])
  })

  it('revalida enquanto digita depois do primeiro erro', () => {
    const comErro = avancar(estadoInicial())
    expect(comErro.erros).toHaveLength(1)
    const corrigido = definirConfiguracao(comErro, { uso: 'logistico' })
    expect(corrigido.erros).toEqual([])
  })

  it('o contato segue o mesmo comportamento', () => {
    let e = percorrer()
    e = { ...e, contato: {}, tocadas: [...e.tocadas, 'contato'] }
    e = definirContato(e, { nome: 'A' })
    expect(e.erros.map((x) => x.campo)).toEqual(['nome', 'email'])
    e = definirContato(e, { nome: 'Ana Souza', email: 'ana@exemplo.com' })
    expect(e.erros).toEqual([])
  })

  it('preserva o que já havia na configuração', () => {
    const e = definirConfiguracao(estadoInicial({ uso: 'agro' }), { vao: 20 })
    expect(e.configuracao).toEqual({ uso: 'agro', vao: 20 })
  })
})
