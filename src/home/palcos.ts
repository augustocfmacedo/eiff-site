/**
 * Palcos da Home: a tela fica parada e as seções se dissolvem uma na outra,
 * em vez de subirem para dentro do quadro.
 *
 * Como funciona uma seção-palco:
 *   1. ela vira `position: sticky` no topo e viaja de baixo para cima
 *      INVISÍVEL — nesse trecho quem está na tela é a seção anterior, travada
 *      e imóvel, e é esse o tempo de leitura dela;
 *   2. ao encostar no topo, ela trava;
 *   3. só então um espaçador logo abaixo dá a distância de rolagem para ela
 *      aparecer por opacidade, sobre a anterior, sem nada se mover.
 *
 * O passo 3 é o que o fluxo normal não consegue dar: para dissolver sem
 * movimento é preciso ter rolagem DEPOIS de a seção estar parada no lugar.
 * O espaçador é criado aqui, por JS, e só existe quando o efeito está ligado —
 * assim o HTML continua servindo o fluxo normal sem resíduo.
 *
 * O que NÃO vira palco, de propósito:
 *   · o Processo e a Fabricação usam a rolagem como linha do tempo (sete
 *     etapas de uma cena 3D contínua, seis estações num trilho horizontal).
 *     Elas já são tela fixa; virar um quadro só apagaria o que têm de melhor.
 *   · a Engenharia acende seis camadas de desenho conforme se passa pelos
 *     itens, e o conteúdo não cabe em uma tela (1.127 px medidos a 1440×900).
 *   · o hero tem a própria dissolução; aqui ele só ganha a saída por
 *     opacidade, para não sair deslizando.
 * Essas quatro entram por dissolução na chegada, para que nenhuma transição
 * da home seja um empurrão vertical.
 *
 * Em duas fases, e a ordem é o ponto mais delicado do arquivo:
 * `prepararPalcos` mexe no DOM e precisa rodar ANTES dos reveals, que se
 * penduram nos espaçadores; `ligarPalcos` cria os gatilhos e precisa rodar
 * DEPOIS dos pins do Processo e da Fabricação, porque cada pin insere no
 * documento o espaçador da própria rolagem — quase 6 mil px no caso do
 * Processo — e um gatilho criado antes disso mede um documento que deixa de
 * existir. Com as fases juntas, a Engenharia aparecia inteira aos 15% do
 * Processo; um `ScrollTrigger.refresh()` no fim não corrige isso.
 */
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/** Ordem importa: é a ordem do documento, e cada palco esconde o anterior. */
const PALCOS = ['manifesto', 'capacidades', 'solucoes', 'projetos', 'destaque', 'iniciar']
/** Seções que ficam no fluxo mas chegam dissolvendo, na ordem do documento. */
const CHEGADAS = ['processo', 'engenharia', 'fabricacao', 'contato']

/** Trecho final da viagem em que uma seção de fluxo aparece. */
const ENTRADA = 0.45
/**
 * Abaixo destes limites, uma seção por tela significaria cortar conteúdo ou
 * brigar com a barra de endereço do celular. Aí o fluxo normal é melhor, e é
 * honesto dizer isso em vez de forçar o efeito.
 */
const ALTURA_MINIMA = 700
const LARGURA_MINIMA = 1024
/**
 * Até quantas telas de altura uma seção ainda pode virar palco. Folgado de
 * propósito: a medida acontece antes da troca de fontes (ver prepararPalcos).
 */
const LIMITE_ALTURA = 1.4

/** Conteúdo da seção, que é o que precisa caber na tela. */
function conteudo(sec: HTMLElement) {
  return sec.querySelector<HTMLElement>(':scope > .wrap')
}

/**
 * Fase 1 — DOM: escolhe as seções que cabem em uma tela, aplica o palco e
 * cria os espaçadores. Devolve os palcos escolhidos, ou null se o efeito não
 * vale aqui. Nenhum gatilho de rolagem é criado nesta fase.
 */
