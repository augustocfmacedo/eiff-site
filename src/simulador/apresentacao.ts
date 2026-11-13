/**
 * OBJETO PÚBLICO DE APRESENTAÇÃO da jornada comercial — e a conferência dele.
 *
 * É tudo o que a tela comercial usa: a configuração que o visitante digitou, a
 * declaração de tipologia, o enquadramento (em códigos) e o próximo passo.
 * Nada mais. Os textos da tela são escritos a partir desses códigos; o objeto
 * não carrega frase nenhuma.
 *
 * DUAS CAMADAS de proteção contra dado de engenharia:
 *
 *  1. POR CONSTRUÇÃO: `montarApresentacaoPublica` recebe só a configuração, a
 *     declaração e as regras de escopo. Não existe parâmetro por onde entre uma
 *     resposta de cálculo. A configuração é copiada campo a campo, de uma lista
 *     fechada, e cada valor é conferido contra o catálogo ou o tipo dele.
 *
 *  2. POR ESTRUTURA: `violacoesDaApresentacao` confere o objeto pronto contra o
 *     esquema — chaves permitidas em cada nível, tipo de cada campo, valores de
 *     lista fechada. Chave que o esquema não prevê é violação, seja qual for o
 *     nome. Não há busca de palavras.
 *
 * O único texto livre do objeto é a CIDADE, que é do visitante. Ela é aceita
 * como ele escreveu (aparada, sem caractere de controle, com limite de
 * tamanho): nome de cidade nenhum é recusado pelo conteúdo.
 */

import { COBERTURAS, FECHAMENTOS, USOS, areaCoberta, formatarArea, formatarMedida, nomeOpcao, resumoConfiguracao, type ConfiguracaoGalpao } from './parametros'
import {
  CAMPOS_DA_CONFIGURACAO, CLASSES, ENCAMINHAMENTOS, ESCOPO_PADRONIZADO, IDENTIFICADOR, REGRAS, SITUACOES_DAS_REGRAS, enquadrar,
  type DeclaracaoDeTipologia, type Encaminhamento, type Enquadramento, type RegrasDeEscopo,
} from './enquadramento'

export const VERSAO_DA_APRESENTACAO = 'apresentacao-comercial-1' as const

/** Os únicos campos da configuração que chegam ao objeto público. */
export const CAMPOS_PUBLICOS = CAMPOS_DA_CONFIGURACAO
export type CampoPublico = (typeof CAMPOS_PUBLICOS)[number]
export type ConfiguracaoPublica = Pick<ConfiguracaoGalpao, CampoPublico>

export const TAMANHO_MAXIMO_DA_CIDADE = 120
export const MAXIMO_DE_TIPOLOGIAS = 20

export interface ProximoPasso {
  encaminhamento: Encaminhamento
  /** Só verdadeiro quando o resumo está pronto para seguir pelo fluxo de contato que já existe. */
  prontoParaEncaminhar: boolean
}

export interface ApresentacaoPublica {
  versao: typeof VERSAO_DA_APRESENTACAO
  configuracao: ConfiguracaoPublica
  declaracao: DeclaracaoDeTipologia | null
  enquadramento: Enquadramento
  proximoPasso: ProximoPasso
}

export type Entrega = { ok: true; apresentacao: ApresentacaoPublica } | { ok: false; violacoes: string[] }

/* ---------------------------------------------------------------- Saneamento da entrada */

const doCatalogo = (catalogo: readonly { id: string }[], v: unknown): string | undefined =>
  typeof v === 'string' && catalogo.some((o) => o.id === v) ? v : undefined
const finito = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
// Caracteres de controle saem; o resto do texto do visitante fica como ele escreveu.
// eslint-disable-next-line no-control-regex
const CONTROLE = /[\u0000-\u001f\u007f]/g
// eslint-disable-next-line no-control-regex
const TEM_CONTROLE = /[\u0000-\u001f\u007f]/
export const limparCidade = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined
  const t = v.replace(CONTROLE, ' ').replace(/\s+/g, ' ').trim().slice(0, TAMANHO_MAXIMO_DA_CIDADE)
  return t === '' ? undefined : t
}

/** Copia campo a campo, da lista fechada. Valor fora do catálogo ou do tipo é tratado como não informado. */
function configuracaoPublica(c: ConfiguracaoGalpao): ConfiguracaoPublica {
  const saida: Record<string, unknown> = {
    uso: doCatalogo(USOS, c.uso),
    vao: finito(c.vao),
    comprimento: finito(c.comprimento),
    peDireito: finito(c.peDireito),
    cidade: limparCidade(c.cidade),
    cobertura: doCatalogo(COBERTURAS, c.cobertura),
    fechamento: doCatalogo(FECHAMENTOS, c.fechamento),
  }
  for (const k of Object.keys(saida)) if (saida[k] === undefined) delete saida[k]
  return saida as ConfiguracaoPublica
}

