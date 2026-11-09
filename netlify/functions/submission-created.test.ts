/**
 * O transporte do formulário para o CRM.
 *
 * O que estes testes protegem: o segredo nunca sai do servidor, o corpo vai
 * como veio, falha transitória é repetida, 4xx não é, e NADA do conteúdo do
 * lead aparece em log. A entrega não é garantida — e o teste registra isso
 * em vez de finjir que é.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handler } from './submission-created.mts'

const SUBMISSAO = JSON.stringify({
  payload: {
    id: 'nf-123', form_name: 'simular-galpao', created_at: '2026-11-09T14:00:00.000Z',
    data: { nome: 'Ana (FICTÍCIO)', email: 'ana@exemplo.com.br', telefone: '62 90000-0000', area: '900' },
  },
})

const chamadas: { url: string; init: RequestInit }[] = []
const logs: string[] = []
let originalFetch: typeof fetch

beforeEach(() => {
  chamadas.length = 0
  logs.length = 0
  originalFetch = globalThis.fetch
  vi.spyOn(console, 'log').mockImplementation((t: unknown) => { logs.push(String(t)) })
  process.env.EIFF_FORM_SECRET = 'segredo-de-teste'
  process.env.EIFF_CRM_FORM_ENDPOINT = 'https://exemplo.invalido/api/formulario-site'
  vi.useFakeTimers()
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
  vi.useRealTimers()
  delete process.env.EIFF_FORM_SECRET
  delete process.env.EIFF_CRM_FORM_ENDPOINT
})

const responder = (sequencia: (number | 'rede')[]) => {
  let i = 0
  globalThis.fetch = ((url: string, init: RequestInit) => {
    chamadas.push({ url, init })
    const r = sequencia[Math.min(i, sequencia.length - 1)]
    i += 1
    if (r === 'rede') return Promise.reject(new Error('socket caiu'))
    return Promise.resolve({ ok: r >= 200 && r < 300, status: r } as Response)
  }) as unknown as typeof fetch
}

/** Executa o handler deixando os temporizadores da espera correrem. */
const rodar = async () => {
  const p = handler({ body: SUBMISSAO })
  await vi.runAllTimersAsync()
  return p
}

describe('transporte · o pedido que sai', () => {
  it('manda o corpo como veio, com o segredo no cabeçalho', async () => {
    responder([200])
    await rodar()
    expect(chamadas.length).toBe(1)
    expect(chamadas[0]!.url).toBe('https://exemplo.invalido/api/formulario-site')
    expect(chamadas[0]!.init.method).toBe('POST')
    expect(chamadas[0]!.init.body).toBe(SUBMISSAO)
    const cab = chamadas[0]!.init.headers as Record<string, string>
    expect(cab['x-eiff-form-secret']).toBe('segredo-de-teste')
  })

  it('sem segredo configurado não manda nada', async () => {
    delete process.env.EIFF_FORM_SECRET
    responder([200])
    await rodar()
    expect(chamadas.length).toBe(0)
  })

  it('sem corpo não manda nada', async () => {
    responder([200])
    const p = handler({ body: '' })
    await vi.runAllTimersAsync()
    await p
    expect(chamadas.length).toBe(0)
  })
})

describe('transporte · falha', () => {
  it('repete falha de rede e 5xx, até entregar', async () => {
    responder(['rede', 503, 200])
    await rodar()
    expect(chamadas.length).toBe(3)
    expect(logs.some((l) => l.includes('"outcome":"entregue"'))).toBe(true)
  })

  it('não repete 4xx: é decisão do CRM', async () => {
    responder([400])
    await rodar()
    expect(chamadas.length).toBe(1)
    expect(logs.some((l) => l.includes('"outcome":"recusado"'))).toBe(true)
  })

  it('esgotadas as tentativas, aponta a recuperação em vez de fingir entrega', async () => {
    responder([500])
    await rodar()
    expect(chamadas.length).toBe(3)
    const ultimo = logs[logs.length - 1]!
    expect(ultimo).toContain('"outcome":"nao_entregue"')
    expect(ultimo).toContain('"recuperacao":"reconciliador"')
  })
})

describe('transporte · o que nunca aparece em log', () => {
  it('nem o segredo, nem o corpo, nem os dados de quem preencheu', async () => {
    responder(['rede', 500, 500])
    await rodar()
    const tudo = logs.join(' | ')
    expect(tudo).not.toContain('segredo-de-teste')
    expect(tudo).not.toContain('ana@exemplo.com.br')
    expect(tudo).not.toContain('62 90000-0000')
    expect(tudo).not.toContain('FICTÍCIO')
  })
})
