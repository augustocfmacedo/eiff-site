/**
 * O contrato de campos entre o site e o EIFF Control.
 *
 * Cada submissão vai ao CRM com os campos exatamente como o `name` do HTML os
 * nomeia (a função de evento não traduz nada). Do outro lado, o CRM lê esses
 * nomes um a um (`canonicoDaSubmissao` em `src/core/radar/formularioSite.ts` e
 * `resumoParaOInbox` em `src/core/radar/formularioGravacao.ts`, no repositório
 * eiff-control). Renomear um campo aqui não quebra build nenhum: o dado continua
 * guardado como evidência, mas some da conversa que o comercial lê, sem erro
 * visível. Este teste é a única coisa que torna essa quebra visível ANTES do merge.
 *
 * Mudou um nome de propósito? Mude primeiro o CRM, depois esta lista.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Os formulários que o CRM aceita (`FORMULARIOS` no CRM) e a página de cada um. */
const PAGINAS = { 'iniciar-projeto': 'contato.html', 'simular-galpao': 'simular-galpao.html' } as const

/** Campos que o CRM lê de cada formulário. Todos precisam existir no HTML. */
const CAMPOS_QUE_O_CRM_LE: Record<keyof typeof PAGINAS, readonly string[]> = {
  'iniciar-projeto': ['nome', 'empresa', 'email', 'telefone', 'cidade', 'tipo', 'area', 'prazo', 'mensagem'],
  'simular-galpao': [
    'nome', 'empresa', 'email', 'telefone', 'cidade', 'uso', 'area', 'vao', 'comprimento', 'peDireito',
    'observacao', 'resumo', 'especificacao', 'leitura', 'origem', 'prazo', 'escopo',
  ],
}

/** Os `name` dentro do `<form name="...">` da página, e só dele. */
function camposDoFormulario(formulario: keyof typeof PAGINAS): Set<string> {
  const html = readFileSync(resolve(RAIZ, PAGINAS[formulario]), 'utf8')
  const inicio = html.search(new RegExp(`<form[^>]*\\sname="${formulario}"`))
  expect(inicio, `<form name="${formulario}"> em ${PAGINAS[formulario]}`).toBeGreaterThanOrEqual(0)
  const fim = html.indexOf('</form>', inicio)
  const trecho = html.slice(inicio, fim)
  expect(trecho).toContain('data-netlify="true"')
  expect(trecho).toContain('netlify-honeypot="empresa-site"')
  return new Set([...trecho.matchAll(/\sname="([^"]+)"/g)].map((m) => m[1]!))
}

describe('contrato de campos site → CRM', () => {
  for (const formulario of Object.keys(PAGINAS) as (keyof typeof PAGINAS)[]) {
    it(`«${formulario}» expõe todos os campos que o CRM lê, com o mesmo nome`, () => {
      const campos = camposDoFormulario(formulario)
      const faltando = CAMPOS_QUE_O_CRM_LE[formulario].filter((c) => !campos.has(c))
      expect(faltando).toEqual([])
    })
  }

  it('o e-mail é obrigatório nos dois: sem ele o CRM não abre conversa', () => {
    for (const pagina of Object.values(PAGINAS)) {
      const html = readFileSync(resolve(RAIZ, pagina), 'utf8')
      expect(html, pagina).toMatch(/<input[^>]*name="email"[^>]*required/)
    }
  })
})

describe('a pasta de funções só tem a função de evento', () => {
  it('todo arquivo em netlify/functions vira endpoint: nada além do encaminhador', () => {
    expect(readdirSync(resolve(RAIZ, 'netlify', 'functions')).sort()).toEqual(['submission-created.mts'])
  })
})
