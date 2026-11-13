import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { LIMITES, type ConfiguracaoGalpao } from './parametros'
import { CLASSES, ESCOPO_PADRONIZADO, enquadrar, fraseDoMotivo, regrasLegiveis, tituloDaClasse, type DeclaracaoDeTipologia, type RegrasDeEscopo } from './enquadramento'
import { AVISO_DA_ILUSTRACAO, TEXTO_DO_DESENHO, caixaDoRotulo, dimensoesParaDesenho, ilustracaoVolumetrica, implantacaoConceitual } from './ilustracao'
import { CAMPOS_PUBLICOS, montarApresentacaoPublica, violacoesDaApresentacao, type ApresentacaoPublica } from './apresentacao'
import { SEPARADOR, TAMANHO_MAXIMO_DA_ESPECIFICACAO, especificacaoDoLead, itensAtuaisDaEspecificacao, itensDoEnquadramento, textoDoEnquadramento } from './especificacao'

const RAIZ = resolve(__dirname, '..', '..')
const ler = (...p: string[]) => readFileSync(resolve(RAIZ, ...p), 'utf8')
const HTML = ler('simular-galpao.html')

/* Dados de teste montados à mão. Nenhum é saída de cálculo. */
const CONFIG: ConfiguracaoGalpao = { uso: 'industrial', vao: 20, comprimento: 60, peDireito: 6, cidade: 'Goiânia, GO', cobertura: 'indefinido', fechamento: 'indefinido', piso: 'indefinido', escopo: 'indefinido', terreno: 'proprio', projeto: 'nenhum', prazo: 'estudando' }
const NENHUMA: DeclaracaoDeTipologia = { itens: [], nenhumaDasAnteriores: true }
const com = (...itens: string[]): DeclaracaoDeTipologia => ({ itens, nenhumaDasAnteriores: false })
const APROVADAS: RegrasDeEscopo = { ...ESCOPO_PADRONIZADO, versao: 'escopo-de-teste-aprovado', situacao: 'APROVADA' }
const apresentar = (c: ConfiguracaoGalpao, d: DeclaracaoDeTipologia | null, regras: RegrasDeEscopo | null = ESCOPO_PADRONIZADO): ApresentacaoPublica => {
  const e = montarApresentacaoPublica(c, d, regras)
  if (!e.ok) throw new Error('apresentação retida: ' + e.violacoes.join('; '))
  return e.apresentacao
}
const frases = (c: ConfiguracaoGalpao, d: DeclaracaoDeTipologia | null, regras: RegrasDeEscopo = ESCOPO_PADRONIZADO) => {
  const e = enquadrar(c, d, regras)
  return e.motivos.map((m) => fraseDoMotivo(m, e.situacaoDasRegras, regras))
}

