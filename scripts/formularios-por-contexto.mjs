/**
 * Pós-build (P1 — isolamento de produção e preview): fora da PRODUÇÃO, nenhum formulário do site existe.
 *
 * Por que no build e não na função de evento:
 *   - os formulários do Netlify são do SITE INTEIRO, não do deploy: uma submissão feita numa URL de preview
 *     entra na mesma lista da produção, e o evento `submission-created` roda no deploy PUBLICADO, com
 *     contexto de produção. Dentro da função não existe dado confiável que diga de onde a submissão veio
 *     (só o `referrer`, que é do navegador);
 *   - o último deploy de QUALQUER contexto atualiza a definição dos formulários do site.
 * Então o preview simplesmente não tem formulário: sem `data-netlify`, sem honeypot e sem o campo oculto
 * `form-name`. O envio pela tela chega sem `form-name`, e o Netlify não o trata como submissão.
 *
 * `CONTEXT` é variável de BUILD documentada do Netlify (production, deploy-preview, branch-deploy, dev).
 * Fail-closed: qualquer valor que não seja exatamente `production` — inclusive ausente, como num build
 * local — desativa os formulários. Consequência que vale saber: produção se publica pelo build do Git;
 * um `dist` gerado à mão e enviado com `netlify deploy --prod` sai SEM formulário (o smoke de toda
 * publicação confere `form-name` no ar).
 *
 * Em produção o script não muda nada e confere que os dois formulários estão completos no HTML (data-netlify,
 * honeypot e `form-name` DENTRO do próprio form): se faltar algo, o build falha e o deploy no ar continua
 * servindo — melhor do que publicar um site que não capta lead.
 *
 * Sem diferença de caixa nem de aspas: o parser do Netlify não diferencia, e um minificador pode mudar ambos.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const FORMULARIOS = Object.freeze(['iniciar-projeto', 'simular-galpao'])
export const AVISO = 'Ambiente de teste: este formulário não envia nada. Os formulários só funcionam em eiff.com.br.'

const ATTR_NETLIFY = /\s+data-netlify\s*=\s*["']?true["']?/i
const ATTR_HONEYPOT = /\s+netlify-honeypot\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i
const TAG_FORM_NETLIFY = /<form\b[^>]*\bdata-netlify\s*=\s*["']?true["']?[^>]*>/gi
const INPUT_FORM_NAME = /<input\b[^>]*\bname\s*=\s*["']?form-name["']?[^>]*>/gi

/** Desativa os formulários Netlify de UMA página. Pura: texto entra, texto sai. */
export function desativarFormularios(html) {
  let trocas = 0
  let saida = html.replace(TAG_FORM_NETLIFY, (tag) => {
    trocas += 1
    const limpa = tag.replace(ATTR_NETLIFY, '').replace(ATTR_HONEYPOT, '').replace(/<form\b/i, '<form data-formulario-desativado="nao-produtivo"')
    return `${limpa}<p class="aviso-ambiente" role="note" style="padding:.75rem 1rem;border:1px solid currentColor;margin:0 0 1rem">${AVISO}</p>`
  })
  saida = saida.replace(INPUT_FORM_NAME, () => { trocas += 1; return '' })
  return { html: saida, trocas }
}

/** O que sobrar de formulário Netlify numa página desativada é erro. */
export function restosDeFormulario(html) {
  const restos = []
  if (/\bdata-netlify\s*=/i.test(html)) restos.push('data-netlify')
  if (/\bnetlify-honeypot\s*=/i.test(html)) restos.push('netlify-honeypot')
  if (/\bname\s*=\s*["']?form-name\b/i.test(html)) restos.push('form-name')
  if (/<form\b[^>]*\snetlify(\s|>|=)/i.test(html)) restos.push('atributo netlify')
  return restos
}

/**
 * Em produção: cada formulário aceito pelo CRM está declarado com data-netlify e honeypot, e o campo
 * `form-name` com o mesmo nome está DENTRO do próprio <form> (não noutra página nem fora dele).
 */
export function faltasEmProducao(paginas) {
  const completos = new Set()
  for (const html of paginas) {
    for (const m of html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi)) {
      const bloco = m[0]
      const tag = /<form\b[^>]*>/i.exec(bloco)[0]
      if (!/\sdata-netlify="true"/.test(tag) || !/\snetlify-honeypot="[^"]+"/.test(tag)) continue
      const nome = /\sname="([^"]+)"/.exec(tag)?.[1]
      const formName = /<input\b[^>]*\bname="form-name"[^>]*\bvalue="([^"]+)"/.exec(bloco)?.[1]
      if (nome !== undefined && nome === formName) completos.add(nome)
    }
  }
  return FORMULARIOS.filter((f) => !completos.has(f))
}

const htmls = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f)
  return statSync(p).isDirectory() ? htmls(p) : f.endsWith('.html') ? [p] : []
})

export function aplicar(dist, contexto) {
  const arquivos = htmls(dist)
  if (contexto === 'production') {
    const faltas = faltasEmProducao(arquivos.map((a) => readFileSync(a, 'utf8')))
    if (faltas.length > 0) throw new Error(`produção sem formulário completo: ${faltas.join(', ')}`)
    return { contexto, desativados: 0 }
  }
  let desativados = 0
  for (const a of arquivos) {
    const original = readFileSync(a, 'utf8')
    const { html, trocas } = desativarFormularios(original)
    if (trocas > 0) { writeFileSync(a, html); desativados += 1 }
    const restos = restosDeFormulario(html)
    if (restos.length > 0) throw new Error(`formulário ainda ativo fora da produção em ${a}: ${restos.join(', ')}`)
  }
  return { contexto: contexto ?? '(ausente)', desativados }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
  const r = aplicar(dist, process.env.CONTEXT)
  console.log(r.contexto === 'production'
    ? 'Formulários: produção, os dois formulários conferidos no HTML'
    : `Formulários: contexto ${r.contexto}, desativados em ${r.desativados} página(s)`)
}
