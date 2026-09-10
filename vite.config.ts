import { defineConfig, type Plugin } from 'vite'
import { resolve } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'

/**
 * Partials em HTML estático: `<!-- @include nome -->` é substituído pelo conteúdo
 * de `src/partials/nome.html` em build e em dev. Mantém o HTML completo para SEO,
 * sem framework.
 */
function partials(): Plugin {
  const dir = resolve(__dirname, 'src/partials')
  const verificacao = process.env.VITE_GOOGLE_SITE_VERIFICATION
    ? `<meta name="google-site-verification" content="${process.env.VITE_GOOGLE_SITE_VERIFICATION}">`
    : ''
  const render = (html: string, depth = 0): string =>
    html.replace(/<!--\s*@analytics\s*-->/g, analytics).replace(/<!--\s*@verificacao\s*-->/g, verificacao).replace(/<!--\s*@include\s+([\w-]+)\s*-->/g, (_, nome: string) => {
      const arquivo = resolve(dir, `${nome}.html`)
      if (!existsSync(arquivo)) throw new Error(`Partial não encontrado: ${nome}`)
      const conteudo = readFileSync(arquivo, 'utf8')
      return depth < 4 ? render(conteudo, depth + 1) : conteudo
    })
  return {
    name: 'eiff-partials',
    transformIndexHtml: { order: 'pre', handler: (html) => render(html) },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(dir)) server.ws.send({ type: 'full-reload' })
    },
  }
}

const paginas = ['index', 'empresa', 'engenharia', 'fabricacao', 'solucoes', 'produtos', 'projetos', 'tecnologia', 'contato', '404']

export default defineConfig({
  plugins: [partials()],
  server: { port: 5180 },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: Object.fromEntries(paginas.map((p) => [p, resolve(__dirname, `${p}.html`)])),
      output: {
        manualChunks: { three: ['three'], gsap: ['gsap'] },
      },
    },
  },
})
