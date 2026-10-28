/**
 * Simulador de galpões — parâmetros, validação e leitura técnica.
 *
 * Módulo PURO: sem DOM, sem rede, sem preço. Nenhuma tabela comercial, coeficiente
 * de custo ou cálculo de orçamento vive no frontend — isso é responsabilidade do
 * serviço de pré-engenharia (Fase 02), ver `orcamento.ts`.
 *
 * O que este módulo faz: descreve os campos da configuração, valida o que o
 * visitante informa e compara a configuração com o que a EIFF JÁ EXECUTOU,
 * citando o projeto de referência. Nenhum número aqui é estimado: todos vêm dos
 * cases publicados em /projetos/.
 */

/* ---------------------------------------------------------------
   Catálogos (as únicas opções aceitas)
--------------------------------------------------------------- */

export const USOS = [
  { id: 'industrial', nome: 'Industrial', descricao: 'Planta, ampliação, área produtiva' },
  { id: 'logistico', nome: 'Logística', descricao: 'Centro de distribuição, armazém, hub' },
  { id: 'comercial', nome: 'Comercial', descricao: 'Academia, loja, supermercado' },
  { id: 'agro', nome: 'Agro', descricao: 'Armazenagem, apoio, unidade produtiva' },
  { id: 'especial', nome: 'Estrutura especial', descricao: 'Cobertura, mezanino, passarela' },
] as const

export const COBERTURAS = [
  { id: 'telha-simples', nome: 'Telha metálica simples', descricao: 'Menor custo, sem isolamento' },
  { id: 'termoacustica', nome: 'Telha termoacústica', descricao: 'Conforto térmico e acústico' },
  { id: 'pir', nome: 'Painel PIR', descricao: 'Isolamento contínuo, usado nos cases comerciais' },
  { id: 'indefinido', nome: 'Ainda não sei', descricao: 'A engenharia indica conforme a operação' },
] as const

export const FECHAMENTOS = [
  { id: 'metalico', nome: 'Metálico', descricao: 'Telha ou painel simples nas laterais' },
  { id: 'pir', nome: 'Painel PIR', descricao: 'Isotérmico, para operação climatizada' },
  { id: 'alvenaria', nome: 'Alvenaria', descricao: 'Fechamento civil, total ou parcial' },
  { id: 'aberto', nome: 'Sem fechamento', descricao: 'Apenas cobertura' },
  { id: 'indefinido', nome: 'Ainda não sei', descricao: 'A engenharia indica conforme a operação' },
] as const

export const PISOS = [
  { id: 'leve', nome: 'Leve', descricao: 'Circulação e estoque leve' },
  { id: 'medio', nome: 'Médio', descricao: 'Empilhadeira e movimentação' },
  { id: 'pesado', nome: 'Pesado', descricao: 'Porta-paletes e carga concentrada' },
  { id: 'existente', nome: 'Já existe', descricao: 'Piso executado, cobrir ou ampliar' },
  { id: 'indefinido', nome: 'Ainda não sei', descricao: 'A engenharia dimensiona pela operação' },
] as const

export const ESCOPOS = [
  { id: 'completo', nome: 'Obra completa', descricao: 'Fundações, estrutura, fechamento e interfaces' },
  { id: 'estrutura-fechamento', nome: 'Estrutura e fechamento', descricao: 'Fundações por conta do cliente' },
  { id: 'estrutura', nome: 'Só a estrutura metálica', descricao: 'Fabricação e montagem' },
  { id: 'indefinido', nome: 'Avaliar com a engenharia', descricao: 'Definir no estudo preliminar' },
] as const

export const TERRENOS = [
  { id: 'proprio', nome: 'Já tenho o terreno', descricao: '' },
  { id: 'negociacao', nome: 'Em negociação', descricao: '' },
  { id: 'nao', nome: 'Ainda não tenho', descricao: '' },
] as const

export const PROJETOS = [
  { id: 'executivo', nome: 'Projeto executivo pronto', descricao: '' },
  { id: 'arquitetonico', nome: 'Só o arquitetônico', descricao: '' },
  { id: 'estudo', nome: 'Um estudo ou croqui', descricao: '' },
  { id: 'nenhum', nome: 'Nada ainda', descricao: '' },
] as const

