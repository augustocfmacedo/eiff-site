/**
 * Analytics do funil do simulador.
 *
 * Três regras, nesta ordem:
 *  1. Nenhum dado pessoal sai daqui. Nome, e-mail, telefone, empresa e o texto
 *     livre de observação nunca entram num evento — há uma lista fechada de
 *     chaves permitidas e um teste que a prende.
 *  2. Consentimento primeiro: respeita Do Not Track e um opt-out local. Sem
 *     consentimento, nada é enviado e nada é guardado.
 *  3. Sem cookie. A origem da campanha fica em `sessionStorage`, morre com a aba
 *     e serve só para o lead saber de onde veio.
 *
 * O provedor é o Umami já usado no site (sem cookies). Se ele não tiver
 * carregado, os eventos simplesmente não acontecem — nunca quebram a tela.
 */

/** Plataforma que gerou o identificador de clique. */
export type PlataformaClique = 'google' | 'meta' | 'microsoft'

export interface OrigemCampanha {
  source?: string
  medium?: string
  campaign?: string
  content?: string
  term?: string
  /** Identificador de clique do anúncio, íntegro. Sem dado pessoal. */
  clique?: string
  /** De qual plataforma veio o identificador acima. */
  cliquePlataforma?: PlataformaClique
  /** Host de onde o visitante veio, sem caminho nem query. */
  referencia?: string
}

const CHAVE_ORIGEM = 'eiff:simulador:origem'
const CHAVE_OPTOUT = 'eiff:analytics:off'
const LIMITE_VALOR = 80

/**
 * O identificador de clique tem limite próprio, e maior.
 *
 * Um `gclid` passa de 80 caracteres com folga, e `gclid` truncado é `gclid`
 * inútil: o Google recusa a importação de conversão offline, que é justamente
 * o que permite medir o retorno do anúncio sem instalar tag nem cookie no site.
 * Cortar aqui custava a medição inteira da campanha.
 */
const LIMITE_CLIQUE = 300

/**
 * Parâmetros de clique, em ordem de precedência, com a plataforma de origem.
 *
 * Guardar a plataforma junto importa: `gclid` e `fbclid` vão para sistemas
 * diferentes, e o comercial não deveria ter de adivinhar pelo formato da
 * cadeia qual importação usar.
 *
 * `wbraid` e `gbraid` são os identificadores que o Google usa quando o
 * visitante está no iOS sem permissão de rastreamento; sem eles, boa parte do
 * tráfego de celular chegaria sem atribuição nenhuma.
 */
const PARAMS_CLIQUE: readonly (readonly [string, PlataformaClique])[] = [
  ['gclid', 'google'],
  ['wbraid', 'google'],
  ['gbraid', 'google'],
  ['fbclid', 'meta'],
  ['msclkid', 'microsoft'],
] as const

/** Mantém só o que é seguro em um valor de campanha e corta o tamanho. */
function sanear(valor: string | null, limite = LIMITE_VALOR): string | undefined {
  if (!valor) return undefined
  const limpo = valor.trim().replace(/[^\w .:/\-+]/g, '').slice(0, limite)
  return limpo === '' ? undefined : limpo
}

/** Primeiro identificador de clique presente na URL, com a plataforma. */
export function lerClique(p: URLSearchParams): Pick<OrigemCampanha, 'clique' | 'cliquePlataforma'> {
  for (const [chave, plataforma] of PARAMS_CLIQUE) {
    const valor = sanear(p.get(chave), LIMITE_CLIQUE)
    if (valor) return { clique: valor, cliquePlataforma: plataforma }
  }
  return {}
}

function semVazios<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T
}

/** Lê os parâmetros de campanha da URL e o host de origem. Função pura. */
export function capturarOrigem(search: string, referrer = ''): OrigemCampanha {
  const p = new URLSearchParams(search)
  let referencia: string | undefined
  try {
    referencia = referrer ? sanear(new URL(referrer).hostname) : undefined
  } catch {
    referencia = undefined
  }
  return semVazios({
    source: sanear(p.get('utm_source')),
    medium: sanear(p.get('utm_medium')),
    campaign: sanear(p.get('utm_campaign')),
    content: sanear(p.get('utm_content')),
    term: sanear(p.get('utm_term')),
    ...lerClique(p),
    referencia,
  })
}

export const origemVazia = (o: OrigemCampanha): boolean => Object.keys(semVazios(o)).length === 0

/* ---------------------------------------------------------------
   Consentimento
--------------------------------------------------------------- */

/**
 * Sem rastreamento quando o navegador pede Do Not Track ou quando há opt-out
 * guardado. Qualquer falha de leitura (modo privado, storage bloqueado) também
 * resulta em não rastrear: falha fechada.
 */
export function podeRastrear(janela: Pick<Window, 'navigator' | 'localStorage'> = window): boolean {
  try {
    const dnt = (janela.navigator as Navigator & { msDoNotTrack?: string }).doNotTrack
    if (dnt === '1' || dnt === 'yes') return false
    return janela.localStorage.getItem(CHAVE_OPTOUT) !== '1'
  } catch {
    return false
  }
}