function declaracaoPublica(d: DeclaracaoDeTipologia | null): DeclaracaoDeTipologia | null {
  if (d === null || typeof d !== 'object') return null
  const itens = (Array.isArray(d.itens) ? d.itens : []).filter((x): x is string => typeof x === 'string').slice(0, MAXIMO_DE_TIPOLOGIAS)
  return { itens, nenhumaDasAnteriores: d.nenhumaDasAnteriores === true }
}

/* ---------------------------------------------------------------- Conferência por estrutura */

type Regra = (v: unknown, onde: string, achados: string[]) => void
const objeto = (campos: Record<string, { regra: Regra; opcional?: boolean }>): Regra => (v, onde, achados) => {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) { achados.push(`${onde}: esperado objeto`); return }
  const o = v as Record<string, unknown>
  for (const k of Object.keys(o)) if (!(k in campos)) achados.push(`${onde}.${k}: campo não previsto no esquema`)
  for (const [k, { regra, opcional }] of Object.entries(campos)) {
    if (o[k] === undefined) { if (!opcional) achados.push(`${onde}.${k}: campo obrigatório ausente`); continue }
    regra(o[k], `${onde}.${k}`, achados)
  }
}
const umDe = (lista: readonly unknown[]): Regra => (v, onde, achados) => { if (!lista.includes(v)) achados.push(`${onde}: valor fora da lista fechada`) }
const literal = (esperado: unknown): Regra => (v, onde, achados) => { if (v !== esperado) achados.push(`${onde}: valor diferente do único permitido`) }
const booleano: Regra = (v, onde, achados) => { if (typeof v !== 'boolean') achados.push(`${onde}: esperado booleano`) }
const numeroFinito: Regra = (v, onde, achados) => { if (typeof v !== 'number' || !Number.isFinite(v)) achados.push(`${onde}: esperado número finito`) }
const identificador: Regra = (v, onde, achados) => { if (typeof v !== 'string' || !IDENTIFICADOR.test(v)) achados.push(`${onde}: esperado identificador`) }
const cidade: Regra = (v, onde, achados) => {
  if (typeof v !== 'string' || v.length === 0 || v.length > TAMANHO_MAXIMO_DA_CIDADE || TEM_CONTROLE.test(v)) achados.push(`${onde}: texto fora do formato aceito`)
}
const lista = (item: Regra, maximo: number): Regra => (v, onde, achados) => {
  if (!Array.isArray(v)) { achados.push(`${onde}: esperado lista`); return }
  if (v.length > maximo) achados.push(`${onde}: lista maior que o permitido`)
  v.forEach((x, i) => item(x, `${onde}[${i}]`, achados))
}
const ouNulo = (regra: Regra): Regra => (v, onde, achados) => { if (v !== null) regra(v, onde, achados) }

const ESQUEMA: Regra = objeto({
  versao: { regra: literal(VERSAO_DA_APRESENTACAO) },
  configuracao: {
    regra: objeto({
      uso: { regra: umDe(USOS.map((u) => u.id)), opcional: true },
      vao: { regra: numeroFinito, opcional: true },
      comprimento: { regra: numeroFinito, opcional: true },
      peDireito: { regra: numeroFinito, opcional: true },
      cidade: { regra: cidade, opcional: true },
      cobertura: { regra: umDe(COBERTURAS.map((u) => u.id)), opcional: true },
      fechamento: { regra: umDe(FECHAMENTOS.map((u) => u.id)), opcional: true },
    }),
  },
  declaracao: { regra: ouNulo(objeto({ itens: { regra: lista((v, onde, a) => { if (typeof v !== 'string' || v.length > 80) a.push(`${onde}: esperado texto curto`) }, MAXIMO_DE_TIPOLOGIAS) }, nenhumaDasAnteriores: { regra: booleano } })) },
  enquadramento: {
    regra: objeto({
      versaoDasRegras: { regra: identificador },
      situacaoDasRegras: { regra: umDe(SITUACOES_DAS_REGRAS) },
      configuracaoComercialValida: { regra: booleano },
      camposComErro: { regra: lista(umDe(CAMPOS_DA_CONFIGURACAO), CAMPOS_DA_CONFIGURACAO.length) },
      classe: { regra: umDe(CLASSES) },
      motivos: {
        regra: lista(objeto({
          regra: { regra: umDe(REGRAS) },
          campo: { regra: umDe(CAMPOS_DA_CONFIGURACAO), opcional: true },
          informado: { regra: numeroFinito, opcional: true },
          min: { regra: numeroFinito, opcional: true },
          max: { regra: numeroFinito, opcional: true },
          tipologia: { regra: identificador, opcional: true },
        }), MAXIMO_DE_TIPOLOGIAS + CAMPOS_DA_CONFIGURACAO.length),
      },
      encaminhamento: { regra: umDe(ENCAMINHAMENTOS) },
      aprovacaoEstrutural: { regra: literal(false) },
      aptidaoParaProcessamentoEstrutural: { regra: literal('NAO_DETERMINADA') },
    }),
  },
  proximoPasso: { regra: objeto({ encaminhamento: { regra: umDe(ENCAMINHAMENTOS) }, prontoParaEncaminhar: { regra: booleano } }) },
})

