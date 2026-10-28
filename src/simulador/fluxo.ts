/**
 * Fluxo do simulador: etapas, validação por etapa e navegação.
 *
 * Módulo PURO: recebe o estado, devolve o próximo estado. Quem toca no DOM é
 * `tela.ts`. Assim o funil inteiro é testável sem navegador.
 */

import {
  type ConfiguracaoGalpao,
  type Contato,
  type ErroCampo,
  validarConfiguracao,
  validarContato,
  validarMedida,
} from './parametros'

export type IdEtapa = 'uso' | 'dimensoes' | 'especificacao' | 'contexto' | 'contato'

export interface Etapa {
  id: IdEtapa
  indice: number
  titulo: string
  pergunta: string
  /** Campos que esta etapa coleta, na ordem em que aparecem. */
  campos: readonly (keyof ConfiguracaoGalpao | keyof Contato)[]
}

export const ETAPAS: readonly Etapa[] = [
  { id: 'uso', indice: 0, titulo: 'Uso', pergunta: 'O que você precisa colocar de pé?', campos: ['uso'] },
  { id: 'dimensoes', indice: 1, titulo: 'Dimensões', pergunta: 'Qual o tamanho da edificação?', campos: ['vao', 'comprimento', 'peDireito'] },
  { id: 'especificacao', indice: 2, titulo: 'Especificação', pergunta: 'Como ela precisa ser fechada?', campos: ['cobertura', 'fechamento', 'piso'] },
  { id: 'contexto', indice: 3, titulo: 'Contexto', pergunta: 'Onde e em que estágio está o projeto?', campos: ['cidade', 'terreno', 'projeto', 'prazo', 'escopo'] },
  { id: 'contato', indice: 4, titulo: 'Contato', pergunta: 'Para quem a engenharia responde?', campos: ['nome', 'empresa', 'email', 'telefone'] },
] as const

export const TOTAL_ETAPAS = ETAPAS.length

export interface EstadoSimulador {
  etapa: IdEtapa
  configuracao: ConfiguracaoGalpao
  contato: Contato
  /** Etapas já validadas com sucesso ao menos uma vez (habilita voltar e pular). */
  concluidas: readonly IdEtapa[]
  /** Erros da etapa atual, exibidos sob cada campo. */
  erros: readonly ErroCampo[]
  /** Etapas em que o visitante já viu erro: usado para validar enquanto digita. */
  tocadas: readonly IdEtapa[]
  enviado: boolean
}

export function estadoInicial(configuracao: ConfiguracaoGalpao = {}): EstadoSimulador {
  return { etapa: 'uso', configuracao, contato: {}, concluidas: [], erros: [], tocadas: [], enviado: false }
}

export const etapaPorId = (id: IdEtapa): Etapa => ETAPAS.find((e) => e.id === id)!

/** Progresso de 0 a 1 pelas etapas concluídas (nunca passa de 1). */
export function progresso(estado: EstadoSimulador): number {
  return Math.min(1, estado.concluidas.length / TOTAL_ETAPAS)
}

/**
 * Valida só os campos da etapa pedida. A etapa de contato valida contato;
 * as demais validam a configuração, filtrando os erros dos seus campos.
 */
export function validarEtapa(id: IdEtapa, estado: EstadoSimulador): ErroCampo[] {
  const etapa = etapaPorId(id)
  const campos = etapa.campos as readonly string[]
  if (id === 'contato') return validarContato(estado.contato).filter((e) => campos.includes(e.campo))

  if (id === 'dimensoes') {
    // Valida medida a medida para o erro aparecer no campo certo.
    const erros: ErroCampo[] = []
    for (const campo of ['vao', 'comprimento', 'peDireito'] as const) {
      const erro = validarMedida(campo, estado.configuracao[campo])
      if (erro) erros.push(erro)
    }
    return erros
  }

  return validarConfiguracao(estado.configuracao).filter((e) => campos.includes(e.campo))
}

/** Todas as etapas válidas = pronto para enviar. */
export function podeEnviar(estado: EstadoSimulador): boolean {
  return ETAPAS.every((e) => validarEtapa(e.id, estado).length === 0)
}

/** Avança se a etapa atual estiver válida; senão devolve o estado com os erros. */
export function avancar(estado: EstadoSimulador): EstadoSimulador {
  const erros = validarEtapa(estado.etapa, estado)
  const tocadas = estado.tocadas.includes(estado.etapa) ? estado.tocadas : [...estado.tocadas, estado.etapa]
  if (erros.length > 0) return { ...estado, erros, tocadas }

  const concluidas = estado.concluidas.includes(estado.etapa) ? estado.concluidas : [...estado.concluidas, estado.etapa]
  const atual = etapaPorId(estado.etapa)
  const proxima = ETAPAS[atual.indice + 1]
  return { ...estado, etapa: proxima ? proxima.id : estado.etapa, concluidas, erros: [], tocadas }
}

export function voltar(estado: EstadoSimulador): EstadoSimulador {
  const atual = etapaPorId(estado.etapa)
  const anterior = ETAPAS[atual.indice - 1]
  if (!anterior) return estado
  return { ...estado, etapa: anterior.id, erros: [] }
}

/** Salto direto pelo indicador de etapas: só para trás ou para etapa já concluída. */
export function irPara(estado: EstadoSimulador, id: IdEtapa): EstadoSimulador {
  const destino = etapaPorId(id)
  const atual = etapaPorId(estado.etapa)
  const permitido = destino.indice < atual.indice || estado.concluidas.includes(id)
  if (!permitido) return estado
  return { ...estado, etapa: id, erros: [] }
}

/** Atualiza um campo da configuração e revalida a etapa se ela já mostrou erro. */
export function definirConfiguracao(estado: EstadoSimulador, parcial: Partial<ConfiguracaoGalpao>): EstadoSimulador {
  const proximo: EstadoSimulador = { ...estado, configuracao: { ...estado.configuracao, ...parcial } }
  return estado.tocadas.includes(estado.etapa) ? { ...proximo, erros: validarEtapa(estado.etapa, proximo) } : { ...proximo, erros: [] }
}

export function definirContato(estado: EstadoSimulador, parcial: Partial<Contato>): EstadoSimulador {
  const proximo: EstadoSimulador = { ...estado, contato: { ...estado.contato, ...parcial } }
  return estado.tocadas.includes(estado.etapa) ? { ...proximo, erros: validarEtapa(estado.etapa, proximo) } : { ...proximo, erros: [] }
}

/** Mensagem de erro de um campo na etapa atual, para exibir sob o controle. */
export function erroDoCampo(estado: EstadoSimulador, campo: string): string | undefined {
  return estado.erros.find((e) => e.campo === campo)?.mensagem
}
