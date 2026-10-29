/**
 * Entrada da landing do simulador.
 *
 * Propositalmente leve: não carrega GSAP, Lenis nem Three.js. Quem chega aqui
 * vem de campanha e precisa da primeira tela rápida — o movimento é só CSS.
 */

import './styles/main.css'
import './styles/simulador.css'
import { iniciarSimulador } from './simulador/tela'

const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// O head marca `is-loading` para o preloader do site; aqui não há preloader.
document.documentElement.classList.remove('is-loading')

const ano = document.getElementById('ano')
if (ano) ano.textContent = String(new Date().getFullYear())

iniciarSimulador(document, { reduzMovimento })