describe('enquadramento comercial', () => {
  it('as quatro leituras se distinguem, e enquadrar nunca aprova', () => {
    const casos = [
      [enquadrar({ vao: 20 }, NENHUMA), 'CONFIGURACAO_INCOMPLETA'],
      [enquadrar(CONFIG, NENHUMA), 'DENTRO_DO_ESCOPO_PADRONIZADO'],
      [enquadrar({ ...CONFIG, vao: 40 }, NENHUMA), 'FORA_DO_ESCOPO_AUTOMATIZADO'],
      [enquadrar(CONFIG, null), 'TIPOLOGIA_NAO_DECLARADA'],
      [enquadrar(CONFIG, com('mezanino')), 'TIPOLOGIA_NAO_SUPORTADA'],
      [enquadrar(CONFIG, NENHUMA, null), 'ENQUADRAMENTO_INDISPONIVEL'],
    ] as const
    for (const [e, classe] of casos) {
      expect(e.classe).toBe(classe)
      expect(e.aprovacaoEstrutural).toBe(false)
      expect(e.aptidaoParaProcessamentoEstrutural).toBe('NAO_DETERMINADA')
    }
    expect(new Set(casos.map(([e]) => e.classe))).toEqual(new Set(CLASSES))
  })
  it('as faixas do configurador são mais largas que as do estudo padronizado, e a diferença vira encaminhamento', () => {
    const f = ESCOPO_PADRONIZADO.faixas
    expect(LIMITES.vao.max).toBeGreaterThan(f.vao.max)
    expect(LIMITES.peDireito.max).toBeGreaterThan(f.peDireito.max)
    expect(enquadrar({ ...CONFIG, vao: 40 }, NENHUMA)).toMatchObject({ configuracaoComercialValida: true, encaminhamento: 'ATENDIMENTO_TECNICO', motivos: [{ regra: 'faixa', campo: 'vao', informado: 40, min: 10, max: 35 }] })
    expect(enquadrar({ ...CONFIG, vao: f.vao.max }, NENHUMA).classe).toBe('DENTRO_DO_ESCOPO_PADRONIZADO')
  })
  it('regras provisórias falam no condicional; só regras aprovadas falam no afirmativo', () => {
    expect(ESCOPO_PADRONIZADO.situacao).toBe('PROVISORIA')
    expect(frases({ ...CONFIG, vao: 40 }, NENHUMA)).toEqual(['Vão livre de 40 m: em princípio, o estudo padronizado cobre de 10 a 35 m.'])
    expect(frases({ ...CONFIG, vao: 40 }, NENHUMA, APROVADAS)).toEqual(['Vão livre de 40 m: o estudo padronizado cobre de 10 a 35 m.'])
    expect(tituloDaClasse('DENTRO_DO_ESCOPO_PADRONIZADO', 'PROVISORIA')).toBe('Indicação preliminar: tende a caber no estudo padronizado')
    expect(tituloDaClasse('DENTRO_DO_ESCOPO_PADRONIZADO', 'APROVADA')).toBe('Dentro do escopo de estudo padronizado')
    const t = textoDoEnquadramento(apresentar(CONFIG, NENHUMA), ESCOPO_PADRONIZADO)
    expect(t).toMatchObject({ provisorio: true, regras: 'Regras de escopo escopo-padronizado-0, provisórias.' })
    expect(t.proximoPasso).toMatch(/^O pedido tende a seguir como estudo preliminar padronizado/)
  })
  it('tipologia: cada item tira do padrão; desconhecida e contraditória não passam caladas', () => {
    for (const t of ESCOPO_PADRONIZADO.tipologiasForaDoPadrao) expect(enquadrar(CONFIG, com(t.id)).motivos).toEqual([{ regra: 'tipologia.item', tipologia: t.id }])
    expect(enquadrar(CONFIG, com('silo')).motivos).toEqual([{ regra: 'tipologia.desconhecida' }])
    expect(enquadrar(CONFIG, { itens: ['mezanino'], nenhumaDasAnteriores: true }).motivos).toEqual([{ regra: 'tipologia.contraditoria' }])
  })
  it('sem tipologia declarada não há conclusão de tipologia suportada, em lugar nenhum', () => {
    for (const c of [CONFIG, { ...CONFIG, vao: 40 }, { ...CONFIG, uso: 'especial' as const }]) {
      const e = enquadrar(c, null)
      expect(e.classe).toBe('TIPOLOGIA_NAO_DECLARADA')
      const a = apresentar(c, null)
      const t = textoDoEnquadramento(a, ESCOPO_PADRONIZADO)
      const tudo = [t.titulo, ...t.motivos, t.proximoPasso, especificacaoDoLead(c, null)].join(' ')
      expect(tudo).not.toMatch(/tende a caber|Dentro do escopo|cabe no formato|suportad/i)
      expect(t.titulo).toBe('Tipologia ainda não declarada')
      expect(t.proximoPasso).toBe('Responda às características do galpão para ver o enquadramento. Sem resposta, o pedido segue normalmente para a engenharia.')
      expect(especificacaoDoLead(c, null)).toMatch(/ · Tipologia declarada: não declarada · Enquadramento comercial \(regras provisórias escopo-padronizado-0\): Tipologia ainda não declarada$/)
    }
  })
  it('regras ilegíveis: indisponível, nunca «dentro»', () => {
    for (const r of [null, {}, { ...ESCOPO_PADRONIZADO, versao: '' }, { ...ESCOPO_PADRONIZADO, faixas: undefined }]) {
      expect(regrasLegiveis(r)).toBe(false)
      expect(enquadrar(CONFIG, NENHUMA, r as RegrasDeEscopo).classe).toBe('ENQUADRAMENTO_INDISPONIVEL')
    }
  })
})

