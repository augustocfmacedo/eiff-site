/**
 * Tela do simulador: liga o núcleo puro ao DOM.
 *
 * Aprimoramento progressivo: o HTML já traz o formulário inteiro e funcional.
 * Este módulo transforma as seções em etapas, valida, desenha o croqui e envia.
 * Se qualquer peça faltar, a tela continua um formulário comum.
 */

import {
  type ConfiguracaoGalpao, type Contato, type Observacao,
  areaCoberta, exigeEstudoEspecifico, formatarArea, formatarMedida, lerConfiguracao,
  lerNumero, resumoConfiguracao,
} from './parametros'
import {
  ETAPAS, TOTAL_ETAPAS, type EstadoSimulador, type IdEtapa,
  avancar, definirConfiguracao, definirContato, erroDoCampo, estadoInicial,
  etapaPorId, irPara, podeEnviar, progresso, validarEtapa, voltar,
} from './fluxo'
import { MOLDURA_PADRAO, desenharPortico } from './croqui'
import { MOTIVO_INDISPONIVEL, PROVEDOR_INDISPONIVEL, type ProvedorPreEngenharia } from './orcamento'
import {
  capturarOrigem, faixaDeArea, guardarOrigem, lerOrigem, origemEmTexto, registrar, ufDeCidade,
} from './analytics'
import { ESCOPO_PADRONIZADO, type DeclaracaoDeTipologia } from './enquadramento'
import { linhasDoResumo, montarApresentacaoPublica, rotulosDaTipologia, type ApresentacaoPublica } from './apresentacao'
import { ilustracaoVolumetrica, implantacaoConceitual } from './ilustracao'
import { AVISO_DO_ENQUADRAMENTO, especificacaoDoLead, textoDoEnquadramento } from './especificacao'

type Vista = 'volume' | 'planta' | 'corte'

const CAMPOS_CONTATO = ['nome', 'empresa', 'email', 'telefone'] as const
const CAMPOS_NUMERO = ['vao', 'comprimento', 'peDireito'] as const
type CampoContato = (typeof CAMPOS_CONTATO)[number]

const ehContato = (nome: string): nome is CampoContato => (CAMPOS_CONTATO as readonly string[]).includes(nome)

export interface OpcoesTela {
  provedor?: ProvedorPreEngenharia
  /** Rolagem suave do app; ausente, usa a nativa. */
  scrollPara?: (alvo: HTMLElement | number, opts?: { offset?: number }) => void
  reduzMovimento?: boolean
}

