import { describe, expect, it } from 'vitest'
import {
  CHAVES_PERMITIDAS,
  capturarOrigem, faixaDeArea, filtrarProps, origemEmTexto, origemVazia, podeRastrear, ufDeCidade,
} from './analytics'

const janela = (dnt: string | null, optout: string | null) => ({
  navigator: { doNotTrack: dnt } as unknown as Navigator,
  localStorage: { getItem: () => optout } as unknown as Storage,
})

describe('consentimento', () => {
  it('não rastreia com Do Not Track ligado', () => {
    expect(podeRastrear(janela('1', null))).toBe(false)
    expect(podeRastrear(janela('yes', null))).toBe(false)
  })

  it('não rastreia com opt-out guardado', () => {
    expect(podeRastrear(janela(null, '1'))).toBe(false)
  })

  it('rastreia quando não há recusa', () => {
    expect(podeRastrear(janela(null, null))).toBe(true)
    expect(podeRastrear(janela('0', null))).toBe(true)
  })

  it('falha fechada quando o storage lança', () => {
    const quebrado = {
      navigator: {} as Navigator,
      localStorage: { getItem: () => { throw new Error('bloqueado') } } as unknown as Storage,
    }
    expect(podeRastrear(quebrado)).toBe(false)
  })
})

describe('captura de origem', () => {
  it('lê os parâmetros de campanha', () => {
    const o = capturarOrigem('?utm_source=google&utm_medium=cpc&utm_campaign=galpao-go&gclid=abc123', 'https://www.google.com/search?q=galpao')
    expect(o).toEqual({
      source: 'google', medium: 'cpc', campaign: 'galpao-go',
      clique: 'abc123', cliquePlataforma: 'google', referencia: 'www.google.com',
    })
  })

  /**
   * O corte em 80 caracteres valia também para o identificador de clique, e um
   * `gclid` real passa disso. Truncado, ele não serve para a importação de
   * conversão offline — que é o único jeito de medir o retorno do anúncio sem
   * instalar tag nem cookie no site.
   */
  it('não trunca o identificador de clique', () => {
    const gclid = 'EAIaIQobChMI' + 'a1B2c3D4e5'.repeat(8) // 92 caracteres
    expect(gclid.length).toBeGreaterThan(80)
    expect(capturarOrigem(`?gclid=${gclid}`).clique).toBe(gclid)
  })

  it('diz de qual plataforma veio o clique, em ordem de precedência', () => {
    expect(capturarOrigem('?gclid=g1')).toMatchObject({ clique: 'g1', cliquePlataforma: 'google' })
    expect(capturarOrigem('?wbraid=w1')).toMatchObject({ clique: 'w1', cliquePlataforma: 'google' })
    expect(capturarOrigem('?gbraid=b1')).toMatchObject({ clique: 'b1', cliquePlataforma: 'google' })
    expect(capturarOrigem('?fbclid=f1')).toMatchObject({ clique: 'f1', cliquePlataforma: 'meta' })
    expect(capturarOrigem('?msclkid=m1')).toMatchObject({ clique: 'm1', cliquePlataforma: 'microsoft' })
    // Com mais de um, o do Google vence: é o que sustenta a importação offline.
    expect(capturarOrigem('?fbclid=f1&gclid=g1').cliquePlataforma).toBe('google')
  })

  it('a linha de origem identifica a plataforma do clique', () => {
    expect(origemEmTexto(capturarOrigem('?gclid=abc'))).toContain('clique google: abc')
    expect(origemEmTexto(capturarOrigem('?fbclid=abc'))).toContain('clique meta: abc')
  })

  it('ignora o que não veio', () => {
    expect(origemVazia(capturarOrigem(''))).toBe(true)
    expect(capturarOrigem('?utm_source=')).toEqual({})
  })

  it('guarda só o host do referenciador, nunca o caminho', () => {
    const o = capturarOrigem('', 'https://portal.exemplo.com/artigo/quem-somos?id=42')
    expect(o.referencia).toBe('portal.exemplo.com')
  })

  it('aguenta referenciador inválido', () => {
    expect(capturarOrigem('', 'nao-e-url').referencia).toBeUndefined()
  })

  it('sanea caracteres perigosos e corta o tamanho', () => {
    const o = capturarOrigem(`?utm_campaign=${encodeURIComponent('<script>alerta()</script>')}&utm_term=${'x'.repeat(200)}`)
    expect(o.campaign).not.toMatch(/[<>()]/)
    expect(o.term!.length).toBeLessThanOrEqual(80)
  })

  it('descreve a origem em uma linha legível', () => {
    expect(origemEmTexto({ source: 'google', medium: 'cpc' })).toBe('origem: google · mídia: cpc')
    expect(origemEmTexto({})).toBe('direto')
  })
})

describe('eventos sem dado pessoal', () => {
  it('descarta qualquer chave fora da lista', () => {
    const props = filtrarProps({
      etapa: 'contato',
      uso: 'industrial',
      nome: 'Ana Souza',
      email: 'ana@exemplo.com',
      telefone: '62999999999',
      empresa: 'Indústria X',
      cidade: 'Goiânia, GO',
      observacao: 'texto livre do cliente',
    })
    expect(props).toEqual({ etapa: 'contato', uso: 'industrial' })
  })

  it('a lista permitida não contém campo de identificação', () => {
    for (const proibido of ['nome', 'email', 'telefone', 'empresa', 'cidade', 'observacao']) {
      expect(CHAVES_PERMITIDAS).not.toContain(proibido)
    }
  })

  it('encurta valores longos', () => {
    expect((filtrarProps({ campanha: 'y'.repeat(300) }).campanha as string).length).toBeLessThanOrEqual(80)
  })

  it('mantém número e booleano como são', () => {
    expect(filtrarProps({ vao: 32, estudo_especifico: false })).toEqual({ vao: 32, estudo_especifico: false })
  })
})

describe('generalização dos dados', () => {
  it('envia faixa de área, não a área exata', () => {
    expect(faixaDeArea(300)).toBe('ate-500')
    expect(faixaDeArea(1500)).toBe('1000-2500')
    expect(faixaDeArea(40000)).toBe('acima-10000')
    expect(faixaDeArea(undefined)).toBeUndefined()
  })

  it('envia só a UF, não a cidade', () => {
    expect(ufDeCidade('Aparecida de Goiânia, GO')).toBe('GO')
    expect(ufDeCidade('Cabo Frio/RJ')).toBe('RJ')
    expect(ufDeCidade('Goiânia')).toBeUndefined()
    expect(ufDeCidade(undefined)).toBeUndefined()
  })
})
