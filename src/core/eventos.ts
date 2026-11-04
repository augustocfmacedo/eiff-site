/**
 * Eventos de uso do site, fora do funil do simulador (que tem módulo próprio
 * em `src/simulador/analytics.ts`).
 *
 * As três regras de lá valem aqui, sem exceção:
 *  1. Nenhum dado pessoal entra num evento. A lista de eventos é fechada e o
 *     único acompanhante possível é um rótulo curto e saneado — nome de seção,
 *     de página ou de projeto. Nunca nome, e-mail, telefone ou texto livre.
 *  2. Consentimento primeiro: `podeRastrear` respeita Do Not Track e o opt-out
 *     local, e falha fechada (qualquer erro de leitura = não rastrear).
 *  3. Sem cookie, e sem quebrar a tela: se o Umami não carregou, o evento
 *     simplesmente não acontece.
 *
 * A decisão do que sai é pura (`propsDoEvento`, `sanearRotulo`) e tem teste; o
 * acesso ao `window` fica no invólucro fino `registrarSite`, como em
 * `analytics.registrar`.
 */
import { podeRastrear } from '../simulador/analytics'

/** Lista FECHADA de eventos do site. */
export type EventoSite =
  | 'contato_envio'
  | 'contato_erro'
  | 'video_play'
  | 'secao_projetos'

const LIMITE_ROTULO = 40

/**
 * Mantém só o que é seguro num rótulo e corta o tamanho. Função pura.
 *
 * O filtro derruba `@`, acento e qualquer pontuação fora de ` .:/-`, então um
 * e-mail ou um texto livre que caísse aqui por engano não chega reconhecível ao
 * provedor. É defesa, não licença para passar dado pessoal.
 */
export function sanearRotulo(valor: string | undefined): string | undefined {
  if (!valor) return undefined
  const limpo = valor.trim().replace(/[^\w .:/-]/g, '').slice(0, LIMITE_ROTULO)
  return limpo === '' ? undefined : limpo
}

/** O que acompanha o evento: nada, ou um único rótulo saneado. Função pura. */
export function propsDoEvento(rotulo?: string): { rotulo: string } | undefined {
  const limpo = sanearRotulo(rotulo)
  return limpo ? { rotulo: limpo } : undefined
}

interface Umami {
  track: (evento: string, props?: Record<string, unknown>) => void
}

/** Envia um evento, se houver consentimento e provedor. Nunca lança. */
export function registrarSite(evento: EventoSite, rotulo?: string): void {
  if (!podeRastrear()) return
  try {
    const umami = (window as Window & { umami?: Umami }).umami
    umami?.track(evento, propsDoEvento(rotulo))
  } catch {
    /* analytics nunca quebra a tela */
  }
}
