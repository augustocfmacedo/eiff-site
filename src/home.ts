import './styles/main.css'
import { iniciarApp, reduzMovimento, temMouse } from './core/app'
import { iniciarFilme } from './home/filme'
import { iniciarHome } from './home/secoes'

const app = iniciarApp()
iniciarFilme(app, reduzMovimento)
const hud = iniciarHome(app, reduzMovimento, temMouse)

// A cena 3D entra por import dinâmico: Three.js só é baixado na Home e não
// bloqueia o preloader. O download também não começa junto com o resto: ele
// espera a entrada terminar e um intervalo livre do navegador, para não
// disputar banda com o texto do hero — que é o elemento de maior conteúdo da
// página e o que define o LCP em 4G. A cena é decoração; o título não.
const canvas = document.getElementById('heroCanvas') as HTMLCanvasElement | null
if (canvas && window.WebGLRenderingContext) {
  // requestIdleCallback com rede de segurança: em aba oculta ou janela coberta
  // ele pode não disparar nunca, e aí a cena simplesmente não existiria. O
  // temporizador garante a carga; o que vier primeiro vale, e só uma vez.
  const ocioso = (fn: () => void) => {
    let feito = false
    const uma = () => { if (feito) return; feito = true; fn() }
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    if (ric) ric(uma, { timeout: 1500 })
    setTimeout(uma, 1600)
  }
  app.pronto.then(() => ocioso(() => {
    import('./home/hero3d')
      .then(({ iniciarHero3d }) => iniciarHero3d(canvas, app.pronto, reduzMovimento, hud))
      .catch(() => canvas.remove())
  }))
}