export const PRAZOS = [
  { id: 'urgente', nome: 'O quanto antes', descricao: '' },
  { id: '6-meses', nome: 'Em até 6 meses', descricao: '' },
  { id: '12-meses', nome: 'Em até 12 meses', descricao: '' },
  { id: 'estudando', nome: 'Ainda estudando', descricao: '' },
] as const

type Id<T extends readonly { id: string }[]> = T[number]['id']

export type Uso = Id<typeof USOS>
export type Cobertura = Id<typeof COBERTURAS>
export type Fechamento = Id<typeof FECHAMENTOS>
export type Piso = Id<typeof PISOS>
export type Escopo = Id<typeof ESCOPOS>
export type Terreno = Id<typeof TERRENOS>
export type Projeto = Id<typeof PROJETOS>
export type Prazo = Id<typeof PRAZOS>

/** Configuração técnica do galpão. Nunca carrega dado pessoal. */
export interface ConfiguracaoGalpao {
  uso?: Uso
  vao?: number
  comprimento?: number
  peDireito?: number
  cobertura?: Cobertura
  fechamento?: Fechamento
  piso?: Piso
  escopo?: Escopo
  terreno?: Terreno
  projeto?: Projeto
  prazo?: Prazo
  cidade?: string
  observacao?: string
}

/** Dados de contato. Vivem separados da configuração e nunca vão para analytics. */
export interface Contato {
  nome?: string
  empresa?: string
  email?: string
  telefone?: string
}

/* ---------------------------------------------------------------
   Limites de entrada e referências executadas
--------------------------------------------------------------- */

/** Faixas aceitas no formulário. Fora delas, o campo é recusado. */
export const LIMITES = {
  vao: { min: 6, max: 60, passo: 1 },
  comprimento: { min: 10, max: 400, passo: 5 },
  peDireito: { min: 3, max: 20, passo: 0.5 },
} as const

/**
 * O que a EIFF já executou ou já tem em projeto. Cada número tem um projeto
 * correspondente publicado em /projetos/ — nenhum é estimativa.
 */
export const REFERENCIAS = {
  vaoExecutado: { valor: 32, unidade: 'm', fonte: 'Complexo logístico · Aparecida de Goiânia' },
  vaoEmProjeto: { valor: 40, unidade: 'm', fonte: 'Solução para operação logística' },
  peDireitoExecutado: { valor: 12, unidade: 'm', fonte: 'Complexo logístico · Aparecida de Goiânia' },
  pisoExecutado: { valor: 7, unidade: 't/m²', fonte: 'Complexo logístico · Aparecida de Goiânia' },
  areaComplexo: { valor: 3600, unidade: 'm²', fonte: '3 galpões · Aparecida de Goiânia' },
} as const

/* ---------------------------------------------------------------
   Validação
--------------------------------------------------------------- */

export interface ErroCampo {
  campo: keyof ConfiguracaoGalpao | keyof Contato
  mensagem: string
}

const catalogoTem = (catalogo: readonly { id: string }[], valor: unknown) =>
  typeof valor === 'string' && catalogo.some((o) => o.id === valor)

/** Número informado é finito e está dentro da faixa aceita. */
export function validarMedida(campo: keyof typeof LIMITES, valor: unknown): ErroCampo | null {
  const limite = LIMITES[campo]
  const rotulo = { vao: 'O vão livre', comprimento: 'O comprimento', peDireito: 'O pé-direito' }[campo]
  if (valor === undefined || valor === null || valor === '') return { campo, mensagem: `${rotulo} é obrigatório.` }
  const n = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.'))
  if (!Number.isFinite(n)) return { campo, mensagem: `${rotulo} precisa ser um número.` }
  if (n < limite.min) return { campo, mensagem: `${rotulo} mínimo é ${limite.min} m.` }
  if (n > limite.max) return { campo, mensagem: `${rotulo} máximo do simulador é ${limite.max} m. Acima disso, fale com a engenharia.` }
  return null
}

