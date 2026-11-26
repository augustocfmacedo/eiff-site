/**
 * P1 — isolamento de produção e preview. Determinístico, sem rede, segredos fictícios.
 *
 * Duas camadas, cada uma provada aqui:
 *   1. BUILD: fora do contexto `production` não existe formulário no HTML publicado
 *      (`scripts/formularios-por-contexto.mjs`), então a tela de um preview não produz submissão.
 *   2. FUNÇÃO: o encaminhador só fala com o CRM no deploy de produção PUBLICADO deste site, para os dois
 *      formulários de produção; sem contexto confiável, não encaminha.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import reencaminhar, { FORMULARIOS_DE_PRODUCAO, SITE_DE_PRODUCAO, origemAutorizada } from '../../netlify/functions/submission-created.mts'
// @ts-expect-error módulo .mjs de build sem tipos
import { AVISO, FORMULARIOS, aplicar, desativarFormularios, faltasEmProducao, restosDeFormulario } from '../../scripts/formularios-por-contexto.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CONTATO = readFileSync(resolve(RAIZ, 'contato.html'), 'utf8')
const SIMULADOR = readFileSync(resolve(RAIZ, 'simular-galpao.html'), 'utf8')

const SEGREDO = 'segredo-ficticio-p1-0000'
const corpo = (form_name: string) => JSON.stringify({ payload: { id: 'nf-p1', form_name, created_at: '2026-11-18T12:00:00.000Z', data: { nome: 'Teste (FICTÍCIO)', email: 'teste@exemplo.invalid' } } })
const evento = (c: string) => new Request('https://exemplo.invalid/.netlify/functions/submission-created', { method: 'POST', body: c })
const PRODUCAO = { site: { id: SITE_DE_PRODUCAO }, deploy: { context: 'production', published: true } }

describe('build · fora da produção não há formulário', () => {
  for (const [nome, html] of [['contato.html', CONTATO], ['simular-galpao.html', SIMULADOR]] as const) {
    it(`${nome}: desativado, sem resto de Netlify Forms, com aviso visível`, () => {
      const { html: fora, trocas } = desativarFormularios(html)
      expect(trocas).toBe(2) // o <form> e o campo oculto form-name
      expect(restosDeFormulario(fora)).toEqual([])
      expect(fora).toContain('data-formulario-desativado="nao-produtivo"')
      expect(fora).toContain(AVISO)
      /* os campos continuam: o preview serve para ver a tela, não para enviar */
      expect(fora).toContain('name="email"')
    })
  }

  it('variações de caixa e de aspas também são desativadas (o Netlify não diferencia)', () => {
    const variantes = [
      '<FORM NAME="iniciar-projeto" DATA-NETLIFY="true" NETLIFY-HONEYPOT="empresa-site"><INPUT TYPE="hidden" NAME="form-name" VALUE="iniciar-projeto"></FORM>',
      "<form name='iniciar-projeto' data-netlify='true' netlify-honeypot='empresa-site'><input type='hidden' name='form-name' value='iniciar-projeto'></form>",
      '<form name="iniciar-projeto" data-netlify=true netlify-honeypot=empresa-site><input type=hidden name=form-name value=iniciar-projeto></form>',
      '<form name="iniciar-projeto" data-netlify="TRUE"><input name="form-name" value="iniciar-projeto"></form>',
    ]
    for (const html of variantes) {
      const { html: fora } = desativarFormularios(html)
      expect(restosDeFormulario(fora), html).toEqual([])
    }
  })

  it('produção exige o form-name DENTRO do próprio form, e honeypot', () => {
    const forms = '<form name="iniciar-projeto" data-netlify="true" netlify-honeypot="h"></form><form name="simular-galpao" data-netlify="true" netlify-honeypot="h"></form>'
    const inputs = '<input type="hidden" name="form-name" value="iniciar-projeto"><input type="hidden" name="form-name" value="simular-galpao">'
    /* form-name em outra página (ou fora do form) não conta */
    expect(faltasEmProducao([forms, inputs])).toEqual(['iniciar-projeto', 'simular-galpao'])
    /* sem honeypot também não */
    expect(faltasEmProducao(['<form name="iniciar-projeto" data-netlify="true"><input name="form-name" value="iniciar-projeto"></form>'])).toContain('iniciar-projeto')
  })

  it('o HTML-fonte é o de produção: os dois formulários estão declarados', () => {
    expect(faltasEmProducao([CONTATO, SIMULADOR])).toEqual([])
    expect(FORMULARIOS).toEqual(FORMULARIOS_DE_PRODUCAO)
  })

  describe('sobre um dist de verdade (pasta temporária)', () => {
    let dist: string
    beforeEach(() => {
      dist = mkdtempSync(join(tmpdir(), 'eiff-p1-'))
      mkdirSync(join(dist, 'contato')); mkdirSync(join(dist, 'simular-galpao'))
      writeFileSync(join(dist, 'contato', 'index.html'), CONTATO)
      writeFileSync(join(dist, 'simular-galpao', 'index.html'), SIMULADOR)
      writeFileSync(join(dist, 'index.html'), '<html><body>início</body></html>')
    })
    afterEach(() => { rmSync(dist, { recursive: true, force: true }) })

    for (const contexto of ['deploy-preview', 'branch-deploy', 'dev', undefined, '', 'Production', 'production ']) {
      it(`contexto ${JSON.stringify(contexto)}: desativa (fail-closed)`, () => {
        const r = aplicar(dist, contexto)
        expect(r.desativados).toBe(2)
        for (const p of ['contato', 'simular-galpao']) expect(restosDeFormulario(readFileSync(join(dist, p, 'index.html'), 'utf8'))).toEqual([])
      })
    }

    it('contexto production: não muda nada e confere os dois formulários', () => {
      const antes = readFileSync(join(dist, 'contato', 'index.html'), 'utf8')
      expect(aplicar(dist, 'production')).toEqual({ contexto: 'production', desativados: 0 })
      expect(readFileSync(join(dist, 'contato', 'index.html'), 'utf8')).toBe(antes)
    })

    it('produção sem formulário quebra o build (o deploy no ar continua servindo)', () => {
      writeFileSync(join(dist, 'contato', 'index.html'), desativarFormularios(CONTATO).html)
      expect(() => aplicar(dist, 'production')).toThrow(/iniciar-projeto/)
    })
  })
})

