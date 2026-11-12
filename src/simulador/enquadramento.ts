/**
 * ENQUADRAMENTO COMERCIAL da solicitação — só regras de escopo, sem cálculo.
 *
 * Responde a uma pergunta de atendimento: este pedido tende a seguir pelo
 * estudo padronizado, ou precisa de atendimento técnico dedicado? Usa
 * exclusivamente as regras de `RegrasDeEscopo`, que são um documento
 * versionado: faixas de dimensão, usos e tipologias. Não chama serviço de
 * engenharia, não roda verificação e não devolve nenhuma grandeza estrutural.
 *
 * ENQUADRAR NÃO É APROVAR. «Dentro do escopo padronizado» quer dizer que o
 * pedido cabe no tipo de estudo que a EIFF faz de forma padronizada. Não quer
 * dizer que a estrutura foi verificada, que é viável ou que tem preço. A
 * aptidão para processamento estrutural segue NÃO DETERMINADA, e isso está no
 * tipo do resultado.
 *
 * O resultado é feito só de CÓDIGOS E NÚMEROS — nenhuma frase. Quem escreve a
 * frase é `fraseDoMotivo`, a partir do código. Assim o objeto que vai à tela
 * pode ser conferido por estrutura (campos, tipos, listas fechadas), e não por
 * busca de palavras.
 *
 * LINGUAGEM CONDICIONAL: enquanto as regras forem PROVISORIAS (sem aprovação
 * da Direção), toda frase sai como indicação preliminar — «em princípio»,
 * «tende a». Só regras APROVADAS falam no afirmativo.
 *
 * TIPOLOGIAS: a lista abaixo é a parte que um visitante sabe responder. Itens
 * de natureza técnica (tipo de base do pórtico, tipo de perfil) não são
 * perguntados aqui: são definidos pela engenharia.
 */

import { validarConfiguracao, type ConfiguracaoGalpao } from './parametros'

export interface Faixa { min: number; max: number }

export interface Tipologia {
  id: string
  /** A pergunta como o visitante a lê. */
  rotulo: string
}

export interface RegrasDeEscopo {
  versao: string
  /** PROVISORIA enquanto a Direção não aprovar as regras como promessa comercial. */
  situacao: 'PROVISORIA' | 'APROVADA'
  fonte: string
  /** Em metros. */
  faixas: { vao: Faixa; comprimento: Faixa; peDireito: Faixa }
  usosPadronizados: readonly string[]
  /** Tipologias que tiram o pedido do estudo padronizado. Lista fechada. */
  tipologiasForaDoPadrao: readonly Tipologia[]
}

export const ESCOPO_PADRONIZADO: RegrasDeEscopo = Object.freeze({
  versao: 'escopo-padronizado-0',
  situacao: 'PROVISORIA',
  fonte: 'limites de escopo provisórios; aguardam aprovação da Direção',
  faixas: Object.freeze({
    vao: Object.freeze({ min: 10, max: 35 }),
    comprimento: Object.freeze({ min: 10, max: 200 }),
    peDireito: Object.freeze({ min: 4, max: 12 }),
  }),
  usosPadronizados: Object.freeze(['industrial', 'logistico', 'comercial', 'agro']),
  tipologiasForaDoPadrao: Object.freeze([
    { id: 'mezanino', rotulo: 'Mezanino ou piso intermediário' },
    { id: 'ponte-rolante', rotulo: 'Ponte rolante ou carga suspensa na estrutura' },
    { id: 'cobertura-diferente', rotulo: 'Cobertura que não seja de duas águas (uma água, shed, arco)' },
    { id: 'geminado', rotulo: 'Dois ou mais galpões geminados' },
    { id: 'grandes-aberturas', rotulo: 'Grandes aberturas ou um lado inteiro sem fechamento' },
  ]),
}) as RegrasDeEscopo

/** O que o visitante declara sobre a tipologia. `null` = ainda não declarou nada. */
export interface DeclaracaoDeTipologia {
  itens: readonly string[]
  nenhumaDasAnteriores: boolean
}

export const CLASSES = [
  'CONFIGURACAO_INCOMPLETA', 'TIPOLOGIA_NAO_DECLARADA', 'TIPOLOGIA_NAO_SUPORTADA',
  'FORA_DO_ESCOPO_AUTOMATIZADO', 'DENTRO_DO_ESCOPO_PADRONIZADO', 'ENQUADRAMENTO_INDISPONIVEL',
] as const
export type Classe = (typeof CLASSES)[number]

export const ENCAMINHAMENTOS = ['CORRIGIR_CONFIGURACAO', 'DECLARAR_TIPOLOGIA', 'ATENDIMENTO_TECNICO', 'ESTUDO_PADRONIZADO', 'INDISPONIVEL'] as const
export type Encaminhamento = (typeof ENCAMINHAMENTOS)[number]

export const SITUACOES_DAS_REGRAS = ['PROVISORIA', 'APROVADA', 'INDISPONIVEL'] as const
export type SituacaoDasRegras = (typeof SITUACOES_DAS_REGRAS)[number]

