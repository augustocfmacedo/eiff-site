/**
 * Pós-build (P1 — isolamento de produção e preview): fora da PRODUÇÃO, nenhum formulário do site existe.
 *
 * Por que no build e não na função de evento:
 *   - os formulários do Netlify são do SITE INTEIRO, não do deploy: uma submissão feita numa URL de preview
 *     entra na mesma lista da produção, e o evento `submission-created` roda no deploy PUBLICADO, com
 *     contexto de produção. Dentro da função não existe dado confiável que diga de onde a submissão veio
 *     (só o `referrer`, que é do navegador);
 *   - o último deploy de QUALQUER contexto atualiza a definição dos formulários do site. Um preview com
 *     formulário mexe na definição da produção.
 * Então o preview simplesmente não tem formulário: sem `data-netlify`, sem honeypot e sem o campo oculto
 * `form-name`. O envio pela tela (o `fetch('/')` do site manda os campos do próprio form) chega sem
 * `form-name`, e o Netlify não o trata como submissão.
 *
 * `CONTEXT` é variável de BUILD documentada do Netlify (production, deploy-preview, branch-deploy, dev).
 * Fail-closed: qualquer valor que não seja exatamente `production` — inclusive ausente, como num build
 * local — desativa os formulários. Consequência que vale saber: produção se publica pelo build do Git;
 * um `dist` gerado à mão e enviado com `netlify deploy --prod` sai SEM formulário (o smoke de publicação
 * confere `form-name` no ar).
 *
 * Em produção o script não muda nada e confere que os dois formulários estão no HTML: se faltarem, o
 * build falha e o deploy no ar continua servindo — melhor do que publicar um site que não capta lead.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const FORMULARIOS = Object.freeze(['iniciar-projeto', 'simular-galpao'])
export const AVISO = 'Ambiente de teste: este formulário não envia nada. Os formulários só funcionam em eiff.com.br.'

/** Desativa os formulários Netlify de UMA página. Pura: texto entra, texto sai. */
export function desativarFormularios(html) {
  let trocas = 0
  let saida = html.replace(/<form\b[^>]*\bdata-netlify="true"[^>]*>/g, (tag) => {
    trocas += 1
    const limpa = tag
      .replace(/\s+data-netlify="true"/, '')
      .replace(/\s+netlify-honeypot="[^"]*"/, '')
      .replace(/<form\b/, '<form data-formulario-desativado="nao-produtivo"')
    return `${limpa}<p class="aviso-ambiente" role="note" style="padding:.75rem 1rem;border:1px solid currentColor;margin:0 0 1rem">${AVISO}</p>`
  })
  saida = saida.replace(/<input\b[^>]*\bname="form-name"[^>]*>/g, () => { trocas += 1; return '' })
  return { html: saida, trocas }
}

/** O que sobrar de formulário Netlify numa página desativada é erro. */
export function restosDeFormulario(html) {
  const restos = []
  if (/\bdata-netlify\s*=/.test(html)) restos.push('data-netlify')
  if (/\bnetlify-honeypot\s*=/.test(html)) restos.push('netlify-honeypot')
  if (/\bname="form-name"/.test(html)) restos.push('form-name')
  if (/<form\b[^>]*\bnetlify\b/.test(html)) restos.push('atributo netlify')
  return restos
}

/** Em produção: cada formulário aceito pelo CRM está declarado e com o `form-name` certo. */
export function faltasEmProducao(paginas) {
  const todo = paginas.join('\n')
  // Ordem dos atributos não importa: lê o `name` de cada <form> que tem data-netlify="true".
  const declarados = new Set([...todo.matchAll(/<form\b[^>]*>/g)].map((m) => m[0])
    .filter((tag) => /\sdata-netlify="true"/.test(tag))
    .map((tag) => /\sname="([^"]+)"/.exec(tag)?.[1]))
  const comFormName = new Set([...todo.matchAll(/<input\b[^>]*\bname="form-name"[^>]*>/g)]
    .map((m) => /\svalue="([^"]+)"/.exec(m[0])?.[1]))
  return FORMULARIOS.filter((f) => !declarados.has(f) || !comFormName.has(f))
}

const htmls = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f)
  return statSync(p).isDirectory() ? htmls(p) : f.endsWith('.html') ? [p] : []
})

export function aplicar(dist, contexto) {
  const arquivos = htmls(dist)
  if (contexto === 'production') {
    const faltas = faltasEmProducao(arquivos.map((a) => readFileSync(a, 'utf8')))
    if (faltas.length > 0) throw new Error(`produção sem formulário: ${faltas.join(', ')}`)
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
