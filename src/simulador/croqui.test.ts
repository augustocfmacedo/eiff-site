import { describe, expect, it } from 'vitest'
import { MOLDURA_PADRAO, desenharPortico, type Moldura } from './croqui'

const moldura: Moldura = MOLDURA_PADRAO
const numeros = (d: string) => d.match(/-?\d+(\.\d+)?/g)!.map(Number)

describe('croqui do pórtico', () => {
  it('cumeeira = pé-direito mais a subida da água', () => {
    const c = desenharPortico({ vao: 40, peDireito: 12 }, moldura)
    expect(c.alturaCumeeira).toBe(14) // 12 + (40/2) × 10%
  })

  it('aceita outra inclinação', () => {
    expect(desenharPortico({ vao: 20, peDireito: 10, inclinacao: 5 }, moldura).alturaCumeeira).toBe(10.5)
  })

  it('mantém tudo dentro da moldura', () => {
    for (const medidas of [{ vao: 6, peDireito: 20 }, { vao: 60, peDireito: 3 }, { vao: 25, peDireito: 8 }]) {
      const c = desenharPortico(medidas, moldura)
      for (const [nome, d] of Object.entries({ pilares: c.pilares, cobertura: c.cobertura, banzo: c.banzo })) {
        for (const n of numeros(d)) {
          expect(n, `${nome} em ${JSON.stringify(medidas)}`).toBeGreaterThanOrEqual(0)
          expect(n, `${nome} em ${JSON.stringify(medidas)}`).toBeLessThanOrEqual(Math.max(moldura.largura, moldura.altura))
        }
      }
    }
  })

  it('preserva a proporção: galpão mais largo desenha mais largo', () => {
    // A cota do vão vai de 'M x1' até 'H x2': a distância entre eles é a largura desenhada.
    const larguraDe = (vao: number) => {
      const d = desenharPortico({ vao, peDireito: 8 }, moldura).cotaVao.caminho
      const x1 = Number(d.match(/^M (-?[\d.]+)/)![1])
      const x2 = Number(d.match(/H (-?[\d.]+)/)![1])
      return x2 - x1
    }
    expect(larguraDe(50)).toBeGreaterThan(larguraDe(10))
    expect(larguraDe(10)).toBeGreaterThan(0)
  })

  it('não quebra com medida degenerada', () => {
    const c = desenharPortico({ vao: 0, peDireito: 0 }, moldura)
    expect(numeros(c.pilares).every(Number.isFinite)).toBe(true)
  })

  it('a treliça acompanha as divisões da cobertura', () => {
    const c = desenharPortico({ vao: 30, peDireito: 9 }, moldura)
    expect(c.trelica.match(/M /g)).toHaveLength(6) // 3 divisões × 2 águas
  })
})