export function desativarRastreamento(): void {
  try {
    window.localStorage.setItem(CHAVE_OPTOUT, '1')
    window.sessionStorage.removeItem(CHAVE_ORIGEM)
  } catch { /* storage indisponível: nada a desativar */ }
}

/* ---------------------------------------------------------------
   Origem guardada na sessão
--------------------------------------------------------------- */

/** Guarda a origem da primeira visita da sessão; visitas seguintes não sobrescrevem. */
export function guardarOrigem(origem: OrigemCampanha): void {
  if (!podeRastrear() || origemVazia(origem)) return
  try {
    if (window.sessionStorage.getItem(CHAVE_ORIGEM)) return
    window.sessionStorage.setItem(CHAVE_ORIGEM, JSON.stringify(origem))
  } catch { /* sem storage: a origem só vale para esta página */ }
}

export function lerOrigem(): OrigemCampanha {
  if (!podeRastrear()) return {}
  try {
    const bruto = window.sessionStorage.getItem(CHAVE_ORIGEM)
    return bruto ? (JSON.parse(bruto) as OrigemCampanha) : {}
  } catch {
    return {}
  }
}

/** Uma linha legível da origem, para acompanhar o lead no e-mail. */
export function origemEmTexto(o: OrigemCampanha): string {
  const partes = [
    o.source && `origem: ${o.source}`,
    o.medium && `mídia: ${o.medium}`,
    o.campaign && `campanha: ${o.campaign}`,
    o.content && `anúncio: ${o.content}`,
    o.term && `termo: ${o.term}`,
    o.clique && `clique ${o.cliquePlataforma ?? 'desconhecido'}: ${o.clique}`,
    o.referencia && `veio de: ${o.referencia}`,
  ].filter(Boolean)
  return partes.length ? partes.join(' · ') : 'direto'
}

/* ---------------------------------------------------------------
   Eventos do funil
--------------------------------------------------------------- */

export type EventoSimulador =
  | 'simulador_inicio'
  | 'simulador_etapa'
  | 'simulador_etapa_erro'
  | 'simulador_resumo'
  | 'simulador_envio'
  | 'simulador_envio_erro'
  | 'simulador_contato_alternativo'

/**
 * Lista FECHADA de propriedades que podem acompanhar um evento. Qualquer outra
 * chave é descartada. É isto que impede dado pessoal de vazar para o analytics.
 */
export const CHAVES_PERMITIDAS = [
  'etapa',
  'indice',
  'uso',
  'faixa_area',
  'vao',
  'pe_direito',
  'cobertura',
  'fechamento',
  'piso',
  'escopo',
  'terreno',
  'projeto',
  'prazo',
  'uf',
  'estudo_especifico',
  'campo',
  'canal',
  'origem',
  'midia',
  'campanha',
] as const

export type ChavePermitida = (typeof CHAVES_PERMITIDAS)[number]
export type PropsEvento = Partial<Record<ChavePermitida, string | number | boolean>>

/** Remove qualquer chave fora da lista e encurta valores de texto. */
export function filtrarProps(props: Record<string, unknown>): PropsEvento {
  const saida: Record<string, string | number | boolean> = {}
  for (const chave of CHAVES_PERMITIDAS) {
    const v = props[chave]
    if (v === undefined || v === null || v === '') continue
    saida[chave] = typeof v === 'string' ? v.slice(0, LIMITE_VALOR) : typeof v === 'number' || typeof v === 'boolean' ? v : String(v).slice(0, LIMITE_VALOR)
  }
  return saida as PropsEvento
}

/** Faixa de área em vez do número exato: suficiente para análise, menos específico. */
export function faixaDeArea(area: number | undefined): string | undefined {
  if (area === undefined || !Number.isFinite(area)) return undefined
  if (area < 500) return 'ate-500'
  if (area < 1000) return '500-1000'
  if (area < 2500) return '1000-2500'
  if (area < 5000) return '2500-5000'
  if (area < 10000) return '5000-10000'
  return 'acima-10000'
}

/** UF a partir de "Cidade, UF" ou "Cidade/UF". Só a sigla entra no evento. */
export function ufDeCidade(cidade: string | undefined): string | undefined {
  if (!cidade) return undefined
  const m = cidade.toUpperCase().match(/[,/\s-]\s*([A-Z]{2})\s*$/)
  return m ? m[1] : undefined
}

interface Umami {
  track: (evento: string, props?: Record<string, unknown>) => void
}

function provedor(): Umami | undefined {
  return (window as Window & { umami?: Umami }).umami
}

/** Envia um evento, se houver consentimento e provedor. Nunca lança. */
export function registrar(evento: EventoSimulador, props: Record<string, unknown> = {}): void {
  if (!podeRastrear()) return
  try {
    provedor()?.track(evento, filtrarProps(props))
  } catch { /* analytics nunca quebra a tela */ }
}
