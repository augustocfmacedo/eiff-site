import { describe, expect, it } from 'vitest'
import { FILME_EIFF, fonteUniversal, marcacaoDoFilme, type Filme } from './filme'

describe('filme · as fontes', () => {
  it('oferece AV1 antes do H.264: a ordem é a preferência', () => {
    expect(FILME_EIFF.fontes[0].src).toContain('av1')
    expect(FILME_EIFF.fontes[0].tipo).toContain('av01')
    expect(FILME_EIFF.fontes[1].src).not.toContain('av1')
  })

  it('a PRIMEIRA fonte declara codecs — sem isso a queda não acontece', () => {
    /* Com `video/mp4` puro o navegador aceita o arquivo pelo contêiner, tenta
       decodificar AV1 que não sabe ler e falha sem tentar o segundo source.
       Declarar a cadeia é o que faz o Safari antigo pular direto para o H.264. */
    expect(FILME_EIFF.fontes[0].tipo).toMatch(/codecs=/)
  })

  it('a ÚLTIMA fonte é universal: nunca pode ser AV1', () => {
    const ultima = FILME_EIFF.fontes[FILME_EIFF.fontes.length - 1]
    expect(ultima.tipo).not.toContain('av01')
    expect(fonteUniversal(FILME_EIFF)).toBe(ultima.src)
  })
})

describe('filme · a marcação do player', () => {
  const html = marcacaoDoFilme(FILME_EIFF)

  it('traz as fontes na mesma ordem da lista', () => {
    const posAv1 = html.indexOf(FILME_EIFF.fontes[0].src)
    const posH264 = html.indexOf(FILME_EIFF.fontes[1].src)
    expect(posAv1).toBeGreaterThanOrEqual(0)
    expect(posH264).toBeGreaterThan(posAv1)
  })

  it('dá controles à pessoa e não prende o iOS em tela cheia', () => {
    expect(html).toContain('controls')
    expect(html).toContain('playsinline')
  })

  it('mostra a capa antes do primeiro quadro', () => {
    expect(html).toContain(`poster="${FILME_EIFF.capa}"`)
  })

  it('deixa uma saída para quem não reproduz nada', () => {
    expect(html).toContain(fonteUniversal(FILME_EIFF))
    expect(html).toContain('download')
  })

  it('o atributo type usa aspas simples, porque a cadeia tem aspas duplas', () => {
    /* `type="video/mp4; codecs="av01...""` fecharia o atributo no meio e o
       navegador leria um tipo truncado — justamente o que quebraria a queda. */
    expect(html).toContain(`type='${FILME_EIFF.fontes[0].tipo}'`)
  })
})

describe('filme · o rótulo do analytics', () => {
  it('é curto e sem texto livre', () => {
    expect(FILME_EIFF.evento).toMatch(/^[\w-]+$/)
    expect(FILME_EIFF.evento.length).toBeLessThanOrEqual(40)
  })
})

describe('filme · a função é pura', () => {
  it('monta a partir do que recebe, não do módulo', () => {
    const outro: Filme = {
      titulo: 'Outro', capa: '/img/x.jpg', evento: 'x',
      fontes: [{ src: '/video/x.mp4', tipo: 'video/mp4' }],
    }
    const h = marcacaoDoFilme(outro)
    expect(h).toContain('/video/x.mp4')
    expect(h).not.toContain(FILME_EIFF.fontes[0].src)
  })
})