export function prepararPalcos(reduzMovimento: boolean): HTMLElement[] | null {
  // Quem pediu menos movimento não quer a tela presa: o fluxo normal já
  // entrega o conteúdo inteiro, na ordem, sem depender de animação.
  if (reduzMovimento) return null
  if (window.innerHeight < ALTURA_MINIMA || window.innerWidth < LARGURA_MINIMA) return null

  const candidatos = PALCOS
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => !!el)
  if (candidatos.length < 2) return null

  // Mede COMO FICA, não como está. Sem o palco a seção tem 400 px de respiro
  // e o conteúdo não está centrado em uma tela — medir antes é medir outro
  // layout, e foi o que descartou duas seções que na verdade cabem.
  const raiz = document.documentElement
  raiz.classList.add('palcos')
  candidatos.forEach((sec) => sec.classList.add('palco'))

  // A medida aqui é só rede de segurança contra um descompasso grosseiro, e
  // de propósito: isto roda antes de as fontes trocarem, e com a fonte de
  // fallback o texto mede mais alto. Uma régua apertada reprovava seções que
  // cabem e desligava o efeito inteiro de forma intermitente — o site às
  // vezes carregava com palcos, às vezes sem. Quem passa daqui com folga
  // pequena apenas escorrega alguns pixels durante a parada, porque o palco é
  // `min-height`: ele cresce em vez de cortar.
  const palcos = candidatos.filter((sec) => {
    const wrap = conteudo(sec)
    const serve = !!wrap && wrap.scrollHeight <= window.innerHeight * LIMITE_ALTURA
    if (!serve) sec.classList.remove('palco')
    return serve
  })

  // Com menos de dois palcos não há transição para dissolver: desfaz tudo.
  if (palcos.length < 2) {
    raiz.classList.remove('palcos')
    candidatos.forEach((sec) => sec.classList.remove('palco'))
    return null
  }

  for (const sec of palcos) {
    sec.style.opacity = '0'
    const curso = document.createElement('div')
    curso.className = 'palco-curso'
    curso.setAttribute('aria-hidden', 'true')
    sec.insertAdjacentElement('afterend', curso)
  }

  return palcos
}

/**
 * Quanto as duas pontas se cruzam, em fração da janela de dissolução.
 *
 * Com a seção que sai parada em 100% enquanto a nova entra, o quadro do meio
 * vira dupla exposição: dois textos legíveis no mesmo lugar. Então uma sai
 * enquanto a outra entra, e elas se cruzam só um pouco — o suficiente para
 * não haver corte seco, pouco o bastante para nunca se lerem as duas.
 */
const CRUZAMENTO = 0.16

const trava = (x: number) => Math.max(0, Math.min(1, x))

/**
 * Liga a opacidade de `sec` e de quem está atrás a um progresso de 0 a 1 e,
 * quando a nova chega inteira, esconde a anterior — um palco travado continua
 * no topo para sempre, e seis camadas de tela cheia empilhadas custam
 * composição a cada quadro, além de deixarem texto invisível no caminho do Tab.
 */
function dissolver(sec: HTMLElement, atras: HTMLElement | null) {
  const meio = 0.5 + CRUZAMENTO
  return (p: number) => {
    sec.style.opacity = String(trava((p - (1 - meio)) / meio))
    if (!atras) return
    atras.style.opacity = String(1 - trava(p / meio))
    if (p >= 1) { atras.style.visibility = 'hidden'; atras.setAttribute('inert', '') }
    else if (p <= 0) { atras.style.visibility = ''; atras.removeAttribute('inert') }
  }
}

/**
 * Fase 2 — gatilhos. Roda depois dos pins, com o documento na altura final.
 */
export function ligarPalcos(palcos: HTMLElement[] | null) {
  if (!palcos) return

  // Uma lista só, na ordem do documento: palcos e seções de fluxo misturados.
  // Quem sai de cena é sempre a cena IMEDIATAMENTE anterior — e ela pode ser
  // das duas naturezas. Encadear só entre palcos faria a Engenharia apagar
  // Projetos, que já tinha saído atrás do Processo, em vez de apagar o
  // Processo, que é quem está de fato na tela.
  const cenas = [...palcos, ...CHEGADAS.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el)]
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))

  cenas.forEach((sec, i) => {
    const atras = i > 0 ? cenas[i - 1] : null
    const aplicar = dissolver(sec, atras)
    sec.style.opacity = '0'
    const curso = sec.nextElementSibling
    const ehPalco = curso?.classList.contains('palco-curso')

    ScrollTrigger.create(ehPalco
      // Palco: a seção já está travada no topo. O espaçador dá a rolagem da
      // dissolução, e nada se move durante ela.
      ? {
          trigger: curso as HTMLElement, start: 'top bottom', end: 'bottom bottom',
          scrub: true, invalidateOnRefresh: true,
          onUpdate: (self) => aplicar(self.progress),
          onLeaveBack: () => aplicar(0), onLeave: () => aplicar(1),
        }
      // Fluxo: dissolve no trecho final da chegada. Ela ainda se move nesse
      // trecho — translúcida, o movimento quase não se lê —, e é o preço de
      // não poder travar: duas usam a rolagem como tempo, uma não cabe.
      : {
          trigger: sec, start: 'top bottom', end: 'top top',
          scrub: true, invalidateOnRefresh: true,
          onUpdate: (self) => aplicar(trava((self.progress - (1 - ENTRADA)) / ENTRADA)),
          onLeaveBack: () => aplicar(0), onLeave: () => aplicar(1),
        })
  })

  // Hero: sai por opacidade. O 3D e as cotas já se dissolviam na rolagem, mas
  // o título e o HUD subiam junto com a página — e era exatamente essa saída
  // deslizando que começava a sensação de tudo vir de baixo.
  const hero = document.querySelector<HTMLElement>('.hero')
  const heroConteudo = hero?.querySelector<HTMLElement>('.hero__content')
  if (hero && heroConteudo) {
    gsap.to(heroConteudo, {
      opacity: 0,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom 35%', scrub: 0.3 },
    })
  }
}
