import './styles/main.css'
import { iniciarApp, reduzMovimento, temMouse } from './core/app'
import { iniciarFilme } from './home/filme'
import { iniciarHome } from './home/secoes'

const app = iniciarApp()
iniciarFilme(app, reduzMovimento)
iniciarHome(app, reduzMovimento, temMouse)

// A cena 3D entra por import dinâmico: Three.js só é baixado na Home e não bloqueia o preloader.
const canvas = document.getElementById('heroCanvas') as HTMLCanvasElement | null
if (canvas && window.WebGLRenderingContext) {
  import('./home/hero3d').then(({ iniciarHero3d }) => iniciarHero3d(canvas, app.pronto, reduzMovimento)).catch(() => canvas.remove())
}
