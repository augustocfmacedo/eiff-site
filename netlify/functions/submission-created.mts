/**
 * O TRANSPORTE do formulário para o EIFF Controle.
 *
 * Esta função não muda nada do site público: nenhum HTML, nenhum JavaScript do navegador, nenhum campo novo.
 * Ela é acionada pela PLATAFORMA quando uma submissão de formulário é verificada (evento `formSubmitted`,
 * convenção de nome de arquivo `submission-created`), e reencaminha a submissão autenticada para o CRM.
 *
 * ── POR QUE ASSIM, E NÃO PELA NOTIFICAÇÃO NATIVA ─────────────────────────────────────────────────
 *
 * A notificação nativa de webhook do Netlify faz POST a uma URL arbitrária, mas NÃO aceita cabeçalho próprio:
 * o único que ela acrescenta é `X-Webhook-Signature`, quando se informa um «JWS secret token». O endpoint do
 * CRM exige um segredo compartilhado em cabeçalho, e não há campo para isso. Daí esta função: ela é o único
 * lugar onde o segredo pode entrar sem nunca encostar no frontend.
 *
 * ── A FORMA DO EVENTO (conferida na documentação em 09/11/2026) ───────────────────────────────────
 *
 * O Netlify tem DUAS formas para função de evento, e elas entregam coisas diferentes:
 *
 *   1. handler tipado (recomendado): `export default { formSubmitted(event) {…} }`, e o evento tipado é
 *      `interface FormSubmittedEvent { data: Record<string, string> }` — SÓ os campos do formulário.
 *      Não traz o id da submissão nem o instante. Para nós isso é insuficiente: a identidade estável da
 *      submissão (o id do Netlify) é a chave de idempotência das duas gravações do CRM, e o instante é o
 *      que faz a reconciliação de amanhã produzir a mesma impressão de hoje.
 *
 *   2. convenção de nome de arquivo (a que usamos, «continua totalmente suportada»): o módulo exporta uma
 *      função default que recebe um **Request**, e o corpo é o JSON `{ payload: { id, form_name,
 *      created_at, data, … } }` — a submissão inteira.
 *
 * Por isso aqui: nome de arquivo `submission-created`, UM export default, e o corpo lido do Request.
 *
 * Duas consequências que valem registro:
 *
 *   • não existe mais nenhum export chamado `handler`. Um módulo que exporta `handler` E `default` deixa a
 *     plataforma escolher entre o contrato antigo (um objeto com `.body`) e o novo (um Request), e um
 *     transporte cujo contrato de chamada depende de precedência não declarada não pode ir ao ar.
 *   • `corpoDoEvento` aceita as duas formas de propósito. Se a plataforma invocar pelo contrato antigo, a
 *     submissão passa igual. Uma função de transporte não deve perder um lead por causa de versão de API.
 *
 * ── O QUE ELA GARANTE, E O QUE NÃO GARANTE ───────────────────────────────────────────────────────
 *
 * Garante: o segredo só existe no ambiente do servidor (`EIFF_FORM_SECRET`), o corpo vai como veio e nada do
 * conteúdo do lead é registrado em log. Tenta de novo quando a falha é transitória (rede ou 5xx). A própria
 * plataforma assina cada evento (JWS) e confere a assinatura ANTES de invocar a função, então não há
 * autenticação a repetir aqui.
 *
 * NÃO garante entrega. A plataforma não usa o retorno desta função e não reenvia: se as tentativas falharem,
 * a submissão continua guardada no painel de formulários e NADA chega ao CRM. Quem conserta isso é o
 * reconciliador do EIFF Controle (`scripts/formulario-reconciliar.mts`), que lê a API oficial de submissões e
 * reenvia pelo MESMO endpoint, com a mesma chave de idempotência. Por isso o reconciliador não é conforto.
 */

const DESTINO_PADRAO = 'https://eiffcontrol.com.br/api/formulario-site'
const CABECALHO_SEGREDO = 'x-eiff-form-secret'
const TENTATIVAS = 3
const ESPERA_MS = 400

const log = (t: Record<string, unknown>) => {
  // Só status e tentativa. Nunca o corpo, nunca o segredo, nunca os dados de quem preencheu.
  try { console.log(JSON.stringify({ evento: 'formulario_para_o_crm', ...t })) } catch { /* ignore */ }
}

const espera = (ms: number) => new Promise<void>((r) => { setTimeout(r, ms) })

/**
 * O corpo cru do evento, nas duas formas que o Netlify já usou.
 *
 * Request (contrato atual da convenção de nome de arquivo) → `await req.text()`.
 * `{ body: string }` (contrato antigo, compatível com Lambda) → o próprio texto.
 * Qualquer outra coisa → `''`, e quem chama registra `sem_corpo` em vez de mandar lixo autenticado.
 */
export async function corpoDoEvento(entrada: unknown): Promise<string> {
  if (entrada === null || typeof entrada !== 'object') return ''
  const o = entrada as { text?: unknown; body?: unknown }
  if (typeof o.text === 'function') {
    try { return String(await (o.text as () => Promise<string>).call(entrada) ?? '') } catch { return '' }
  }
  return typeof o.body === 'string' ? o.body : ''
}


