/**
 * Textos do ENQUADRAMENTO COMERCIAL e o acréscimo ao campo `especificacao`.
 *
 * Módulo puro. O objeto de apresentação (`apresentacao.ts`) só tem códigos e
 * números; as frases nascem aqui, a partir deles.
 *
 * Enquanto as regras de escopo forem PROVISÓRIAS, todo texto sai no
 * condicional — «indicação preliminar», «tende a», «em princípio».
 *
 * O LEAD NÃO GANHA CAMPO NOVO. A tipologia declarada e o enquadramento seguem
 * no fim do campo `especificacao`, que o formulário já envia e o CRM já lê, no
 * mesmo formato «Rótulo: valor» separado por « · ». O acréscimo só tem textos
 * de listas fechadas e a versão das regras: nada que o visitante digitou
 * livremente, e nada de resultado estrutural.
 */

import { COBERTURAS, ESCOPOS, FECHAMENTOS, PISOS, PRAZOS, PROJETOS, TERRENOS, USOS, nomeOpcao, type ConfiguracaoGalpao } from './parametros'
import { ESCOPO_PADRONIZADO, ehProvisorio, fraseDoMotivo, tituloDaClasse, type DeclaracaoDeTipologia, type Encaminhamento, type RegrasDeEscopo, type SituacaoDasRegras } from './enquadramento'
import { montarApresentacaoPublica, rotulosDaTipologia, type ApresentacaoPublica } from './apresentacao'

/** Separador que a página já usa entre os itens de `especificacao`. */
export const SEPARADOR = ' · '
/** Teto do campo inteiro, com folga sobre o pior caso medido em teste. */
export const TAMANHO_MAXIMO_DA_ESPECIFICACAO = 1000

export const AVISO_DO_ENQUADRAMENTO = 'Enquadrar não é aprovar: indica por onde o pedido tende a seguir no atendimento. Não diz que a estrutura foi verificada, que é viável ou quanto custa.'

const PASSO: Record<Encaminhamento, { afirmativo: string; condicional: string }> = {
  CORRIGIR_CONFIGURACAO: { afirmativo: 'Complete a configuração para ver o enquadramento.', condicional: 'Complete a configuração para ver o enquadramento.' },
  DECLARAR_TIPOLOGIA: { afirmativo: 'Responda às características do galpão para ver o enquadramento. Sem resposta, o pedido segue normalmente para a engenharia.', condicional: 'Responda às características do galpão para ver o enquadramento. Sem resposta, o pedido segue normalmente para a engenharia.' },
  ATENDIMENTO_TECNICO: { afirmativo: 'O pedido segue para a engenharia da EIFF, que avalia o caso e responde por pessoa.', condicional: 'O pedido tende a seguir para a engenharia da EIFF, que avalia o caso, confirma o caminho e responde por pessoa.' },
  ESTUDO_PADRONIZADO: { afirmativo: 'O pedido segue como estudo preliminar padronizado; a engenharia da EIFF responde por pessoa.', condicional: 'O pedido tende a seguir como estudo preliminar padronizado; a engenharia da EIFF confirma o enquadramento e responde por pessoa.' },
  INDISPONIVEL: { afirmativo: 'O enquadramento não está disponível agora; o pedido segue normalmente para a engenharia.', condicional: 'O enquadramento não está disponível agora; o pedido segue normalmente para a engenharia.' },
}

export interface TextoDoEnquadramento {
  titulo: string
  motivos: string[]
  proximoPasso: string
  provisorio: boolean
  regras: string
}

/** As frases do enquadramento, para a tela. */
export function textoDoEnquadramento(a: ApresentacaoPublica, regras: RegrasDeEscopo | null | undefined, mensagens: Readonly<Record<string, string>> = {}): TextoDoEnquadramento {
  const e = a.enquadramento
  const provisorio = ehProvisorio(e.situacaoDasRegras)
  return {
    titulo: tituloDaClasse(e.classe, e.situacaoDasRegras),
    motivos: e.motivos.map((m) => fraseDoMotivo(m, e.situacaoDasRegras, regras, mensagens)),
    proximoPasso: PASSO[e.encaminhamento][provisorio ? 'condicional' : 'afirmativo'],
    provisorio,
    regras: `Regras de escopo ${e.versaoDasRegras}${provisorio ? ', provisórias' : ''}.`,
  }
}

const rotuloDasRegras = (s: SituacaoDasRegras) => (s === 'APROVADA' ? 'regras' : 'regras provisórias')

/** Os dois itens que entram no fim de `especificacao`. */
export function itensDoEnquadramento(a: ApresentacaoPublica, regras: RegrasDeEscopo | null | undefined): [string, string] {
  const e = a.enquadramento
  const tipologia = rotulosDaTipologia(a, regras)
  return [
    `Tipologia declarada: ${tipologia.length ? tipologia.join('; ') : 'não declarada'}`,
    `Enquadramento comercial (${rotuloDasRegras(e.situacaoDasRegras)} ${e.versaoDasRegras}): ${tituloDaClasse(e.classe, e.situacaoDasRegras)}`,
  ]
}

/**
 * A especificação que vai ao lead: os itens que a página já monta, mais os dois
 * do enquadramento. Nenhum item pode trazer o separador dentro dele, senão quem
 * lê não consegue separar os itens de volta; e o total respeita o teto.
 */
export function especificacaoComEnquadramento(itensExistentes: readonly string[], a: ApresentacaoPublica, regras: RegrasDeEscopo | null | undefined): string {
  const itens = [...itensExistentes, ...itensDoEnquadramento(a, regras)].map((x) => x.split(SEPARADOR).join(', '))
  const texto = itens.join(SEPARADOR)
  return texto.length <= TAMANHO_MAXIMO_DA_ESPECIFICACAO ? texto : `${texto.slice(0, TAMANHO_MAXIMO_DA_ESPECIFICACAO - 1)}…`
}

/* ---------------------------------------------------------------- O campo inteiro, a partir do estado */

/**
 * Os itens que a página JÁ enviava em `especificacao`, no mesmo texto e na
 * mesma ordem de antes. Movidos para cá sem mudança, para poderem ser testados.
 */
export function itensAtuaisDaEspecificacao(c: ConfiguracaoGalpao): string[] {
  return [
    `Cobertura: ${nomeOpcao(COBERTURAS, c.cobertura)}`,
    `Fechamento: ${nomeOpcao(FECHAMENTOS, c.fechamento)}`,
    `Piso: ${nomeOpcao(PISOS, c.piso)}`,
    `Escopo: ${nomeOpcao(ESCOPOS, c.escopo)}`,
    `Terreno: ${nomeOpcao(TERRENOS, c.terreno)}`,
    `Projeto: ${nomeOpcao(PROJETOS, c.projeto)}`,
    `Prazo: ${nomeOpcao(PRAZOS, c.prazo)}`,
    `Uso: ${nomeOpcao(USOS, c.uso)}`,
  ]
}

/**
 * O valor do campo `especificacao` no envio. Se o enquadramento não puder ser
 * montado com segurança, o campo sai exatamente como saía antes: o lead nunca
 * deixa de seguir por causa do enquadramento.
 */
export function especificacaoDoLead(c: ConfiguracaoGalpao, declaracao: DeclaracaoDeTipologia | null, regras: RegrasDeEscopo | null | undefined = ESCOPO_PADRONIZADO): string {
  const base = itensAtuaisDaEspecificacao(c)
  const entrega = montarApresentacaoPublica(c, declaracao, regras)
  return entrega.ok ? especificacaoComEnquadramento(base, entrega.apresentacao, regras) : base.join(SEPARADOR)
}
