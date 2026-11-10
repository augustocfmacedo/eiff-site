/**
 * O filme institucional da EIFF, hospedado no próprio site.
 *
 * ── POR QUE AQUI E NÃO NO YOUTUBE ────────────────────────────────────────
 *
 * Decisão de produto: o filme fica em eiff.com.br, sem marca de terceiro e
 * sem iframe externo. O preço disso é peso — e o peso só é aceitável porque
 * o filme abre num lightbox POR CLIQUE. Quem não clica baixa apenas a capa.
 * Por isso nada aqui é inserido na página antes do clique, e por isso o
 * `<video>` nasce e morre dentro do lightbox.
 *
 * ── DUAS FONTES, NESTA ORDEM ─────────────────────────────────────────────
 *
 * O filme é quase todo degradê escuro, que é o pior caso para H.264: o
 * arquivo incha e, quando se comprime para valer, aparece banding — faixas
 * nos fundos, justamente o que faz a peça parecer cara.
 *
 * AV1 resolve os dois lados. Com síntese de grão (`film-grain`), o grão do
 * original é removido antes de comprimir (é ele que custa os bits) e
 * recriado na reprodução, onde funciona como dither e esconde o banding.
 * Mesma leitura, um terço do tamanho.
 *
 * O H.264 continua ali porque o Safari só decodifica AV1 com hardware
 * (iPhone 15 Pro em diante): sem o segundo `<source>`, todo iPhone anterior
 * ficaria sem filme. Ele vem em 720p de propósito — é fallback de celular,
 * não a versão principal.
 *
 * O `codecs=` do primeiro `<source>` NÃO é decoração: sem ele o navegador
 * aceita o arquivo pelo contêiner (`video/mp4`), tenta decodificar AV1 que
 * não sabe ler e falha sem cair no segundo. Se a cadeia estiver errada, o
 * navegador apenas pula o AV1 e usa o H.264 — degrada, não quebra.
 */

export interface FonteDeVideo {
  src: string
  /** Contêiner e cadeia de codec. É o que faz o navegador escolher. */
  tipo: string
}

export interface Filme {
  /** Vai no `aria-label` do diálogo e do vídeo. */
  titulo: string
  capa: string
  /** Em ordem de preferência: a primeira que o navegador souber ler vence. */
  fontes: readonly FonteDeVideo[]
  /** Rótulo curto do analytics. Nunca texto livre. */
  evento: string
}

export const FILME_EIFF: Filme = Object.freeze({
  titulo: 'Filme institucional da EIFF',
  capa: '/img/capa-filme.jpg',
  fontes: Object.freeze([
    { src: '/video/filme-eiff.av1.mp4', tipo: 'video/mp4; codecs="av01.0.08M.08"' },
    { src: '/video/filme-eiff.mp4', tipo: 'video/mp4; codecs="avc1.640028"' },
  ]),
  evento: 'filme-institucional',
}) as Filme

/** A última fonte é a universal: é ela que vale como link de queda. */
export function fonteUniversal(f: Filme): string {
  return f.fontes[f.fontes.length - 1].src
}

/**
 * A marcação do player. Função pura: o lightbox só a injeta.
 *
 * `autoplay` é legítimo aqui porque só existe depois de um clique da pessoa —
 * é a reprodução que ela pediu, não vídeo que começa sozinho ao abrir a
 * página. `playsinline` impede o iOS de jogar em tela cheia sem ser pedido.
 */
export function marcacaoDoFilme(f: Filme): string {
  const fontes = f.fontes.map((o) => `<source src="${o.src}" type='${o.tipo}'>`).join('')
  return `<video class="lightbox__video" controls autoplay playsinline preload="auto"`
    + ` poster="${f.capa}" aria-label="${f.titulo}">${fontes}`
    + `<p class="lightbox__sem">Seu navegador não reproduz este vídeo.`
    + ` <a href="${fonteUniversal(f)}" download>Baixar o filme</a>.</p></video>`
}