describe('ilustração: desenho das dimensões, não modelo', () => {
  it('só desenha com as três dimensões válidas e muda quando elas mudam', () => {
    expect(dimensoesParaDesenho({ vao: 20, comprimento: 60 })).toBeNull()
    expect(ilustracaoVolumetrica({ ...CONFIG, vao: 200 })).toBeNull()
    expect(ilustracaoVolumetrica(CONFIG)).not.toBe(ilustracaoVolumetrica({ ...CONFIG, comprimento: 120 }))
    expect(implantacaoConceitual({ ...CONFIG, comprimento: 120 })).toContain('2.400 m² de projeção')
  })
  it('é rotulada como ilustração, com cotas e texto alternativo', () => {
    const v = ilustracaoVolumetrica(CONFIG)!
    expect(v).toContain('ILUSTRAÇÃO · não é modelo estrutural')
    expect(v).toContain(AVISO_DA_ILUSTRACAO)
    expect(v).toMatch(/role="img" aria-labelledby="simVolTitulo simVolDesc"/)
    expect(implantacaoConceitual(CONFIG)).toMatch(/role="img" aria-labelledby="simPlTitulo simPlDesc"/)
  })
  it('nenhum rótulo sai do quadro nem encosta em outro, em toda a faixa do configurador', () => {
    const vaos = [6, 10, 20, 35, 60]; const comprimentos = [10, 30, 60, 200, 400]; const pes = [3, 6, 12, 20]
    const ler = (svg: string) => [...svg.matchAll(/<text class="sim-ilu-(cota|area|selo)" x="([\d.-]+)" y="([\d.-]+)" text-anchor="(start|middle|end)"( transform="rotate)?[^>]*>([^<]+)<\/text>/g)]
      .map((m) => caixaDoRotulo({ tipo: m[1] as 'cota', x: Number(m[2]), y: Number(m[3]), ancora: m[4] as 'start', girado: Boolean(m[5]), texto: m[6] }))
    let desenhos = 0
    for (const vao of vaos) for (const comprimento of comprimentos) for (const peDireito of pes) {
      const c = { ...CONFIG, vao, comprimento, peDireito }
      for (const [svg, largura, altura] of [[ilustracaoVolumetrica(c)!, 640, 400], [implantacaoConceitual(c)!, 640, 320]] as const) {
        desenhos++
        const caixas = ler(svg)
        for (const k of caixas) expect(k.x0 >= 0 && k.y0 >= 0 && k.x1 <= largura && k.y1 <= altura, `${vao}×${comprimento}×${peDireito}`).toBe(true)
        for (let i = 0; i < caixas.length; i++) for (let j = i + 1; j < caixas.length; j++) {
          const a = caixas[i], b = caixas[j]
          expect(a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1, `${vao}×${comprimento}×${peDireito}`).toBe(false)
        }
      }
    }
    expect(desenhos).toBe(200)
    // No caso típico, todos os rótulos cabem.
    expect(ler(ilustracaoVolumetrica(CONFIG)!)).toHaveLength(4)
  })
  it('os tamanhos de texto do cálculo são os do CSS', () => {
    const css = ler('src', 'styles', 'simulador.css')
    expect(css).toContain(`.sim-ilu-cota { font-family: var(--font-mono); font-size: ${TEXTO_DO_DESENHO.cota.tamanho}px;`)
    expect(css).toContain(`.sim-ilu-area { font-family: var(--font-display); font-size: ${TEXTO_DO_DESENHO.area.tamanho}px;`)
    expect(css).toContain(`.sim-ilu-selo { font-family: var(--font-mono); font-size: ${TEXTO_DO_DESENHO.selo.tamanho}px; letter-spacing: .12em;`)
  })
  it('não desenha pórtico, perfil, contraventamento, fundação nem quantidade', () => {
    for (const c of [CONFIG, { ...CONFIG, vao: 60, comprimento: 400, peDireito: 20 }, { ...CONFIG, vao: 6, comprimento: 10, peDireito: 3 }]) {
      const v = ilustracaoVolumetrica(c)!
      expect(v.match(/<polygon/g)?.length).toBe(5)
      expect(v + implantacaoConceitual(c)!).not.toMatch(/p[oó]rtico|perfil|contravent|funda[cç]|ter[cç]a|chumbador|\bkg\b|\bkN\b|tonelada/i)
    }
  })
})

describe('apresentação: só o que o visitante declarou', () => {
  it('cidades legítimas nunca são recusadas', () => {
    for (const cidade of ['Perfil Alto, SP', 'Pressão, MG', 'Vento Sul, RS', "Olho d'Água das Flores, AL", 'São João del-Rei, MG', 'Brasília/DF']) {
      const e = montarApresentacaoPublica({ ...CONFIG, cidade }, NENHUMA)
      expect(e.ok, cidade).toBe(true)
    }
  })
  it('campo estranho não passa, e o esquema recusa qualquer bloco que não preveja', () => {
    const contaminada = { ...CONFIG, diagnostico: { perfis: { pilar: 'W310x52' } }, quantitativo: { pesoTotalKg: 18250 }, inclinacao: 10 } as unknown as ConfiguracaoGalpao
    const a = apresentar(contaminada, NENHUMA)
    expect(Object.keys(a.configuracao).sort()).toEqual(['cidade', 'cobertura', 'comprimento', 'fechamento', 'peDireito', 'uso', 'vao'])
    expect(JSON.stringify(a)).not.toMatch(/W310|18250|diagnostico|quantitativo|inclinacao/)
    expect([...CAMPOS_PUBLICOS]).toEqual(['uso', 'vao', 'comprimento', 'peDireito', 'cidade', 'cobertura', 'fechamento'])
    const forjado = JSON.parse(JSON.stringify(a)); forjado.enquadramento.utilizacao = 0.9
    expect(violacoesDaApresentacao(forjado)).toEqual(['apresentacao.enquadramento.utilizacao: campo não previsto no esquema'])
  })
})

describe('especificação do lead: mesmo campo, mesmo formato, dois itens a mais', () => {
  /** A fórmula que a página usava antes desta mudança, copiada daqui para servir de referência. */
  const formulaAnterior = (c: ConfiguracaoGalpao) => itensAtuaisDaEspecificacao(c).join(' · ')

  it('os itens de antes saem idênticos, na mesma ordem', () => {
    expect(itensAtuaisDaEspecificacao(CONFIG)).toEqual([
      'Cobertura: Ainda não sei', 'Fechamento: Ainda não sei', 'Piso: Ainda não sei', 'Escopo: Avaliar com a engenharia',
      'Terreno: Já tenho o terreno', 'Projeto: Nada ainda', 'Prazo: Ainda estudando', 'Uso: Industrial',
    ])
    expect(especificacaoDoLead(CONFIG, NENHUMA).startsWith(formulaAnterior(CONFIG) + SEPARADOR)).toBe(true)
  })
  it('acrescenta a tipologia declarada e o enquadramento, no condicional e com a versão das regras', () => {
    const itens = especificacaoDoLead({ ...CONFIG, vao: 40 }, com('mezanino', 'geminado')).split(SEPARADOR)
    expect(itens).toHaveLength(10)
    expect(itens.slice(8)).toEqual([
      'Tipologia declarada: Mezanino ou piso intermediário; Dois ou mais galpões geminados',
      'Enquadramento comercial (regras provisórias escopo-padronizado-0): Indicação preliminar: a tipologia tende a ficar fora do estudo padronizado',
    ])
    expect(especificacaoDoLead(CONFIG, null).split(SEPARADOR).slice(8)).toEqual([
      'Tipologia declarada: não declarada',
      'Enquadramento comercial (regras provisórias escopo-padronizado-0): Tipologia ainda não declarada',
    ])
    expect(especificacaoDoLead(CONFIG, NENHUMA, APROVADAS).split(SEPARADOR)[9]).toBe('Enquadramento comercial (regras escopo-de-teste-aprovado): Dentro do escopo de estudo padronizado')
  })
  it('integridade: separa de volta em itens «Rótulo: valor», sem separador perdido dentro de um item', () => {
    for (const d of [null, NENHUMA, com(...ESCOPO_PADRONIZADO.tipologiasForaDoPadrao.map((t) => t.id))]) {
      const itens = especificacaoDoLead(CONFIG, d).split(SEPARADOR)
      expect(itens).toHaveLength(10)
      for (const i of itens) expect(i).toMatch(/^[A-ZÀ-Ú][\p{L} ]+(\([^)]*\))?: \S/u)
    }
  })
  it('cabe nos limites que a borda do CRM aplica: 60 campos e 5.000 caracteres por campo', () => {
    // A borda do CRM recusa a submissão INTEIRA acima desses limites. O teto daqui é bem menor.
    expect(TAMANHO_MAXIMO_DA_ESPECIFICACAO).toBeLessThanOrEqual(5000)
    const form = HTML.slice(HTML.indexOf('<form class="sim"'), HTML.indexOf('</form>'))
    expect(new Set([...form.matchAll(/\sname="([\w-]+)"/g)].map((m) => m[1])).size).toBeLessThanOrEqual(60)
  })
  it('tamanho: o pior caso cabe no teto com folga', () => {
    const pior = especificacaoDoLead({ ...CONFIG, uso: 'especial', vao: 60, comprimento: 400, peDireito: 20, cobertura: 'termoacustica', fechamento: 'alvenaria', piso: 'pesado', escopo: 'estrutura-fechamento', terreno: 'negociacao', projeto: 'arquitetonico', prazo: '12-meses' }, com(...ESCOPO_PADRONIZADO.tipologiasForaDoPadrao.map((t) => t.id)))
    expect(pior.length).toBeLessThan(TAMANHO_MAXIMO_DA_ESPECIFICACAO * 0.7)
    expect(pior.endsWith('…')).toBe(false)
  })
  it('codificação: o envio urlencoded devolve o texto exato, com acentos, aspas angulares e ponto médio', () => {
    const texto = especificacaoDoLead({ ...CONFIG, cidade: 'São João del-Rei, MG' }, com('cobertura-diferente'))
    const corpo = new URLSearchParams({ 'form-name': 'simular-galpao', especificacao: texto }).toString()
    expect(new URLSearchParams(corpo).get('especificacao')).toBe(texto)
    expect(texto).toContain('·')
  })
  it('não leva texto livre do visitante nem nada estrutural', () => {
    const texto = especificacaoDoLead({ ...CONFIG, cidade: 'W310x52 <script>, GO', observacao: 'perfil 128 kN' }, com('mezanino'))
    expect(texto).not.toMatch(/W310|script|128|kN|perfil|utiliza|vento|peso|kg\b|quantitativo|ATENDE|INCONCLUSIVO|EXPERIMENTAL/i)
    expect(itensDoEnquadramento(apresentar(CONFIG, NENHUMA), ESCOPO_PADRONIZADO).join(' ')).not.toMatch(/\d{2,}\s?(m|kg|kN)/)
  })
})

describe('página pública: formulário preservado e superfície comercial isolada', () => {
  it('o formulário do Netlify continua o mesmo: nome, método, armadilha e destino', () => {
    expect(HTML).toContain('<form class="sim" id="sim" name="simular-galpao" method="POST" data-netlify="true" netlify-honeypot="empresa-site" action="/obrigado/">')
  })
  it('nenhum campo novo: os nomes do formulário são exatamente os de antes', () => {
    const form = HTML.slice(HTML.indexOf('<form class="sim"'), HTML.indexOf('</form>'))
    const nomes = [...new Set([...form.matchAll(/\sname="([\w-]+)"/g)].map((m) => m[1]))].sort()
    expect(nomes).toEqual([
      'area', 'cidade', 'cobertura', 'comprimento', 'email', 'empresa', 'empresa-site', 'escopo', 'especificacao', 'estudo_especifico', 'fechamento',
      'form-name', 'leitura', 'nome', 'observacao', 'origem', 'peDireito', 'piso', 'prazo', 'projeto', 'resumo',
      'simular-galpao', // o nome do próprio formulário
      'telefone', 'terreno', 'uso', 'vao',
    ])
  })
  it('os blocos novos nascem ocultos: sem JavaScript a página é o formulário de antes', () => {
    for (const id of ['simTipologia', 'simVistas', 'simIlustracao', 'simIlustracaoAviso', 'simSolicitacao']) {
      const tag = new RegExp(`<[a-z]+ [^>]*id="${id}"[^>]*>`).exec(HTML)?.[0]
      expect(tag, id).toBeDefined()
      expect(tag, id).toMatch(/\shidden(>|\s)/)
    }
    // O enquadramento é a exceção: nasce VAZIO, não oculto (ver o teste de acessibilidade abaixo).
    expect(HTML).toContain('<div class="sim-enquadramento" id="simEnquadramento" aria-live="polite"></div>')
    // As opções de tipologia são desenhadas pelo script, sem `name`.
    expect(HTML).not.toMatch(/data-tipologia/)
    const tela = ler('src', 'simulador', 'tela.ts')
    expect(tela).toContain('<input type="checkbox" ${atributo}>')
    expect(tela).not.toMatch(/name="tipologia|name=\\?"tipologia/)
  })
  it('o envio monta a especificação pela função testada, e o resto do envio não mudou', () => {
    const tela = ler('src', 'simulador', 'tela.ts')
    expect(tela).toContain("definir('especificacao', especificacaoDoLead(c, declaracao(), regras))")
    expect(tela).toContain("const r = await fetch('/', {")
    expect(tela).toContain("headers: { 'Content-Type': 'application/x-www-form-urlencoded' },")
    for (const campo of ['area', 'resumo', 'leitura', 'estudo_especifico', 'origem']) expect(tela).toContain(`definir('${campo}',`)
  })
  it('o simulador público não importa nenhum módulo técnico, de prévia ou de rede nova', () => {
    const dir = resolve(RAIZ, 'src', 'simulador')
    const arquivos = [...readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).map((f) => resolve(dir, f)), resolve(RAIZ, 'src', 'simulador.ts')]
    const pastaDoMotor = new RegExp(['eiff', 'pre', 'engenharia'].join('-'))
    for (const f of arquivos) {
      const s = readFileSync(f, 'utf8')
      for (const [, i] of s.matchAll(/from '([^']+)'/g)) expect(i, `${f} importa ${i}`).not.toMatch(/resultado|jornada|comercial|motor|vendor|__dev/)
      expect(s, f).not.toMatch(pastaDoMotor)
      expect(s, f).not.toMatch(/preEngenharia\(|comporProjeto|resultado-estrutural|SIM04_PACOTE/)
    }
    const novos = ['enquadramento.ts', 'ilustracao.ts', 'apresentacao.ts', 'especificacao.ts']
    for (const n of novos) expect(readFileSync(resolve(dir, n), 'utf8'), n).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie/)
  })
})

describe('acessibilidade com leitor de tela (E10.7B)', () => {
  const tela = ler('src', 'simulador', 'tela.ts')
  const css = ler('src', 'styles', 'simulador.css')

  it('P1: a armadilha anti-robô fica fora do Tab e da árvore de acessibilidade, sem perder o nome', () => {
    const p = /<p class="sr-only" aria-hidden="true"><label>Não preencha: <input name="empresa-site" tabindex="-1" autocomplete="off"><\/label><\/p>/
    expect(HTML).toMatch(p)
    // Nada focalizável por Tab dentro de um bloco aria-hidden.
    for (const [bloco] of HTML.matchAll(/<(\w+)[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/\1>/g)) {
      for (const [ctrl] of bloco.matchAll(/<(input|select|textarea|button|a)\b[^>]*>/g)) expect(ctrl, bloco).toMatch(/tabindex="-1"|type="hidden"/)
    }
    // O campo não é `disabled`: um campo desabilitado não seria enviado e o Netlify não veria o robô.
    expect(HTML).not.toMatch(/name="empresa-site"[^>]*disabled/)
  })

  it('P2: a seta percorre as opções de uso sem avançar; clique, Espaço e Enter continuam avançando', () => {
    expect(tela).toContain("const SETAS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])")
    expect(tela).toMatch(/usoPorSeta = el\.name === 'uso' && el\.type === 'radio' && SETAS\.has\(e\.key\)/)
    expect(tela).toMatch(/el\.name === 'uso' && estado\.etapa === 'uso' && el\.type === 'radio' && !pelaSeta\)/)
    // O sinal da seta vale para uma única mudança: é zerado antes de decidir.
    expect(tela.indexOf('usoPorSeta = false')).toBeLessThan(tela.indexOf('!pelaSeta)'))
    // Espaço numa opção já marcada (sem `change`) confirma e avança.
    expect(tela).toMatch(/e\.key === ' ' && el\.name === 'uso' && el\.type === 'radio' && el\.checked && estado\.etapa === 'uso'/)
  })

  it('P3: a região do enquadramento nunca é ocultada; o que muda é só o conteúdo', () => {
    expect(tela).not.toMatch(/caixaEnquadramento\.hidden/)
    expect(tela).toMatch(/a\.enquadramento\.classe !== 'CONFIGURACAO_INCOMPLETA' \? blocoEnquadramento\(a\) : ''/)
    expect(tela).toMatch(/if \(enquadramentoDesenhado !== novo\) \{\s*caixaEnquadramento\.innerHTML = novo/)
    // Vazia, não ocupa espaço nem mostra a borda.
    expect(css).toMatch(/\.sim-enquadramento:empty \{ position: absolute; border: 0; padding: 0; background: none; \}/)
    // display: none tiraria a região da árvore de acessibilidade e o primeiro anúncio se perderia.
    expect(css).not.toMatch(/\.sim-enquadramento[^{]*\{[^}]*display: none/)
  })

  it('P4: as observações só são reescritas quando o texto muda', () => {
    expect(tela).toMatch(/if \(obsDesenhadas !== novo\) \{\s*painelObs\.innerHTML = novo\s*obsDesenhadas = novo/)
    // Nenhuma outra escrita direta na região.
    expect(tela.match(/painelObs\.innerHTML\s*=/g)).toHaveLength(1)
  })
})
