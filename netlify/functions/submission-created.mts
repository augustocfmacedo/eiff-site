/**
 * O TRANSPORTE do formulário para o EIFF Controle.
 *
 * Esta função não muda nada do site público: nenhum HTML, nenhum JavaScript do navegador, nenhum campo novo.
 * Ela é acionada pela PLATAFORMA quando uma submissão de formulário é verificada (evento de submissão, nome de
 * arquivo `submission-created`), e reencaminha a submissão autenticada para o CRM.
 *
 * ── POR QUE ASSIM, E NÃO PELA NOTIFICAÇÃO NATIVA ─────────────────────────────────────────────────
 *
 * A notificação nativa de webhook do Netlify faz POST a uma URL arbitrária, mas NÃO aceita cabeçalho próprio:
 * o único que ela acrescenta é `X-Webhook-Signature`, quando se informa um «JWS secret token». O endpoint do
 * CRM exige um segredo compartilhado em cabeçalho, e não há campo para isso. Daí esta função: ela é o único
 * lugar onde o segredo pode entrar sem nunca encostar no frontend.
 *
 * ── O QUE ELA GARANTE, E O QUE NÃO GARANTE ───────────────────────────────────────────────────────
 *
 * Garante: o segredo só existe no ambiente do servidor (`EIFF_FORM_SECRET`), o corpo vai como veio e nada do
 * conteúdo do lead é registrado em log. Tenta de novo quando a falha é transitória (rede ou 5xx).
 *
 * NÃO garante entrega. A plataforma não usa o retorno desta função e não reenvia: se as tentativas falharem,
 * a submissão continua guardada no painel de formulários e NADA chega ao CRM. Quem conserta isso é o
 * reconciliador do EIFF Controle (`scripts/formulario-reconciliar.mts`), que lê a API oficial de submissões e
 * reenvia pelo MESMO endpoint, com a mesma chave de idempotência. Por isso o reconciliador não é conforto.
 */

/** O que a plataforma entrega. Só o que esta função usa. */
interface EventoDeSubmissao {
  body?: string | null
}

const DESTINO_PADRAO = 'https://eiffcontrol.com.br/api/formulario-site'
const CABECALHO_SEGREDO = 'x-eiff-form-secret'
const TENTATIVAS = 3
const ESPERA_MS = 400

const log = (t: Record<string, unknown>) => {
  // Só status e tentativa. Nunca o corpo, nunca o segredo, nunca os dados de quem preencheu.
  try { console.log(JSON.stringify({ evento: 'formulario_para_o_crm', ...t })) } catch { /* ignore */ }
}

const espera = (ms: number) => new Promise<void>((r) => { setTimeout(r, ms) })

export const handler = async (event: EventoDeSubmissao): Promise<{ statusCode: number }> => {
  const segredo = (process.env.EIFF_FORM_SECRET ?? '').trim()
  const destino = (process.env.EIFF_CRM_FORM_ENDPOINT ?? '').trim() || DESTINO_PADRAO
  const corpo = event.body ?? ''

  if (segredo === '') {
    // Sem segredo configurado não se manda nada: mandar sem autenticação seria pior do que não mandar.
    log({ outcome: 'nao_configurado', motivo: 'sem EIFF_FORM_SECRET' })
    return { statusCode: 200 }
  }
  if (corpo === '') {
    log({ outcome: 'sem_corpo' })
    return { statusCode: 200 }
  }

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa += 1) {
    try {
      const r = await fetch(destino, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [CABECALHO_SEGREDO]: segredo },
        body: corpo,
      })
      if (r.ok) {
        log({ outcome: 'entregue', status: r.status, tentativa })
        return { statusCode: 200 }
      }
      // 4xx é decisão do CRM (corpo inválido, formulário não aceito): insistir não muda nada.
      if (r.status < 500) {
        log({ outcome: 'recusado', status: r.status, tentativa })
        return { statusCode: 200 }
      }
      log({ outcome: 'transitorio', status: r.status, tentativa })
    } catch (e) {
      log({ outcome: 'falha_de_rede', tentativa, motivo: (e as Error).message ?? 'erro' })
    }
    if (tentativa < TENTATIVAS) await espera(ESPERA_MS * tentativa)
  }

  // Esgotou. A submissão está guardada no painel de formulários; o reconciliador a traz.
  log({ outcome: 'nao_entregue', tentativas: TENTATIVAS, recuperacao: 'reconciliador' })
  return { statusCode: 200 }
}

export default handler
