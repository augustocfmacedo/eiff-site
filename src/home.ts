import './styles/main.css'
import { iniciarApp, reduzMovimento, temMouse } from './core/app'
import { iniciarFilme } from './home/filme'
import { iniciarHome } from './home/secoes'

const app = iniciarApp()
iniciarFilme(app, reduzMovimento)
iniciarHome(app, reduzMovimento, temMouse)

// A cena 3D entra por import dinâmico: Three.js só é baixado na Home e não
// bloqueia o preloader. O download também não começa junto com o resto: ele
// espera a entrada terminar e um intervalo livre do navegador, para não
// disputar banda com o texto do hero — que é o elemento de maior conteúdo da
// página e o que define o LCP em 4G. A cena é decoração; o título não.
const canvas = document.getElementById('heroCanvas') as HTMLCanvasElement | null
if (canvas && window.WebGLRenderingContext) {
  const ocioso = (fn: () => void) => {
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    if (ric) ric(fn, { timeout: 1500 })
    else setTimeout(fn, 300)
  }
  app.pronto.then(() => ocioso(() => {
    import('./home/hero3d')
      .then(({ iniciarHero3d }) => iniciarHero3d(canvas, app.pronto, reduzMovimento))
      .catch(() => canvas.remove())
  }))
}
