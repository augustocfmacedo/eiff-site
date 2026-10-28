/**
 * Contrato do serviço de pré-engenharia (MODO LAB) — Fase 02.
 *
 * REGRA DESTA FASE: o frontend NÃO calcula e NÃO exibe valor. Não existe aqui
 * tabela de preço, coeficiente de custo, peso de aço por m² ou prazo derivado.
 * Este arquivo declara apenas o CONTRATO que a Fase 02 vai implementar atrás de
 * uma função no servidor, e um provedor fail-closed que recusa enquanto o
 * serviço não existir.
 *
 * Por que fail-closed: um provedor que "estimasse alguma coisa" para não quebrar
 * a tela acabaria mostrando número inventado ao cliente. Recusar é o
 * comportamento correto — a tela trata `indisponivel` mostrando o caminho humano.
 */

import type { ConfiguracaoGalpao } from './parametros'
import type { OrigemCampanha } from './analytics'

export const VERSAO_CONTRATO = 'pre-engenharia-1' as const

/** O que o cliente envia. Sem nome, e-mail ou telefone: o contato vai pelo lead. */
export interface PedidoPreEngenharia {
  versaoContrato: typeof VERSAO_CONTRATO
  configuracao: ConfiguracaoGalpao
  /** Identificador efêmero da sessão, só para correlacionar pedido e resposta. */
  idSessao: string
  origem?: OrigemCampanha
}

/** Faixa de um número, para a resposta nunca ser um valor único e falsamente preciso. */
export interface Faixa {
  min: number
  max: number
  unidade: string
}

export interface ResultadoPreEngenharia {
  /** Peso estrutural estimado pelo serviço, nunca calculado no cliente. */
  aco?: Faixa
  /** Prazo de execução estimado pelo serviço. */
  prazo?: Faixa
  /** Investimento estimado pelo serviço. Exibido só com a ressalva que vier junto. */
  investimento?: Faixa
  /** Texto obrigatório de ressalva, redigido pelo serviço e exibido sem edição. */
  ressalva: string
  /** Premissas que o serviço assumiu, para a tela listar. */
  premissas?: readonly string[]
  /** Versão do motor de pré-engenharia que produziu o resultado. */
  versaoMotor?: string
}

export type RespostaPreEngenharia =
  | { status: 'ok'; resultado: ResultadoPreEngenharia }
  | { status: 'fora-do-escopo'; motivo: string }
  | { status: 'indisponivel'; motivo: string }

export interface ProvedorPreEngenharia {
  readonly id: string
  /** Falso enquanto a Fase 02 não estiver no ar. A tela nunca chama `estimar` sem isto. */
  disponivel(): boolean
  estimar(pedido: PedidoPreEngenharia, sinal?: AbortSignal): Promise<RespostaPreEngenharia>
}

export const MOTIVO_INDISPONIVEL =
  'A pré-engenharia automática ainda não está disponível nesta fase. A configuração segue para a engenharia da EIFF, que responde com estudo preliminar.'

/**
 * Provedor desta fase: recusa sempre, sem rede e sem cálculo.
 * Trocar por `provedorHttp` na Fase 02 não muda nenhuma linha da tela.
 */
export const PROVEDOR_INDISPONIVEL: ProvedorPreEngenharia = {
  id: 'indisponivel',
  disponivel: () => false,
  async estimar() {
    return { status: 'indisponivel', motivo: MOTIVO_INDISPONIVEL }
  },
}

/**
 * Esqueleto do provedor da Fase 02: fala com uma função no servidor, que guarda
 * a chave e as tabelas comerciais. Não é usado agora (nenhuma rota existe), fica
 * aqui para a Fase 02 só ligar a URL e trocar o provedor na tela.
 */
export function provedorHttp(endpoint: string, fetchImpl: typeof fetch = fetch): ProvedorPreEngenharia {
  return {
    id: 'http',
    disponivel: () => Boolean(endpoint),
    async estimar(pedido, sinal) {
      try {
        const r = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pedido),
          signal: sinal,
        })
        if (!r.ok) return { status: 'indisponivel', motivo: MOTIVO_INDISPONIVEL }
        const corpo = (await r.json()) as RespostaPreEngenharia
        // Fail-closed: resposta sem ressalva não é exibida como resultado.
        if (corpo?.status === 'ok' && (!corpo.resultado || typeof corpo.resultado.ressalva !== 'string' || corpo.resultado.ressalva.trim() === '')) {
          return { status: 'indisponivel', motivo: MOTIVO_INDISPONIVEL }
        }
        return corpo
      } catch {
        return { status: 'indisponivel', motivo: MOTIVO_INDISPONIVEL }
      }
    },
  }
}