/** Converte texto de campo numérico em número, aceitando vírgula. `undefined` se vazio. */
export function lerNumero(texto: string | number | undefined | null): number | undefined {
  if (texto === undefined || texto === null || texto === '') return undefined
  const n = typeof texto === 'number' ? texto : Number(String(texto).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Telefone brasileiro: 10 ou 11 dígitos depois de remover máscara e DDI. */
export function validarTelefone(valor: string): boolean {
  const d = valor.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  return d.length === 10 || d.length === 11
}

/** Valida a configuração inteira. Lista vazia = pronta para enviar. */
export function validarConfiguracao(c: ConfiguracaoGalpao): ErroCampo[] {
  const erros: ErroCampo[] = []
  if (!catalogoTem(USOS, c.uso)) erros.push({ campo: 'uso', mensagem: 'Escolha o uso previsto.' })
  for (const campo of ['vao', 'comprimento', 'peDireito'] as const) {
    const erro = validarMedida(campo, c[campo])
    if (erro) erros.push(erro)
  }
  if (c.cobertura !== undefined && !catalogoTem(COBERTURAS, c.cobertura)) erros.push({ campo: 'cobertura', mensagem: 'Opção de cobertura inválida.' })
  if (c.fechamento !== undefined && !catalogoTem(FECHAMENTOS, c.fechamento)) erros.push({ campo: 'fechamento', mensagem: 'Opção de fechamento inválida.' })
  if (c.piso !== undefined && !catalogoTem(PISOS, c.piso)) erros.push({ campo: 'piso', mensagem: 'Opção de piso inválida.' })
  if (c.escopo !== undefined && !catalogoTem(ESCOPOS, c.escopo)) erros.push({ campo: 'escopo', mensagem: 'Opção de escopo inválida.' })
  if (c.terreno !== undefined && !catalogoTem(TERRENOS, c.terreno)) erros.push({ campo: 'terreno', mensagem: 'Opção de terreno inválida.' })
  if (c.projeto !== undefined && !catalogoTem(PROJETOS, c.projeto)) erros.push({ campo: 'projeto', mensagem: 'Opção de projeto inválida.' })
  if (c.prazo !== undefined && !catalogoTem(PRAZOS, c.prazo)) erros.push({ campo: 'prazo', mensagem: 'Opção de prazo inválida.' })
  if (!c.cidade || c.cidade.trim().length < 2) erros.push({ campo: 'cidade', mensagem: 'Informe a cidade e o estado da obra.' })
  return erros
}

/** Valida o contato. Telefone é opcional; e-mail e nome não. */
export function validarContato(c: Contato): ErroCampo[] {
  const erros: ErroCampo[] = []
  if (!c.nome || c.nome.trim().length < 2) erros.push({ campo: 'nome', mensagem: 'Informe seu nome.' })
  if (!c.email || !EMAIL.test(c.email.trim())) erros.push({ campo: 'email', mensagem: 'Informe um e-mail válido.' })
  if (c.telefone && c.telefone.trim() !== '' && !validarTelefone(c.telefone)) {
    erros.push({ campo: 'telefone', mensagem: 'Telefone incompleto. Use DDD e número.' })
  }
  return erros
}

/* ---------------------------------------------------------------
   Geometria e leitura técnica (sem preço)
--------------------------------------------------------------- */

/** Área coberta em m². Geometria do que o visitante digitou, não estimativa. */
export function areaCoberta(c: ConfiguracaoGalpao): number | undefined {
  if (c.vao === undefined || c.comprimento === undefined) return undefined
  return Math.round(c.vao * c.comprimento)
}

export type Nivel = 'ok' | 'atencao' | 'especial'

export interface Observacao {
  id: string
  nivel: Nivel
  texto: string
  fonte?: string
}

/**
 * Compara a configuração com o que a EIFF já executou. Não é orçamento, não é
 * prazo e não é compromisso: é a leitura do que já saiu da fábrica, com o
 * projeto de referência citado.
 */
export function lerConfiguracao(c: ConfiguracaoGalpao): Observacao[] {
  const obs: Observacao[] = []
  const r = REFERENCIAS

  if (c.vao !== undefined) {
    if (c.vao <= r.vaoExecutado.valor) {
      obs.push({ id: 'vao', nivel: 'ok', texto: `Vão de ${formatarMedida(c.vao)} m dentro do que a EIFF já executou (${r.vaoExecutado.valor} m).`, fonte: r.vaoExecutado.fonte })
    } else if (c.vao <= r.vaoEmProjeto.valor) {
      obs.push({ id: 'vao', nivel: 'ok', texto: `Vão de ${formatarMedida(c.vao)} m dentro da solução de ${r.vaoEmProjeto.valor} m que a EIFF tem em projeto.`, fonte: r.vaoEmProjeto.fonte })
    } else {
      obs.push({ id: 'vao', nivel: 'especial', texto: `Vão de ${formatarMedida(c.vao)} m acima dos ${r.vaoEmProjeto.valor} m já projetados. É possível, mas exige estudo estrutural específico.` })
    }
  }

  if (c.peDireito !== undefined) {
    if (c.peDireito <= r.peDireitoExecutado.valor) {
      obs.push({ id: 'pe-direito', nivel: 'ok', texto: `Pé-direito de ${formatarMedida(c.peDireito)} m dentro dos ${r.peDireitoExecutado.valor} m já executados.`, fonte: r.peDireitoExecutado.fonte })
    } else {
      obs.push({ id: 'pe-direito', nivel: 'especial', texto: `Pé-direito de ${formatarMedida(c.peDireito)} m acima dos ${r.peDireitoExecutado.valor} m já executados. Entra como estudo específico.` })
    }
  }

  const area = areaCoberta(c)
  if (area !== undefined && area > r.areaComplexo.valor) {
    obs.push({ id: 'area', nivel: 'atencao', texto: `Área de ${formatarArea(area)} m² acima do maior complexo já entregue (${formatarArea(r.areaComplexo.valor)} m²). A engenharia avalia a implantação por etapas.`, fonte: r.areaComplexo.fonte })
  }

  if (c.piso === 'pesado') {
    obs.push({ id: 'piso', nivel: 'ok', texto: `Piso para carga pesada: a EIFF já executou piso para ${r.pisoExecutado.valor} ${r.pisoExecutado.unidade}.`, fonte: r.pisoExecutado.fonte })
  }

  if (c.uso === 'especial') {
    obs.push({ id: 'uso', nivel: 'atencao', texto: 'Estruturas especiais são dimensionadas caso a caso, a partir do projeto arquitetônico.' })
  }

  if (c.terreno === 'nao') {
    obs.push({ id: 'terreno', nivel: 'atencao', texto: 'Sem terreno definido, o estudo preliminar trabalha com implantação hipotética e é revisto depois.' })
  }

  return obs
}

/** Precisa de estudo específico quando qualquer observação for de nível especial. */
export function exigeEstudoEspecifico(obs: Observacao[]): boolean {
  return obs.some((o) => o.nivel === 'especial')
}

/* ---------------------------------------------------------------
   Formatação (pt-BR)
--------------------------------------------------------------- */

const fmtArea = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const fmtMedida = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

export const formatarArea = (n: number) => fmtArea.format(n)
export const formatarMedida = (n: number) => fmtMedida.format(n)

/** Resumo em uma linha, para o cabeçalho do painel e para o corpo do lead. */
export function resumoConfiguracao(c: ConfiguracaoGalpao): string {
  const partes: string[] = []
  const uso = USOS.find((u) => u.id === c.uso)
  if (uso) partes.push(uso.nome)
  const area = areaCoberta(c)
  if (area !== undefined) partes.push(`${formatarArea(area)} m²`)
  if (c.vao !== undefined) partes.push(`vão ${formatarMedida(c.vao)} m`)
  if (c.peDireito !== undefined) partes.push(`pé-direito ${formatarMedida(c.peDireito)} m`)
  if (c.cidade) partes.push(c.cidade.trim())
  return partes.join(' · ')
}

/** Nome legível de uma opção escolhida, para resumo e para o corpo do lead. */
export function nomeOpcao(catalogo: readonly { id: string; nome: string }[], id: string | undefined): string {
  return catalogo.find((o) => o.id === id)?.nome ?? '—'
}