/**
 * Confere o objeto contra o esquema. Devolve o que está fora dele; lista vazia
 * = objeto aceito. Qualquer campo não previsto é violação — um bloco de
 * diagnóstico, de vento ou de quantitativo não tem onde caber.
 */
export function violacoesDaApresentacao(objetoRecebido: unknown): string[] {
  const achados: string[] = []
  ESQUEMA(objetoRecebido, 'apresentacao', achados)
  return achados
}

/* ---------------------------------------------------------------- Montagem */

const PRONTO: Record<Encaminhamento, boolean> = { CORRIGIR_CONFIGURACAO: false, DECLARAR_TIPOLOGIA: false, ATENDIMENTO_TECNICO: true, ESTUDO_PADRONIZADO: true, INDISPONIVEL: false }

/**
 * Monta o objeto público. Os ÚNICOS insumos são a configuração do visitante, a
 * declaração dele e as regras de escopo. O resultado passa pela conferência de
 * estrutura antes de sair; se ela achar algo, nada é entregue.
 */
export function montarApresentacaoPublica(
  c: ConfiguracaoGalpao,
  declaracao: DeclaracaoDeTipologia | null,
  regras: RegrasDeEscopo | null | undefined = ESCOPO_PADRONIZADO,
): Entrega {
  const configuracao = configuracaoPublica(c)
  const declarado = declaracaoPublica(declaracao)
  const enquadramento = enquadrar(configuracao, declarado, regras)
  const apresentacao: ApresentacaoPublica = {
    versao: VERSAO_DA_APRESENTACAO,
    configuracao,
    declaracao: declarado,
    enquadramento,
    proximoPasso: { encaminhamento: enquadramento.encaminhamento, prontoParaEncaminhar: PRONTO[enquadramento.encaminhamento] },
  }
  const violacoes = violacoesDaApresentacao(apresentacao)
  return violacoes.length > 0 ? { ok: false, violacoes } : { ok: true, apresentacao }
}

/* ---------------------------------------------------------------- Leituras para a tela (texto a partir dos dados) */

export interface LinhaDoResumo { rotulo: string; valor: string }

export const tituloDoResumo = (a: ApresentacaoPublica): string => resumoConfiguracao(a.configuracao)

export function linhasDoResumo(a: ApresentacaoPublica): LinhaDoResumo[] {
  const c = a.configuracao
  const l: LinhaDoResumo[] = []
  if (c.uso) l.push({ rotulo: 'Uso', valor: nomeOpcao(USOS, c.uso) })
  if (typeof c.vao === 'number') l.push({ rotulo: 'Vão livre', valor: `${formatarMedida(c.vao)} m` })
  if (typeof c.comprimento === 'number') l.push({ rotulo: 'Comprimento', valor: `${formatarMedida(c.comprimento)} m` })
  if (typeof c.peDireito === 'number') l.push({ rotulo: 'Pé-direito', valor: `${formatarMedida(c.peDireito)} m` })
  const area = areaCoberta(c)
  if (area !== undefined && Number.isFinite(area)) l.push({ rotulo: 'Projeção em planta', valor: `${formatarArea(area)} m²` })
  if (c.cidade) l.push({ rotulo: 'Local da obra', valor: c.cidade })
  if (c.cobertura) l.push({ rotulo: 'Cobertura', valor: nomeOpcao(COBERTURAS, c.cobertura) })
  if (c.fechamento) l.push({ rotulo: 'Fechamento', valor: nomeOpcao(FECHAMENTOS, c.fechamento) })
  return l
}

/** Os rótulos da tipologia declarada. Identificador fora da lista vira um rótulo neutro: o texto dele não é exibido. */
export function rotulosDaTipologia(a: ApresentacaoPublica, regras: RegrasDeEscopo | null | undefined): string[] {
  const d = a.declaracao
  if (d === null) return []
  if (d.nenhumaDasAnteriores && d.itens.length === 0) return ['Nenhuma das características listadas']
  return d.itens.map((id) => regras?.tipologiasForaDoPadrao?.find((t) => t.id === id)?.rotulo ?? 'Característica fora da lista')
}
