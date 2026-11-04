import { describe, expect, it } from 'vitest'
import { propsDoEvento, sanearRotulo } from './eventos'

describe('sanearRotulo', () => {
  it('deixa passar rótulo simples', () => {
    expect(sanearRotulo('complexo-logistico')).toBe('complexo-logistico')
  })

  it('tira o que não é seguro', () => {
    expect(sanearRotulo('smart<script>fit')).toBe('smartscriptfit')
  })

  it('corta rótulo longo em 40 caracteres', () => {
    expect(sanearRotulo('a'.repeat(80))).toHaveLength(40)
  })

  it('devolve undefined para vazio, só espaço ou ausente', () => {
    expect(sanearRotulo('')).toBeUndefined()
    expect(sanearRotulo('   ')).toBeUndefined()
    expect(sanearRotulo(undefined)).toBeUndefined()
  })

  it('desfigura e-mail que caia aqui por engano: o arroba não passa', () => {
    const saida = sanearRotulo('pessoa@empresa.com.br')
    expect(saida).not.toContain('@')
    expect(saida).toBe('pessoaempresa.com.br')
  })

  it('derruba telefone formatado para dígitos sem pontuação de agrupamento', () => {
    expect(sanearRotulo('+55 (62) 99999-9999')).toBe('55 62 99999-9999')
  })
})

describe('propsDoEvento', () => {
  it('sem rótulo, não manda props', () => {
    expect(propsDoEvento()).toBeUndefined()
    expect(propsDoEvento('')).toBeUndefined()
  })

  it('com rótulo, manda só a chave rotulo', () => {
    expect(propsDoEvento('complexo-logistico')).toEqual({ rotulo: 'complexo-logistico' })
  })

  it('nunca manda outra chave além de rotulo', () => {
    const props = propsDoEvento('fabricacao')
    expect(Object.keys(props ?? {})).toEqual(['rotulo'])
  })
})