describe('função · só a produção publicada deste site encaminha', () => {
  const chamadas: unknown[] = []
  const logs: string[] = []
  beforeEach(() => {
    chamadas.length = 0; logs.length = 0
    process.env.EIFF_FORM_SECRET = SEGREDO
    vi.spyOn(console, 'log').mockImplementation((t: unknown) => { logs.push(String(t)) })
    globalThis.fetch = (async (url: string, init: RequestInit) => { chamadas.push({ url, init }); return { ok: true, status: 200 } as Response }) as unknown as typeof fetch
  })
  afterEach(() => { vi.restoreAllMocks(); delete process.env.EIFF_FORM_SECRET })

  it('produção autorizada encaminha, com o segredo no cabeçalho e o corpo como veio', async () => {
    const c = corpo('iniciar-projeto')
    await reencaminhar(evento(c), PRODUCAO)
    expect(chamadas).toHaveLength(1)
    const { init } = chamadas[0] as { init: RequestInit }
    expect((init.headers as Record<string, string>)['x-eiff-form-secret']).toBe(SEGREDO)
    expect(init.body).toBe(c)
  })

  const bloqueios: [string, unknown, string][] = [
    ['deploy preview', { ...PRODUCAO, deploy: { context: 'deploy-preview', published: false } }, 'contexto_nao_produtivo'],
    ['branch deploy', { ...PRODUCAO, deploy: { context: 'branch-deploy', published: false } }, 'contexto_nao_produtivo'],
    ['deploy de produção antigo (não publicado)', { ...PRODUCAO, deploy: { context: 'production', published: false } }, 'deploy_nao_publicado'],
    ['published como texto', { ...PRODUCAO, deploy: { context: 'production', published: 'true' } }, 'deploy_nao_publicado'],
    ['outro site (cópia do repositório público)', { ...PRODUCAO, site: { id: 'outro-site' } }, 'outro_site'],
    ['sem contexto', undefined, 'contexto_ausente'],
    ['contexto vazio', {}, 'contexto_ausente'],
    ['contexto sem deploy', { site: { id: SITE_DE_PRODUCAO } }, 'contexto_ausente'],
  ]
  for (const [nome, contexto, motivo] of bloqueios) {
    it(`${nome}: não encaminha (${motivo})`, async () => {
      await reencaminhar(evento(corpo('iniciar-projeto')), contexto)
      expect(chamadas).toHaveLength(0)
      expect(logs.join('\n')).toContain(`"motivo":"${motivo}"`)
    })
  }

  it('sem contexto da plataforma o log dispara o alarme: todo lead estaria parando', async () => {
    await reencaminhar(evento(corpo('iniciar-projeto')), undefined)
    expect(logs.join('\n')).toContain('"alerta":"TODO_LEAD_BLOQUEADO"')
    logs.length = 0
    await reencaminhar(evento(corpo('iniciar-projeto')), { ...PRODUCAO, deploy: { context: 'deploy-preview', published: false } })
    expect(logs.join('\n')).not.toContain('alerta')
  })

  it('formulário que não é de produção não encaminha, nem em produção', async () => {
    for (const nome of ['iniciar-projeto--teste', 'outro', '']) {
      await reencaminhar(evento(corpo(nome)), PRODUCAO)
    }
    await reencaminhar(evento('não é json'), PRODUCAO)
    expect(chamadas).toHaveLength(0)
    expect(logs.join('\n')).toContain('"motivo":"formulario_nao_aceito"')
    expect(logs.join('\n')).toContain('"motivo":"corpo_ilegivel"')
  })

  it('a guarda é pura e não depende do corpo para o contexto: campo do formulário não abre a porta', () => {
    /* um corpo que "declara" produção não muda nada: a origem vem só da plataforma */
    const forjado = JSON.stringify({ payload: { form_name: 'iniciar-projeto', context: 'production', site_id: SITE_DE_PRODUCAO, data: { referrer: 'https://eiff.com.br/' } } })
    expect(origemAutorizada(undefined, forjado)).toEqual({ ok: false, motivo: 'contexto_ausente' })
    expect(origemAutorizada({ ...PRODUCAO, deploy: { context: 'deploy-preview', published: true } }, forjado).ok).toBe(false)
  })

  it('reenvio é idempotente do lado de cá: a mesma submissão sai byte a byte igual (a chave é o id no CRM)', async () => {
    const c = corpo('simular-galpao')
    await reencaminhar(evento(c), PRODUCAO)
    await reencaminhar(evento(c), PRODUCAO)
    const corpos = (chamadas as { init: RequestInit }[]).map((x) => x.init.body)
    expect(corpos).toEqual([c, c])
  })

  it('nenhum log traz segredo nem dado pessoal, em nenhum caminho', async () => {
    await reencaminhar(evento(corpo('iniciar-projeto')), PRODUCAO)
    for (const [, contexto] of bloqueios) await reencaminhar(evento(corpo('iniciar-projeto')), contexto)
    const tudo = logs.join('\n')
    for (const proibido of [SEGREDO, 'Teste (FICTÍCIO)', 'teste@exemplo.invalid', 'nf-p1']) expect(tudo).not.toContain(proibido)
  })
})
