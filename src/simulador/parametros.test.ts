import { describe, expect, it } from 'vitest'
import {
  LIMITES, REFERENCIAS,
  areaCoberta, exigeEstudoEspecifico, formatarArea, lerConfiguracao, lerNumero,
  nomeOpcao, resumoConfiguracao, USOS, validarConfiguracao, validarContato,
  validarMedida, validarTelefone,
} from './parametros'

describe('validarMedida', () => {
  it('exige o campo', () => {
    expect(validarMedida('vao', undefined)?.campo).toBe('vao')
    expect(validarMedida('vao', '')?.mensagem).toMatch(/obrigatório/)
  })

  it('recusa o que não é número', () => {
    expect(validarMedida('comprimento', 'quarenta')?.mensagem).toMatch(/número/)
    expect(validarMedida('comprimento', Infinity)?.mensagem).toMatch(/número/)
  })

  it('aplica os limites de cada medida', () => {
    expect(validarMedida('vao', LIMITES.vao.min - 1)?.mensagem).toMatch(/mínimo/)
    expect(validarMedida('vao', LIMITES.vao.max + 1)?.mensagem).toMatch(/máximo/)
    expect(validarMedida('vao', LIMITES.vao.min)).toBeNull()
    expect(validarMedida('vao', LIMITES.vao.max)).toBeNull()
    expect(validarMedida('peDireito', 7.5)).toBeNull()
  })

  it('aceita vírgula decimal, como o visitante digita', () => {
    expect(validarMedida('peDireito', '7,5')).toBeNull()
    expect(lerNumero('7,5')).toBe(7.5)
    expect(lerNumero('')).toBeUndefined()
    expect(lerNumero('abc')).toBeUndefined()
  })
})

describe('validarConfiguracao', () => {
  const completa = { uso: 'industrial', vao: 25, comprimento: 60, peDireito: 8, cidade: 'Goiânia, GO' } as const

  it('aceita a configuração completa', () => {
    expect(validarConfiguracao({ ...completa })).toEqual([])
  })

  it('exige uso e cidade', () => {
    const erros = validarConfiguracao({ vao: 25, comprimento: 60, peDireito: 8 })
    expect(erros.map((e) => e.campo)).toEqual(expect.arrayContaining(['uso', 'cidade']))
  })

  it('recusa valor fora do catálogo', () => {
    const erros = validarConfiguracao({ ...completa, cobertura: 'telha-de-barro' as never })
    expect(erros.map((e) => e.campo)).toContain('cobertura')
  })

  it('recusa cidade curta demais', () => {
    expect(validarConfiguracao({ ...completa, cidade: 'G' }).map((e) => e.campo)).toContain('cidade')
  })
})

describe('validarContato', () => {
  it('exige nome e e-mail válidos', () => {
    expect(validarContato({}).map((e) => e.campo)).toEqual(['nome', 'email'])
    expect(validarContato({ nome: 'Ana', email: 'ana@' }).map((e) => e.campo)).toEqual(['email'])
    expect(validarContato({ nome: 'Ana Souza', email: 'ana@eiff.com.br' })).toEqual([])
  })

  it('telefone é opcional, mas se vier precisa estar completo', () => {
    expect(validarContato({ nome: 'Ana', email: 'a@b.co', telefone: '' })).toEqual([])
    expect(validarContato({ nome: 'Ana', email: 'a@b.co', telefone: '6299' }).map((e) => e.campo)).toEqual(['telefone'])
    expect(validarContato({ nome: 'Ana', email: 'a@b.co', telefone: '(62) 99999-9999' })).toEqual([])
  })

  it('aceita telefone com DDI e máscara', () => {
    expect(validarTelefone('+55 (62) 99999-9999')).toBe(true)
    expect(validarTelefone('6233334444')).toBe(true)
    expect(validarTelefone('123')).toBe(false)
  })
})

describe('geometria e leitura técnica', () => {
  it('área é o produto das medidas informadas', () => {
    expect(areaCoberta({ vao: 25, comprimento: 60 })).toBe(1500)
    expect(areaCoberta({ vao: 25 })).toBeUndefined()
  })

  it('marca como executado o que está dentro do já entregue', () => {
    const obs = lerConfiguracao({ vao: REFERENCIAS.vaoExecutado.valor, peDireito: REFERENCIAS.peDireitoExecutado.valor })
    expect(obs.find((o) => o.id === 'vao')?.nivel).toBe('ok')
    expect(obs.find((o) => o.id === 'pe-direito')?.nivel).toBe('ok')
    expect(exigeEstudoEspecifico(obs)).toBe(false)
  })

  it('vão entre o executado e o projetado continua dentro do publicado', () => {
    const obs = lerConfiguracao({ vao: 38, peDireito: 10 })
    expect(obs.find((o) => o.id === 'vao')?.nivel).toBe('ok')
    expect(obs.find((o) => o.id === 'vao')?.texto).toContain('40')
  })

  it('acima do projetado pede estudo específico, sem prometer impossível', () => {
    const obs = lerConfiguracao({ vao: 52, peDireito: 16 })
    expect(exigeEstudoEspecifico(obs)).toBe(true)
    expect(obs.find((o) => o.id === 'vao')?.texto).toMatch(/estudo/)
    expect(obs.find((o) => o.id === 'pe-direito')?.nivel).toBe('especial')
  })

  it('toda observação de nível ok cita o projeto de referência', () => {
    const obs = lerConfiguracao({ vao: 30, peDireito: 10, piso: 'pesado' })
    for (const o of obs.filter((x) => x.nivel === 'ok')) expect(o.fonte, o.id).toBeTruthy()
  })

  it('nenhuma observação fala em dinheiro', () => {
    const obs = lerConfiguracao({ vao: 52, peDireito: 16, piso: 'pesado', uso: 'especial', terreno: 'nao', comprimento: 200 })
    for (const o of obs) expect(o.texto).not.toMatch(/R\$|custo|preço|valor/i)
  })
})

describe('formatação e resumo', () => {
  it('formata área em pt-BR', () => {
    expect(formatarArea(3600)).toBe('3.600')
  })

  it('resume só o que foi preenchido', () => {
    expect(resumoConfiguracao({})).toBe('')
    expect(resumoConfiguracao({ uso: 'logistico', vao: 32, comprimento: 100, peDireito: 12, cidade: 'Goiânia, GO' }))
      .toBe('Logística · 3.200 m² · vão 32 m · pé-direito 12 m · Goiânia, GO')
  })

  it('nomeOpcao devolve travessão quando não há escolha', () => {
    expect(nomeOpcao(USOS, undefined)).toBe('—')
    expect(nomeOpcao(USOS, 'agro')).toBe('Agro')
  })
})
