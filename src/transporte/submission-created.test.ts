/**
 * O transporte do formulário para o CRM.
 *
 * O que estes testes protegem: o segredo nunca sai do servidor, o corpo vai
 * como veio, falha transitória é repetida, 4xx não é, e NADA do conteúdo do
 * lead aparece em log. A entrega não é garantida — e o teste registra isso
 * em vez de fingir que é.
 *
 * E protegem a FORMA DO EVENTO, que é onde isto quase foi ao ar errado: a
 * convenção de nome de arquivo entrega um **Request**, não um objeto com
 * `.body`. O teste principal roda com um Request de verdade, construído com
 * o corpo que o Netlify manda (`{ payload: … }`), e um teste separado prende
 * a ausência de um export `handler` — porque exportar `handler` e `default`
 * ao mesmo tempo deixa a plataforma escolher o contrato de chamada.
 *
 * E vive FORA de netlify/functions de propósito: todo arquivo solto naquela
 * pasta é uma função para a plataforma (a documentação não declara exceção
 * para arquivo de teste), e um teste empacotado como função levaria o vitest
 * para o deploy e publicaria um endpoint que não existe.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as modulo from '../../netlify/functions/submission-created.mts'
import reencaminhar, { corpoDoEvento } from '../../netlify/functions/submission-created.mts'

const SUBMISSAO = JSON.stringify({
  payload: {
    id: 'nf-123', form_name: 'simular-galpao', created_at: '2026-11-09T14:00:00.000Z',
    data: { nome: 'Ana (FICTÍCIO)', email: 'ana@exemplo.com.br', telefone: '62 90000-0000', area: '900' },
  },
})

/** O evento como a plataforma o entrega hoje: um Request com o corpo cru. */
const evento = (corpo = SUBMISSAO) => new Request('https://eiff.com.br/.netlify/functions/submission-created', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: corpo,
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

/** Executa a função deixando os temporizadores da espera correrem. */
const rodar = async (entrada: unknown = evento()) => {
  const p = reencaminhar(entrada)
  await vi.runAllTimersAsync()
  return p
}

describe('transporte · a forma do evento', () => {
  it('lê o corpo de um Request — o contrato da convenção de nome de arquivo', async () => {
    expect(await corpoDoEvento(evento())).toBe(SUBMISSAO)
  })

  it('e também do contrato antigo, com `.body` em texto: versão de API não perde lead', async () => {
    expect(await corpoDoEvento({ body: SUBMISSAO })).toBe(SUBMISSAO)
  })

  it('o que não é nenhum dos dois vira corpo vazio, não lixo autenticado', async () => {
    expect(await corpoDoEvento(null)).toBe('')
    expect(await corpoDoEvento({ body: null })).toBe('')
    expect(await corpoDoEvento('texto solto')).toBe('')
  })

  it('o módulo exporta UM contrato de chamada: default, e nenhum `handler`', () => {
    expect(typeof modulo.default).toBe('function')
    expect('handler' in modulo).toBe(false)
  })

  it('e o retorno é vazio: a plataforma não usa o valor devolvido', async () => {
    responder([200])
    expect(await rodar()).toBeUndefined()
  })
})

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
    await rodar(evento(''))
    expect(chamadas.length).toBe(0)
    expect(logs.some((l) => l.includes('"outcome":"sem_corpo"'))).toBe(true)
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