export function iniciarSimulador(raiz: Document | HTMLElement = document, opcoes: OpcoesTela = {}): void {
  const form = raiz.querySelector<HTMLFormElement>('#sim')
  if (!form) return

  const provedor = opcoes.provedor ?? PROVEDOR_INDISPONIVEL
  const reduz = opcoes.reduzMovimento ?? false

  const secoes = new Map<IdEtapa, HTMLElement>()
  raiz.querySelectorAll<HTMLElement>('[data-etapa]').forEach((s) => secoes.set(s.dataset.etapa as IdEtapa, s))
  if (secoes.size === 0) return

  const passos = raiz.querySelector<HTMLElement>('#simPassos')
  const barra = raiz.querySelector<HTMLElement>('#simProgresso')
  const contador = raiz.querySelector<HTMLElement>('#simContador')
  const btVoltar = raiz.querySelector<HTMLButtonElement>('#simVoltar')
  const btAvancar = raiz.querySelector<HTMLButtonElement>('#simAvancar')
  const btEnviar = raiz.querySelector<HTMLButtonElement>('#simEnviar')
  const painelResumo = raiz.querySelector<HTMLElement>('#simResumo')
  const painelObs = raiz.querySelector<HTMLElement>('#simObs')
  const painelArea = raiz.querySelector<HTMLElement>('#simArea')
  const caixaTipologia = raiz.querySelector<HTMLElement>('#simTipologia')
  const opcoesTipologia = raiz.querySelector<HTMLElement>('#simTipologiaOpcoes')
  const botoesVista = raiz.querySelector<HTMLElement>('#simVistas')
  const ilustracao = raiz.querySelector<HTMLElement>('#simIlustracao')
  const avisoIlustracao = raiz.querySelector<HTMLElement>('#simIlustracaoAviso')
  const caixaEnquadramento = raiz.querySelector<HTMLElement>('#simEnquadramento')
  const caixaSolicitacao = raiz.querySelector<HTMLElement>('#simSolicitacao')
  const regras = ESCOPO_PADRONIZADO

  /*
   * Tipologia declarada e vista da ilustração. Ficam FORA do estado do fluxo de
   * propósito: não são campos do formulário (as caixas não têm `name`, então o
   * Netlify não as registra) e não bloqueiam nenhuma etapa. O que delas segue
   * para o lead vai dentro de `especificacao`.
   */
  let tipologiaMarcada: string[] = []
  let tipologiaNenhuma = false
  let vista: Vista = 'volume'
  let enquadramentoDesenhado = ''
  const declaracao = (): DeclaracaoDeTipologia | null =>
    tipologiaMarcada.length === 0 && !tipologiaNenhuma ? null : { itens: [...tipologiaMarcada], nenhumaDasAnteriores: tipologiaNenhuma }
  const painelCumeeira = raiz.querySelector<HTMLElement>('#simCumeeira')
  const svg = raiz.querySelector<SVGSVGElement>('#simCroqui')
  const nota = raiz.querySelector<HTMLElement>('#simNota')
  const sucesso = raiz.querySelector<HTMLElement>('#simSucesso')

  /**
   * O HTML é a fonte inicial: os campos já vêm com valor padrão e o navegador
   * pode ter restaurado o que o visitante digitou antes (voltar, autopreencher).
   * Sem isto, o painel nasceria vazio e avançar sem tocar nas dimensões falharia.
   */
  const lerFormulario = (): { configuracao: ConfiguracaoGalpao; contato: Contato } => {
    const configuracao: ConfiguracaoGalpao = {}
    const contato: Contato = {}
    for (const el of Array.from(form.elements)) {
      const campo = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      const nome = campo.name
      if (!nome || campo.type === 'hidden' || nome === 'empresa-site' || nome === 'form-name') continue
      if (campo.type === 'radio' && !(campo as HTMLInputElement).checked) continue
      const valor = campo.value
      if (valor === '') continue
      if (ehContato(nome)) Object.assign(contato, { [nome]: valor })
      else if ((CAMPOS_NUMERO as readonly string[]).includes(nome)) Object.assign(configuracao, { [nome]: lerNumero(valor) })
      else Object.assign(configuracao, { [nome]: valor })
    }
    return { configuracao, contato }
  }

  const inicial = lerFormulario()
  let estado: EstadoSimulador = { ...estadoInicial(inicial.configuracao), contato: inicial.contato }

  /* -------------------------------------------------------------
     Origem da campanha (sessão, sem cookie, com consentimento)
  ------------------------------------------------------------- */
  const origemDaUrl = capturarOrigem(window.location.search, document.referrer)
  guardarOrigem(origemDaUrl)
  const origem = { ...lerOrigem(), ...origemDaUrl }

  registrar('simulador_inicio', { origem: origem.source, midia: origem.medium, campanha: origem.campaign })

  /* -------------------------------------------------------------
     Leitura do formulário para o estado
  ------------------------------------------------------------- */
  const lerControle = (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): void => {
    const nome = el.name
    if (!nome) return
    if (ehContato(nome)) {
      estado = definirContato(estado, { [nome]: el.value } as Partial<Contato>)
      return
    }
    if ((CAMPOS_NUMERO as readonly string[]).includes(nome)) {
      estado = definirConfiguracao(estado, { [nome]: lerNumero(el.value) } as Partial<ConfiguracaoGalpao>)
      return
    }
    estado = definirConfiguracao(estado, { [nome]: el.value || undefined } as Partial<ConfiguracaoGalpao>)
  }

  /** Sincroniza o par número + deslizador que compartilham o mesmo campo. */
  const espelharMedida = (nome: string, valor: string): void => {
    form.querySelectorAll<HTMLInputElement>(`[name="${nome}"], [data-espelho="${nome}"]`).forEach((outro) => {
      if (outro.value !== valor) outro.value = valor
    })
  }

  form.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement
    if (!el.name && !el.dataset.espelho) return
    const nome = el.name || el.dataset.espelho!
    if ((CAMPOS_NUMERO as readonly string[]).includes(nome)) espelharMedida(nome, el.value)
    if (!el.name) {
      const principal = form.querySelector<HTMLInputElement>(`[name="${nome}"]`)
      if (principal) lerControle(principal)
    } else {
      lerControle(el)
    }
    desenhar()
  })

  form.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement
    if (!el.name) return
    lerControle(el)
    // Escolher o uso no primeiro passo já avança: menos cliques no celular.
    if (el.name === 'uso' && estado.etapa === 'uso' && el.type === 'radio') {
      window.setTimeout(() => irAdiante(), reduz ? 0 : 160)
      return
    }
    desenhar()
  })

  /* -------------------------------------------------------------
     Tipologia e vistas da ilustração
  ------------------------------------------------------------- */
  if (caixaTipologia && opcoesTipologia) {
    const opcao = (atributo: string, rotulo: string, extra = '') =>
      `<label class="sim-tipologia__opcao${extra}"><input type="checkbox" ${atributo}><span>${escapar(rotulo)}</span></label>`
    opcoesTipologia.innerHTML = regras.tipologiasForaDoPadrao.map((t) => opcao(`data-tipologia="${escapar(t.id)}"`, t.rotulo)).join('')
      + opcao('data-tipologia-nenhuma', 'Nenhuma das anteriores', ' sim-tipologia__opcao--nenhuma')
    caixaTipologia.hidden = false
    // «Nenhuma das anteriores» e as características se excluem: marcar uma desmarca a outra.
    opcoesTipologia.addEventListener('change', (e) => {
      const el = e.target as HTMLInputElement
      const caixas = Array.from(opcoesTipologia.querySelectorAll<HTMLInputElement>('[data-tipologia]'))
      const nenhumaEl = opcoesTipologia.querySelector<HTMLInputElement>('[data-tipologia-nenhuma]')
      if (el.hasAttribute('data-tipologia-nenhuma') && el.checked) caixas.forEach((c) => { c.checked = false })
      if (el.hasAttribute('data-tipologia') && el.checked && nenhumaEl) nenhumaEl.checked = false
      tipologiaMarcada = caixas.filter((c) => c.checked).map((c) => c.dataset.tipologia!)
      tipologiaNenhuma = nenhumaEl?.checked ?? false
      atualizarResumo()
    })
  }

  if (botoesVista && ilustracao) {
    botoesVista.hidden = false
    ilustracao.hidden = false
    if (avisoIlustracao) avisoIlustracao.hidden = false
    botoesVista.addEventListener('click', (e) => {
      const bt = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-vista]')
      if (!bt) return
      vista = bt.dataset.vista as Vista
      atualizarResumo()
    })
  }

  /* -------------------------------------------------------------
     Navegação entre etapas
  ------------------------------------------------------------- */
  const focarEtapa = (id: IdEtapa): void => {
    const secao = secoes.get(id)
    const titulo = secao?.querySelector<HTMLElement>('[data-foco]')
    titulo?.focus({ preventScroll: true })
    const topo = form.getBoundingClientRect().top + window.scrollY - 96
    if (window.scrollY > topo + 8) {
      if (opcoes.scrollPara) opcoes.scrollPara(topo)
      else window.scrollTo({ top: topo, behavior: reduz ? 'auto' : 'smooth' })
    }
  }

  const irAdiante = (): void => {
    const anterior = estado.etapa
    const proximo = avancar(estado)
    if (proximo.erros.length > 0) {
      estado = proximo
      desenhar()
      registrar('simulador_etapa_erro', { etapa: anterior, campo: proximo.erros[0]?.campo })
      const primeiro = form.querySelector<HTMLElement>(`[name="${proximo.erros[0]?.campo}"]`)
      primeiro?.focus()
      return
    }
    estado = proximo
    desenhar()
    if (estado.etapa !== anterior) {
      const e = etapaPorId(estado.etapa)
      registrar('simulador_etapa', { etapa: estado.etapa, indice: e.indice + 1, uso: estado.configuracao.uso })
      focarEtapa(estado.etapa)
      if (estado.etapa === 'contato') {
        const area = areaCoberta(estado.configuracao)
        registrar('simulador_resumo', {
          uso: estado.configuracao.uso,
          faixa_area: faixaDeArea(area),
          vao: estado.configuracao.vao,
          pe_direito: estado.configuracao.peDireito,
          uf: ufDeCidade(estado.configuracao.cidade),
          estudo_especifico: exigeEstudoEspecifico(lerConfiguracao(estado.configuracao)),
        })
      }
    }
  }

  const irAtras = (): void => {
    const anterior = estado.etapa
    estado = voltar(estado)
    desenhar()
    if (estado.etapa !== anterior) focarEtapa(estado.etapa)
  }

  /**
   * No celular o painel fica depois do formulário, longe dos campos. Na etapa de
   * dimensões ele é movido para junto dos controles, para o croqui responder à
   * vista do visitante enquanto ele ajusta. Em tela larga nada muda.
   */
  const leitura = raiz.querySelector<HTMLElement>('.sim-leitura')
  const grade = raiz.querySelector<HTMLElement>('.sim-grid')
  const telaEstreita = window.matchMedia('(max-width: 899px)')
  const posicionarLeitura = (): void => {
    const destinoDimensoes = secoes.get('dimensoes')
    if (!leitura || !grade || !destinoDimensoes) return
    const juntoDosCampos = telaEstreita.matches && estado.etapa === 'dimensoes'
    const destino = juntoDosCampos ? destinoDimensoes : grade
    if (leitura.parentElement !== destino) destino.appendChild(leitura)
    leitura.classList.toggle('sim-leitura--embutida', juntoDosCampos)
  }
  telaEstreita.addEventListener('change', () => posicionarLeitura())

  btAvancar?.addEventListener('click', (e) => { e.preventDefault(); irAdiante() })
  btVoltar?.addEventListener('click', (e) => { e.preventDefault(); irAtras() })

  passos?.addEventListener('click', (e) => {
    const alvo = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-ir]')
    if (!alvo) return
    e.preventDefault()
    const id = alvo.dataset.ir as IdEtapa
    const antes = estado.etapa
    estado = irPara(estado, id)
    desenhar()
    if (estado.etapa !== antes) focarEtapa(estado.etapa)
  })

  // Enter em campo de texto avança em vez de enviar o formulário cedo demais.
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    const el = e.target as HTMLElement
    if (el instanceof HTMLTextAreaElement) return
    if (estado.etapa !== 'contato') { e.preventDefault(); irAdiante() }
  })

  /* -------------------------------------------------------------
     Desenho da tela a partir do estado
  ------------------------------------------------------------- */
  const desenhar = (): void => {
    const atual = etapaPorId(estado.etapa)

    secoes.forEach((secao, id) => {
      const ativa = id === estado.etapa
      secao.removeAttribute('data-oculta')
      secao.hidden = !ativa
      secao.classList.toggle('is-ativa', ativa)
    })

    posicionarLeitura()

    if (passos) {
      passos.querySelectorAll<HTMLButtonElement>('[data-ir]').forEach((b) => {
        const id = b.dataset.ir as IdEtapa
        const etapa = etapaPorId(id)
        const concluida = estado.concluidas.includes(id)
        const ativa = id === estado.etapa
        b.classList.toggle('is-ativa', ativa)
        b.classList.toggle('is-ok', concluida && !ativa)
        b.disabled = !concluida && etapa.indice > atual.indice
        if (ativa) b.setAttribute('aria-current', 'step')
        else b.removeAttribute('aria-current')
      })
    }

    const p = Math.max(progresso(estado), atual.indice / TOTAL_ETAPAS)
    if (barra) {
      barra.style.setProperty('--p', String(p))
      barra.setAttribute('aria-valuenow', String(Math.round(p * 100)))
    }
    if (contador) contador.textContent = `Etapa ${atual.indice + 1} de ${TOTAL_ETAPAS}`

    // Erros por campo.
    form.querySelectorAll<HTMLElement>('[data-erro]').forEach((el) => {
      const campo = el.dataset.erro!
      const msg = erroDoCampo(estado, campo)
      el.textContent = msg ?? ''
      el.hidden = !msg
      form.querySelectorAll<HTMLElement>(`[name="${campo}"]`).forEach((c) => {
        if (msg) c.setAttribute('aria-invalid', 'true')
        else c.removeAttribute('aria-invalid')
      })
    })

    if (btVoltar) btVoltar.hidden = atual.indice === 0
    if (btAvancar) btAvancar.hidden = estado.etapa === 'contato'
    if (btEnviar) {
      btEnviar.hidden = estado.etapa !== 'contato'
      btEnviar.disabled = false
    }

    atualizarResumo()
  }

  const atualizarResumo = (): void => {
    const c = estado.configuracao
    const area = areaCoberta(c)

    if (painelResumo) painelResumo.textContent = resumoConfiguracao(c) || 'Configure os primeiros campos'
    if (painelArea) painelArea.textContent = area !== undefined ? `${formatarArea(area)} m²` : '—'

    if (svg && c.vao !== undefined && c.peDireito !== undefined) {
      const croqui = desenharPortico({ vao: c.vao, peDireito: c.peDireito }, MOLDURA_PADRAO)
      const por = (id: string, d: string) => svg.querySelector<SVGPathElement>(`#${id}`)?.setAttribute('d', d)
      por('cqPilares', croqui.pilares)
      por('cqCobertura', croqui.cobertura)
      por('cqAlma', croqui.alma)
      por('cqSolo', croqui.solo)
      por('cqCotaVao', croqui.cotaVao.caminho)
      por('cqCotaPe', croqui.cotaPeDireito.caminho)
      const texto = (id: string, conteudo: string, x: number, y: number) => {
        const t = svg.querySelector<SVGTextElement>(`#${id}`)
        if (!t) return
        t.textContent = conteudo
        t.setAttribute('x', String(x))
        t.setAttribute('y', String(y))
      }
      texto('cqTextoVao', `${formatarMedida(c.vao)} m`, croqui.cotaVao.x, croqui.cotaVao.y)
      texto('cqTextoPe', `${formatarMedida(c.peDireito)} m`, croqui.cotaPeDireito.x, croqui.cotaPeDireito.y)
      // Com as vistas ativas, o corte só aparece quando é a vista escolhida.
      svg.toggleAttribute('hidden', Boolean(botoesVista && ilustracao) && vista !== 'corte')
      if (painelCumeeira) painelCumeeira.textContent = `${formatarMedida(croqui.alturaCumeeira)} m`
    }

    if (painelObs) {
      const obs = lerConfiguracao(c)
      painelObs.innerHTML = obs.length === 0
        ? '<li class="sim__obs-vazio">A leitura técnica aparece conforme você configura.</li>'
        : obs.map(linhaObs).join('')
    }

    desenharComercial()
  }

  /**
   * Ilustração, enquadramento e resumo da solicitação. Tudo sai do objeto de
   * apresentação, que só aceita o que o visitante declarou; se ele não puder ser
   * montado com segurança, esses blocos somem e o formulário segue como antes.
   */
  const desenharComercial = (): void => {
    const entrega = montarApresentacaoPublica(estado.configuracao, declaracao(), regras)
    const a = entrega.ok ? entrega.apresentacao : null

    if (botoesVista && ilustracao) {
      botoesVista.querySelectorAll<HTMLButtonElement>('[data-vista]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vista === vista)))
      ilustracao.dataset.vistaAtual = vista
      const desenho = !a ? null : vista === 'volume' ? ilustracaoVolumetrica(a.configuracao) : vista === 'planta' ? implantacaoConceitual(a.configuracao) : null
      const cfg = a?.configuracao
      const cotas = !desenho || !cfg ? '' : vista === 'volume'
        ? `vão ${formatarMedida(cfg.vao!)} m · comprimento ${formatarMedida(cfg.comprimento!)} m · pé-direito ${formatarMedida(cfg.peDireito!)} m`
        : `${formatarMedida(cfg.vao!)} × ${formatarMedida(cfg.comprimento!)} m · ${formatarArea(areaCoberta(cfg)!)} m² de projeção`
      ilustracao.innerHTML = desenho
        ? `${desenho}<p class="sim-ilu__cotas" aria-hidden="true">${escapar(cotas)} · ilustração</p>`
        : (vista === 'corte' ? '' : '<p class="sim-ilu__vazio">Informe vão, comprimento e pé-direito para ver a ilustração.</p>')
      ilustracao.hidden = vista === 'corte'
      svg?.toggleAttribute('hidden', vista !== 'corte')
    }
    if (caixaEnquadramento) {
      // Antes de a configuração estar completa, o enquadramento não diz nada útil: fica oculto.
      caixaEnquadramento.hidden = !a || a.enquadramento.classe === 'CONFIGURACAO_INCOMPLETA'
      // Região anunciada por leitor de tela: só é reescrita quando o texto muda, não a cada tecla.
      const novo = a ? blocoEnquadramento(a) : ''
      if (enquadramentoDesenhado !== novo) {
        caixaEnquadramento.innerHTML = novo
        enquadramentoDesenhado = novo
      }
    }
    if (caixaSolicitacao) {
      caixaSolicitacao.hidden = !a
      caixaSolicitacao.innerHTML = a ? blocoSolicitacao(a) : ''
    }
  }

  const blocoEnquadramento = (a: ApresentacaoPublica): string => {
    // O cartão só aparece com a configuração completa, então os motivos nunca são erros de preenchimento.
    const t = textoDoEnquadramento(a, regras)
    const classe = a.enquadramento.classe
    const motivos = t.motivos
    return `<span class="eyebrow">Enquadramento${t.provisorio ? ' preliminar' : ''}</span>
      <p class="sim-enquadramento__titulo" data-classe="${classe}">${escapar(t.titulo)}</p>
      ${motivos.length ? `<ul class="sim-enquadramento__motivos">${motivos.map((m) => `<li>${escapar(m)}</li>`).join('')}</ul>` : ''}
      <p class="sim-enquadramento__passo">${escapar(t.proximoPasso)}</p>
      <p class="sim-enquadramento__aviso">${escapar(AVISO_DO_ENQUADRAMENTO)} ${escapar(t.regras)}</p>`
  }

  const blocoSolicitacao = (a: ApresentacaoPublica): string => {
    const t = textoDoEnquadramento(a, regras)
    const tipologia = rotulosDaTipologia(a, regras)
    const linhas = [
      ...linhasDoResumo(a),
      { rotulo: 'Características', valor: tipologia.length ? tipologia.join('; ') : 'não informadas' },
      { rotulo: 'Enquadramento', valor: t.titulo },
    ]
    return `<h3 class="sim-solicitacao__titulo">O que segue para a engenharia</h3>
      <dl class="sim-solicitacao__lista">${linhas.map((l) => `<div><dt>${escapar(l.rotulo)}</dt><dd>${escapar(l.valor)}</dd></div>`).join('')}</dl>`
  }


  const linhaObs = (o: Observacao): string => {
    const fonte = o.fonte ? `<span class="sim__obs-fonte">${escapar(o.fonte)}</span>` : ''
    return `<li class="sim__obs-item" data-nivel="${o.nivel}"><span class="sim__obs-marca" aria-hidden="true"></span><span>${escapar(o.texto)}${fonte}</span></li>`
  }

  /* -------------------------------------------------------------
     Envio (canal atual: Netlify Forms; orçamento vem da Fase 02)
  ------------------------------------------------------------- */
  const preencherOcultos = (): void => {
    const c = estado.configuracao
    const area = areaCoberta(c)
    const obs = lerConfiguracao(c)
    const definir = (nome: string, valor: string) => {
      const el = form.querySelector<HTMLInputElement>(`input[name="${nome}"][type="hidden"]`)
      if (el) el.value = valor
    }
    definir('area', area !== undefined ? `${formatarArea(area)} m²` : '')
    definir('resumo', resumoConfiguracao(c))
    // Os mesmos itens de antes, e no fim a tipologia declarada e o enquadramento comercial.
    definir('especificacao', especificacaoDoLead(c, declaracao(), regras))
    // A fonte acompanha cada afirmação também no lead. No painel ela já aparecia
    // sob a linha; aqui era descartada, e a mesma frase chegava ao comercial sem
    // a obra que a sustenta — que é exatamente o que não pode acontecer.
    definir('leitura', obs.map((o) => `[${o.nivel}] ${o.texto}${o.fonte ? ` (${o.fonte})` : ''}`).join(' | '))
    definir('estudo_especifico', exigeEstudoEspecifico(obs) ? 'sim' : 'nao')
    definir('origem', origemEmTexto(origem))
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const erros = validarEtapa('contato', estado)
    if (erros.length > 0 || !podeEnviar(estado)) {
      estado = avancar(estado)
      desenhar()
      return
    }

    preencherOcultos()
    if (btEnviar) {
      btEnviar.disabled = true
      const rotulo = btEnviar.querySelector('span')
      if (rotulo) rotulo.textContent = 'Enviando…'
    }

    try {
      const dados = new FormData(form)
      const r = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(dados as unknown as Record<string, string>).toString(),
      })
      if (!r.ok) throw new Error(String(r.status))
      estado = { ...estado, enviado: true }
      form.classList.add('is-sent')
      sucesso?.removeAttribute('hidden')
      sucesso?.querySelector<HTMLElement>('[data-foco]')?.focus({ preventScroll: true })
      registrar('simulador_envio', {
        uso: estado.configuracao.uso,
        faixa_area: faixaDeArea(areaCoberta(estado.configuracao)),
        uf: ufDeCidade(estado.configuracao.cidade),
        escopo: estado.configuracao.escopo,
        prazo: estado.configuracao.prazo,
        estudo_especifico: exigeEstudoEspecifico(lerConfiguracao(estado.configuracao)),
      })
    } catch {
      if (btEnviar) {
        btEnviar.disabled = false
        const rotulo = btEnviar.querySelector('span')
        if (rotulo) rotulo.textContent = 'Tentar novamente'
      }
      if (nota) {
        nota.textContent = 'Não foi possível enviar agora. Tente novamente ou escreva para contato@eiff.com.br.'
        nota.classList.add('sim__nota--erro')
      }
      registrar('simulador_envio_erro')
    }
  })

  // Canais alternativos preservados: contam como saída do funil.
  raiz.querySelectorAll<HTMLAnchorElement>('[data-canal]').forEach((a) => {
    a.addEventListener('click', () => registrar('simulador_contato_alternativo', { canal: a.dataset.canal, etapa: estado.etapa }))
  })

  // Enquanto não há pré-engenharia automática, a tela diz isso com todas as letras.
  const avisoOrcamento = raiz.querySelector<HTMLElement>('#simAvisoOrcamento')
  if (avisoOrcamento && !provedor.disponivel()) avisoOrcamento.textContent = MOTIVO_INDISPONIVEL

  // Com JS, a validação é nossa: a nativa tentaria focar campo de etapa oculta.
  form.noValidate = true
  form.classList.add('sim--progressivo')
  desenhar()
}

function escapar(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)
}
