/**
 * Pós-build: transforma dist/<pagina>.html em dist/<pagina>/index.html para URLs sem extensão
 * (index.html e 404.html ficam na raiz). O Netlify serve /empresa a partir de /empresa/index.html.
 */
import { readdirSync, mkdirSync, renameSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
let n = 0
for (const f of readdirSync(dist)) {
  if (!f.endsWith('.html') || f === 'index.html' || f === '404.html') continue
  const nome = f.slice(0, -5)
  const pasta = resolve(dist, nome)
  if (!existsSync(pasta)) mkdirSync(pasta)
  renameSync(resolve(dist, f), resolve(pasta, 'index.html'))
  n++
}
console.log(`URLs limpas: ${n} páginas movidas para pastas`)
