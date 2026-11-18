/**
 * O contrato de campos entre o site e o EIFF Control.
 *
 * Cada submissão vai ao CRM com os campos exatamente como o `name` do HTML os
 * nomeia (a função de evento não traduz nada). Do outro lado, o CRM lê esses
 * nomes um a um (`canonicoDaSubmissao` em `src/core/radar/formularioSite.ts` e
 * `CAMPOS_DESCRITOS_DO_BRUTO` em `src/core/radar/formularioGravacao.ts`, no
 * repositório eiff-control). Renomear um campo aqui não quebra build nenhum: o
 * dado continua guardado como evidência, mas some da conversa que o comercial
 * lê, sem erro visível. Este teste torna essa quebra visível ANTES do merge.
 *
 * Mudou um nome de propósito? Mude primeiro o CRM, depois esta lista.
 *
 * Limites, ditos para não serem esquecidos:
 *   - o contrato é de mão única: campo novo no site que o CRM não lê (ex.:
 *     `cobertura`, `piso`) não falha aqui; ele vai só para a evidência, e
 *     isso é intencional até o CRM decidir mostrá-lo;
 *   - `tipo` é lido pelo CRM a partir do eiff-control#97;
 *   - campos ocultos preenchidos por JavaScript (`resumo`, `especificacao`,
 *     `leitura`, `area` do simulador) são conferidos só como presentes no
 *     HTML; se o script parar de preenchê-los, quem pega são os testes do
 *     simulador, não este.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Os formulários que o CRM aceita (`FORMULARIOS` no CRM) e a página de cada um. */
const PAGINAS = { 'iniciar-projeto': 'contato.html', 'simular-galpao': 'simular-galpao.html' } as const
type Formulario = keyof typeof PAGINAS

/** Campos que o CRM lê de cada formulário. Todos precisam existir no HTML. */
const CAMPOS_QUE_O_CRM_LE: Record<Formulario, readonly string[]> = {
  'iniciar-projeto': ['nome', 'empresa', 'email', 'telefone', 'cidade', 'tipo', 'area', 'prazo', 'mensagem'],
  'simular-galpao': [
    'nome', 'empresa', 'email', 'telefone', 'cidade', 'uso', 'area', 'vao', 'comprimento', 'peDireito',
    'observacao', 'resumo', 'especificacao', 'leitura', 'origem', 'prazo', 'escopo',
  ],
}

/**
 * O trecho do `<form name="...">`, sem o que o navegador nunca envia: comentários
 * e `<template>`. Devolve também as tags de campo (input, select, textarea).
 */
function formulario(nome: Formulario): { trecho: string; tags: string[] } {
  const html = readFileSync(resolve(RAIZ, PAGINAS[nome]), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<template[\s\S]*?<\/template>/gi, '')
  const inicio = html.search(new RegExp(`<form[^>]*\\sname="${nome}"`))
  expect(inicio, `<form name="${nome}"> em ${PAGINAS[nome]}`).toBeGreaterThanOrEqual(0)
  const trecho = html.slice(inicio, html.indexOf('</form>', inicio))
  const tags = [...trecho.matchAll(/<(?:input|select|textarea)\b[^>]*>/gi)].map((m) => m[0])
  return { trecho, tags }
}

const nomeDa = (tag: string) => /\sname="([^"]+)"/.exec(tag)?.[1]
/** Campo que o navegador envia: tem nome e não está desabilitado. */
const enviados = (tags: string[]) => new Set(tags.filter((t) => !/\sdisabled\b/i.test(t)).map(nomeDa).filter((n): n is string => !!n))

describe('contrato de campos site → CRM', () => {
  for (const nome of Object.keys(PAGINAS) as Formulario[]) {
    it(`«${nome}» é detectável pelo Netlify Forms`, () => {
      const { trecho } = formulario(nome)
      expect(trecho).toMatch(/^<form[^>]*\sdata-netlify="true"/)
      expect(trecho).toMatch(/^<form[^>]*\snetlify-honeypot="empresa-site"/)
    })

    it(`«${nome}» envia todos os campos que o CRM lê, com o mesmo nome`, () => {
      const campos = enviados(formulario(nome).tags)
      expect(CAMPOS_QUE_O_CRM_LE[nome].filter((c) => !campos.has(c))).toEqual([])
    })

    it(`«${nome}» exige e-mail: sem ele o CRM não abre conversa`, () => {
      const email = formulario(nome).tags.filter((t) => nomeDa(t) === 'email')
      expect(email).toHaveLength(1)
      expect(email[0]).toMatch(/\srequired\b/)
    })
  }
})

describe('a pasta de funções só tem a função de evento', () => {
  // Todo arquivo em netlify/functions vira endpoint. Uma função nova faz este teste (e, como o build roda o
  // vitest, o deploy) falhar DE PROPÓSITO: entrar uma função é decisão explícita, com esta lista atualizada.
  it('nada além do encaminhador', () => {
    expect(readdirSync(resolve(RAIZ, 'netlify', 'functions')).sort()).toEqual(['submission-created.mts'])
  })
})
