import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MOTIVO_INDISPONIVEL, PROVEDOR_INDISPONIVEL, VERSAO_CONTRATO, provedorHttp, type PedidoPreEngenharia } from './orcamento'

const pedido: PedidoPreEngenharia = {
  versaoContrato: VERSAO_CONTRATO,
  configuracao: { uso: 'industrial', vao: 25, comprimento: 60, peDireito: 8, cidade: 'Goiânia, GO' },
  idSessao: 'sessao-teste',
}

describe('provedor desta fase', () => {
  it('nunca se declara disponível', () => {
    expect(PROVEDOR_INDISPONIVEL.disponivel()).toBe(false)
  })

  it('recusa sempre, com motivo legível', async () => {
    const r = await PROVEDOR_INDISPONIVEL.estimar(pedido)
    expect(r.status).toBe('indisponivel')
    expect(r).toMatchObject({ motivo: MOTIVO_INDISPONIVEL })
  })

  it('não faz rede: um fetch global quebrado não o afeta', async () => {
    const original = globalThis.fetch
    globalThis.fetch = (() => { throw new Error('rede proibida nesta fase') }) as typeof fetch
    try {
      await expect(PROVEDOR_INDISPONIVEL.estimar(pedido)).resolves.toMatchObject({ status: 'indisponivel' })
    } finally {
      globalThis.fetch = original
    }
  })
})

describe('provedor HTTP da Fase 02', () => {
  const resposta = (corpo: unknown, ok = true) =>
    (async () => ({ ok, json: async () => corpo })) as unknown as typeof fetch

  it('repassa a resposta válida do serviço', async () => {
    const p = provedorHttp('/api/pre-engenharia', resposta({ status: 'ok', resultado: { ressalva: 'Estimativa preliminar.', investimento: { min: 1, max: 2, unidade: 'BRL' } } }))
    await expect(p.estimar(pedido)).resolves.toMatchObject({ status: 'ok' })
  })

  it('recusa resultado sem ressalva: número solto nunca vai à tela', async () => {
    const p = provedorHttp('/api/pre-engenharia', resposta({ status: 'ok', resultado: { investimento: { min: 1, max: 2, unidade: 'BRL' } } }))
    await expect(p.estimar(pedido)).resolves.toMatchObject({ status: 'indisponivel' })
  })

  it('erro de rede ou HTTP vira indisponível, nunca estimativa inventada', async () => {
    const comErro = provedorHttp('/api/pre-engenharia', (() => { throw new Error('offline') }) as unknown as typeof fetch)
    await expect(comErro.estimar(pedido)).resolves.toMatchObject({ status: 'indisponivel' })
    const com500 = provedorHttp('/api/pre-engenharia', resposta({}, false))
    await expect(com500.estimar(pedido)).resolves.toMatchObject({ status: 'indisponivel' })
  })

  it('o pedido não carrega dado pessoal', () => {
    const chaves = Object.keys(pedido)
    for (const proibido of ['nome', 'email', 'telefone', 'contato']) expect(chaves).not.toContain(proibido)
  })
})

/**
 * Guarda da regra central da fase: nenhuma tabela comercial ou cálculo de preço
 * mora no frontend. Varre os módulos do simulador procurando valor monetário
 * literal e identificadores de precificação.
 */
describe('nenhum valor comercial no frontend', () => {
  const dir = dirname(fileURLToPath(import.meta.url))
  const fontes = readdirSync(dir).filter((f: string) => f.endsWith('.ts') && !f.endsWith('.test.ts'))

  it('varre todos os módulos do simulador', () => {
    expect(fontes.length).toBeGreaterThanOrEqual(5)
  })

  for (const arquivo of fontes) {
    it(`${arquivo} não traz preço nem coeficiente de custo`, () => {
      const codigo = readFileSync(resolve(dir, arquivo), 'utf8')
      // Valor monetário literal: "R$ 1.234", "1234 reais".
      expect(codigo, 'valor em reais no código').not.toMatch(/R\$\s*\d|\d\s*reais\b/i)
      // Identificador de precificação com número ao lado.
      expect(codigo, 'tabela de preço no código').not.toMatch(/(preco|price|custo|cost|valorM2|kgPorM2|tabelaComercial)\w*\s*[:=]\s*[\d[{]/i)
    })
  }
})