/** As regras que podem produzir um motivo. Lista fechada. */
export const REGRAS = [
  'configurador', 'tipologia.nao-declarada', 'tipologia.contraditoria', 'tipologia.item', 'tipologia.desconhecida',
  'uso', 'faixa', 'regras.ilegiveis',
] as const
export type Regra = (typeof REGRAS)[number]

export const CAMPOS_DA_CONFIGURACAO = ['uso', 'vao', 'comprimento', 'peDireito', 'cidade', 'cobertura', 'fechamento'] as const
export type CampoDaConfiguracao = (typeof CAMPOS_DA_CONFIGURACAO)[number]
export const CAMPOS_COM_FAIXA = ['vao', 'comprimento', 'peDireito'] as const
export type CampoComFaixa = (typeof CAMPOS_COM_FAIXA)[number]

/** Um motivo é um CÓDIGO com os dados dele. Sem texto. */
export interface Motivo {
  regra: Regra
  /** Para `configurador` e `faixa`. */
  campo?: CampoDaConfiguracao
  /** Para `faixa`: o valor informado e a faixa da regra, em metros. */
  informado?: number
  min?: number
  max?: number
  /** Para `tipologia.item`: o identificador declarado. */
  tipologia?: string
}

export interface Enquadramento {
  versaoDasRegras: string
  situacaoDasRegras: SituacaoDasRegras
  /** Leitura 1: o preenchimento é válido pelas regras do configurador? Independente das demais. */
  configuracaoComercialValida: boolean
  camposComErro: CampoDaConfiguracao[]
  classe: Classe
  motivos: Motivo[]
  encaminhamento: Encaminhamento
  /** Literal no tipo: nenhum caminho deste módulo aprova estrutura. */
  aprovacaoEstrutural: false
  /** Literal no tipo: o enquadramento não determina aptidão para processamento. */
  aptidaoParaProcessamentoEstrutural: 'NAO_DETERMINADA'
}

const numero = (n: number) => String(n).replace('.', ',')
const faixaValida = (f: Faixa | undefined): f is Faixa =>
  !!f && Number.isFinite(f.min) && Number.isFinite(f.max) && f.min < f.max
export const IDENTIFICADOR = /^[a-z0-9][a-z0-9.-]{0,39}$/

/** As regras têm a forma esperada? Regras ilegíveis não enquadram nada. */
export function regrasLegiveis(r: unknown): r is RegrasDeEscopo {
  const x = r as Partial<RegrasDeEscopo> | null
  return !!x && typeof x.versao === 'string' && IDENTIFICADOR.test(x.versao)
    && (x.situacao === 'PROVISORIA' || x.situacao === 'APROVADA')
    && !!x.faixas && faixaValida(x.faixas.vao) && faixaValida(x.faixas.comprimento) && faixaValida(x.faixas.peDireito)
    && Array.isArray(x.usosPadronizados) && Array.isArray(x.tipologiasForaDoPadrao)
    && x.tipologiasForaDoPadrao.every((t) => typeof t?.id === 'string' && IDENTIFICADOR.test(t.id) && typeof t?.rotulo === 'string')
}

export function enquadrar(
  c: ConfiguracaoGalpao,
  declaracao: DeclaracaoDeTipologia | null,
  regras: RegrasDeEscopo | null | undefined = ESCOPO_PADRONIZADO,
): Enquadramento {
  const erros = validarConfiguracao(c)
  const camposComErro = erros.map((e) => e.campo).filter((x): x is CampoDaConfiguracao => (CAMPOS_DA_CONFIGURACAO as readonly string[]).includes(x as string))
  const base = { configuracaoComercialValida: erros.length === 0, camposComErro, aprovacaoEstrutural: false as const, aptidaoParaProcessamentoEstrutural: 'NAO_DETERMINADA' as const }

  if (!regrasLegiveis(regras)) {
    return { ...base, versaoDasRegras: 'indisponivel', situacaoDasRegras: 'INDISPONIVEL', classe: 'ENQUADRAMENTO_INDISPONIVEL', encaminhamento: 'INDISPONIVEL', motivos: [{ regra: 'regras.ilegiveis' }] }
  }
  const cabecalho = { ...base, versaoDasRegras: regras.versao, situacaoDasRegras: regras.situacao }

  if (erros.length > 0) {
    return { ...cabecalho, classe: 'CONFIGURACAO_INCOMPLETA', encaminhamento: 'CORRIGIR_CONFIGURACAO', motivos: camposComErro.map((campo) => ({ regra: 'configurador' as const, campo })) }
  }

  const itens = declaracao?.itens ?? []
  if (declaracao === null || (itens.length === 0 && !declaracao.nenhumaDasAnteriores)) {
    return { ...cabecalho, classe: 'TIPOLOGIA_NAO_DECLARADA', encaminhamento: 'DECLARAR_TIPOLOGIA', motivos: [{ regra: 'tipologia.nao-declarada' }] }
  }
  if (itens.length > 0 && declaracao.nenhumaDasAnteriores) {
    return { ...cabecalho, classe: 'TIPOLOGIA_NAO_DECLARADA', encaminhamento: 'DECLARAR_TIPOLOGIA', motivos: [{ regra: 'tipologia.contraditoria' }] }
  }

  const motivos: Motivo[] = []
  for (const id of itens) {
    motivos.push(regras.tipologiasForaDoPadrao.some((x) => x.id === id) ? { regra: 'tipologia.item', tipologia: id } : { regra: 'tipologia.desconhecida' })
  }
  const tipologia = motivos.length > 0

  if (!regras.usosPadronizados.includes(String(c.uso))) motivos.push({ regra: 'uso' })
  for (const campo of CAMPOS_COM_FAIXA) {
    const v = c[campo] as number
    const f = regras.faixas[campo]
    if (v < f.min || v > f.max) motivos.push({ regra: 'faixa', campo, informado: v, min: f.min, max: f.max })
  }

  if (tipologia) return { ...cabecalho, classe: 'TIPOLOGIA_NAO_SUPORTADA', encaminhamento: 'ATENDIMENTO_TECNICO', motivos }
  if (motivos.length > 0) return { ...cabecalho, classe: 'FORA_DO_ESCOPO_AUTOMATIZADO', encaminhamento: 'ATENDIMENTO_TECNICO', motivos }
  return { ...cabecalho, classe: 'DENTRO_DO_ESCOPO_PADRONIZADO', encaminhamento: 'ESTUDO_PADRONIZADO', motivos: [] }
}