/* ── P1: ISOLAMENTO DE PRODUÇÃO ────────────────────────────────────────────────────────────────────
 *
 * O que esta guarda resolve e o que ela NÃO resolve, para ninguém confiar nela além da conta:
 *
 *   • NÃO separa uma submissão feita num preview: os formulários são do site inteiro e o evento roda no
 *     deploy publicado de produção, então para esta função as duas são idênticas. Quem impede o preview de
 *     produzir submissão é o build (`scripts/formularios-por-contexto.mjs`: fora da produção não existe
 *     formulário) e a limpeza dos previews antigos.
 *   • Resolve: esta função, num deploy que não seja o de produção publicado deste site, nunca encaminha —
 *     e sem o contexto da plataforma também não. Fail-closed: na dúvida o lead fica no painel de
 *     formulários (de onde a conferência C o recupera), nunca vai para o CRM por um caminho não comprovado.
 *   • Só os dois formulários de produção seguem; qualquer outro nome para aqui, antes de gastar o segredo.
 *
 * O contexto vem do 2º argumento que a plataforma passa ao handler (`Context` da Functions API:
 * `deploy.context`, `deploy.published`, `site.id`). Nada vem do corpo, de campo oculto, de `referrer`
 * ou de cabeçalho do navegador. Que a plataforma preencha esse argumento também em função de EVENTO não está
 * escrito na documentação: é comprovado em projeto descartável antes de publicar (prova H-0 do plano P1).
 */
export const SITE_DE_PRODUCAO = 'fdb653b1-0ffc-4f64-92f9-2624328d2e45'
export const FORMULARIOS_DE_PRODUCAO: readonly string[] = Object.freeze(['iniciar-projeto', 'simular-galpao'])

export type MotivoBloqueio =
  | 'contexto_ausente' | 'outro_site' | 'contexto_nao_produtivo' | 'deploy_nao_publicado'
  | 'corpo_ilegivel' | 'formulario_nao_aceito'

interface ContextoDaPlataforma {
  site?: { id?: unknown }
  deploy?: { context?: unknown; published?: unknown }
}

/** Pode encaminhar? Só produção publicada deste site, e só os formulários de produção. */
export function origemAutorizada(contexto: unknown, corpo: string): { ok: true } | { ok: false; motivo: MotivoBloqueio } {
  if (contexto === null || typeof contexto !== 'object') return { ok: false, motivo: 'contexto_ausente' }
  const c = contexto as ContextoDaPlataforma
  if (c.site === undefined || c.deploy === undefined) return { ok: false, motivo: 'contexto_ausente' }
  if (c.site.id !== SITE_DE_PRODUCAO) return { ok: false, motivo: 'outro_site' }
  if (c.deploy.context !== 'production') return { ok: false, motivo: 'contexto_nao_produtivo' }
  if (c.deploy.published !== true) return { ok: false, motivo: 'deploy_nao_publicado' }
  let nome: unknown
  try { nome = (JSON.parse(corpo) as { payload?: { form_name?: unknown } })?.payload?.form_name } catch { return { ok: false, motivo: 'corpo_ilegivel' } }
  if (typeof nome !== 'string' || !FORMULARIOS_DE_PRODUCAO.includes(nome)) return { ok: false, motivo: 'formulario_nao_aceito' }
  return { ok: true }
}

export async function reencaminhar(entrada: unknown, contexto?: unknown): Promise<void> {
  const segredo = (process.env.EIFF_FORM_SECRET ?? '').trim()
  const destino = (process.env.EIFF_CRM_FORM_ENDPOINT ?? '').trim() || DESTINO_PADRAO
  const corpo = await corpoDoEvento(entrada)

  if (segredo === '') {
    // Sem segredo configurado não se manda nada: mandar sem autenticação seria pior do que não mandar.
    log({ outcome: 'nao_configurado', motivo: 'sem EIFF_FORM_SECRET' })
    return
  }
  if (corpo === '') {
    log({ outcome: 'sem_corpo' })
    return
  }
  const origem = origemAutorizada(contexto, corpo)
  if (!origem.ok) {
    // Não encaminha. O lead (se for um) continua no painel de formulários. Só o motivo vai ao log.
    log({ outcome: 'bloqueado', motivo: origem.motivo })
    return
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
        return
      }
      // 4xx é decisão do CRM (corpo inválido, formulário não aceito): insistir não muda nada.
      if (r.status < 500) {
        log({ outcome: 'recusado', status: r.status, tentativa })
        return
      }
      log({ outcome: 'transitorio', status: r.status, tentativa })
    } catch (e) {
      log({ outcome: 'falha_de_rede', tentativa, motivo: (e as Error).message ?? 'erro' })
    }
    if (tentativa < TENTATIVAS) await espera(ESPERA_MS * tentativa)
  }

  // Esgotou. A submissão está guardada no painel de formulários; o reconciliador a traz.
  log({ outcome: 'nao_entregue', tentativas: TENTATIVAS, recuperacao: 'reconciliador' })
}

// Um único export default: é ele que define o contrato de chamada. Nada de `export const handler`.
export default reencaminhar
