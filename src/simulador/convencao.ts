/**
 * CONVENÇÃO GEOMÉTRICA DE REPRESENTAÇÃO — a única fonte das três figuras do simulador.
 *
 * O croqui em corte, a ilustração «Volume» e o modelo 3D desenham o MESMO galpão.
 * Tudo o que eles precisam presumir para desenhar está aqui, e em nenhum outro
 * lugar: quem mudar um número muda as três figuras juntas.
 *
 * NADA DISTO É ENGENHARIA. A inclinação é ilustrativa (aprovada pela Direção em
 * 26/11/2026 como convenção de desenho: 10 % em todas as representações) e as
 * seções são proporções de desenho. Nenhuma foi dimensionada nem verificada, e a
 * inclinação e os perfis reais são definidos pela engenharia.
 *
 * As medidas e onde ficam:
 *  - vão livre ............ entre as faces INTERNAS dos pilares. É o campo «vão».
 *                           A espessura ilustrativa do pilar cresce para FORA dele.
 *  - pé-direito ........... da base à linha inferior da viga, junto à face interna
 *                           do pilar. É o campo «pé-direito».
 *  - linha de referência .. a linha inferior da viga: sobe do pé-direito, na face
 *                           interna, até a cumeeira, com a inclinação de representação.
 *  - altura de referência
 *    na cumeeira .......... pé-direito + meio vão × inclinação. É a «Altura total»
 *                           do painel. Não inclui a viga nem a cobertura.
 *
 * Módulo puro: sem DOM, sem three.js, sem rede.
 */

/** Inclinação ilustrativa da cobertura: subida ÷ MEIO vão. Convenção de desenho, não dado de projeto. */
export const INCLINACAO_DE_REPRESENTACAO = 0.10

/** Altura de seção desenhada, em metros, para vãos grandes. Proporção de desenho; não é perfil. */
export const H_PILAR = 0.85
export const H_VIGA = 0.7
export const H_MISULA = 1.75
/** Teto da seção desenhada, como fração do vão: em vão pequeno a figura não pode engordar. */
export const ESPESSURA_MAX = 0.035
/** Comprimento da mísula, como fração do meio vão. */
export const MISULA_FRACAO = 0.22

/** Quanto a linha de referência sobe do pé-direito até a cumeeira, em metros. */
export function subidaDaCumeeira(vao: number, inclinacao: number = INCLINACAO_DE_REPRESENTACAO): number {
  return (vao / 2) * inclinacao
}

/** Altura da linha de referência na cumeeira: a «Altura total» do painel. */
export function alturaDeReferencia(peDireito: number, vao: number, inclinacao: number = INCLINACAO_DE_REPRESENTACAO): number {
  return peDireito + subidaDaCumeeira(vao, inclinacao)
}

/**
 * A «Altura total» COMO É MOSTRADA: a altura de referência arredondada a uma casa decimal.
 * É a única regra de arredondamento desse número. O painel, o croqui e o texto das hipóteses do 3D mostram
 * o que esta função devolve, formatado por `formatarMedida`: nunca cada um com a sua conta.
 */
export function alturaTotalExibida(peDireito: number, vao: number, inclinacao: number = INCLINACAO_DE_REPRESENTACAO): number {
  return Math.round(alturaDeReferencia(peDireito, vao, inclinacao) * 10) / 10
}

export interface SecoesDeDesenho {
  /** Altura da seção desenhada do pilar, da viga e da mísula no joelho, em metros. */
  pilar: number
  viga: number
  misula: number
  /** Comprimento da mísula, na horizontal, a partir da face interna do pilar. */
  comprimentoDaMisula: number
}

/** Seções ILUSTRATIVAS para um vão. As mesmas no croqui e no 3D. */
export function secoesDeDesenho(vao: number): SecoesDeDesenho {
  const pilar = Math.min(H_PILAR, vao * ESPESSURA_MAX)
  return {
    pilar,
    viga: pilar * (H_VIGA / H_PILAR),
    misula: pilar * (H_MISULA / H_PILAR),
    comprimentoDaMisula: (vao / 2) * MISULA_FRACAO,
  }
}