/* ---------------------------------------------------------------- Texto, a partir dos códigos */

const ROTULO_DO_CAMPO: Record<CampoComFaixa, string> = { vao: 'Vão livre', comprimento: 'Comprimento', peDireito: 'Pé-direito' }

/** Regras provisórias falam no condicional; aprovadas, no afirmativo. */
export const ehProvisorio = (s: SituacaoDasRegras): boolean => s !== 'APROVADA'

const TITULO: Record<Classe, { afirmativo: string; condicional: string }> = {
  CONFIGURACAO_INCOMPLETA: { afirmativo: 'Configuração incompleta', condicional: 'Configuração incompleta' },
  TIPOLOGIA_NAO_DECLARADA: { afirmativo: 'Tipologia ainda não declarada', condicional: 'Tipologia ainda não declarada' },
  TIPOLOGIA_NAO_SUPORTADA: { afirmativo: 'Tipologia fora do estudo padronizado', condicional: 'Indicação preliminar: a tipologia tende a ficar fora do estudo padronizado' },
  FORA_DO_ESCOPO_AUTOMATIZADO: { afirmativo: 'Fora do escopo automatizado', condicional: 'Indicação preliminar: tende a ficar fora do escopo automatizado' },
  DENTRO_DO_ESCOPO_PADRONIZADO: { afirmativo: 'Dentro do escopo de estudo padronizado', condicional: 'Indicação preliminar: tende a caber no estudo padronizado' },
  ENQUADRAMENTO_INDISPONIVEL: { afirmativo: 'Enquadramento indisponível', condicional: 'Enquadramento indisponível' },
}
export const tituloDaClasse = (c: Classe, s: SituacaoDasRegras): string => TITULO[c][ehProvisorio(s) ? 'condicional' : 'afirmativo']

/**
 * A frase de um motivo. `mensagens` traz o texto do configurador para os
 * campos com erro (vem da validação pública, não deste módulo).
 */
export function fraseDoMotivo(
  m: Motivo, situacao: SituacaoDasRegras, regras: RegrasDeEscopo | null | undefined, mensagens: Readonly<Record<string, string>> = {},
): string {
  const cond = ehProvisorio(situacao)
  switch (m.regra) {
    case 'configurador': return mensagens[m.campo ?? ''] ?? 'Há um campo a preencher ou corrigir.'
    case 'tipologia.nao-declarada': return 'Falta dizer se o galpão tem alguma das características listadas, ou marcar «nenhuma das anteriores». Sem essa declaração não há enquadramento.'
    case 'tipologia.contraditoria': return 'A declaração se contradiz: há característica marcada junto com «nenhuma das anteriores».'
    case 'tipologia.item': {
      const rotulo = regras?.tipologiasForaDoPadrao?.find((t) => t.id === m.tipologia)?.rotulo ?? 'Característica declarada'
      return cond ? `${rotulo}: em princípio, fica fora do estudo padronizado.` : `${rotulo}: fica fora do estudo padronizado.`
    }
    case 'tipologia.desconhecida': return 'Foi declarada uma característica que não está na lista desta versão das regras.'
    case 'uso': return cond ? 'Este uso, em princípio, não segue pelo estudo padronizado: tende a ser avaliado caso a caso.' : 'Este uso não segue pelo estudo padronizado: é avaliado caso a caso.'
    case 'faixa': {
      const campo = m.campo as CampoComFaixa
      return `${ROTULO_DO_CAMPO[campo] ?? 'Dimensão'} de ${numero(m.informado ?? Number.NaN)} m: ${cond ? 'em princípio, ' : ''}o estudo padronizado cobre de ${numero(m.min ?? Number.NaN)} a ${numero(m.max ?? Number.NaN)} m.`
    }
    case 'regras.ilegiveis': return 'As regras de escopo não puderam ser lidas. Sem elas não há enquadramento.'
  }
}
