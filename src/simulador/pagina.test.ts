/**
 * Guardas da página: o HTML precisa continuar funcionando sem JavaScript e
 * precisa expor ao Netlify Forms todos os campos que a tela preenche.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MOLDURA_PADRAO, desenharPortico } from './croqui'
import { ETAPAS, estadoInicial, validarEtapa } from './fluxo'
import { COBERTURAS, ESCOPOS, FECHAMENTOS, PISOS, PRAZOS, PROJETOS, TERRENOS, USOS } from './parametros'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const html = readFileSync(resolve(RAIZ, 'simular-galpao.html'), 'utf8')
const atributo = (re: RegExp) => [...html.matchAll(re)].map((m) => m[1])

describe('formulário detectável pelo Netlify', () => {
  it('declara o formulário e o campo form-name', () => {
    expect(html).toMatch(/name="simular-galpao"[^>]*method="POST"/)
    expect(html).toContain('data-netlify="true"')
    expect(html).toMatch(/name="form-name" value="simular-galpao"/)
  })

  it('tem armadilha de robô declarada e escondida', () => {
    expect(html).toContain('netlify-honeypot="empresa-site"')
    expect(html).toMatch(/class="sr-only"[^>]*>[\s\S]*?name="empresa-site"/)
  })

  it('traz no HTML todos os campos ocultos que a tela preenche', () => {
    for (const campo of ['area', 'resumo', 'especificacao', 'leitura', 'estudo_especifico', 'origem']) {
      expect(html, campo).toMatch(new RegExp(`<input type="hidden" name="${campo}"`))
    }
  })

  /**
   * Sem JavaScript o navegador faz o POST nativo e o Netlify redireciona para o
   * `action`. Apontado para a própria página, o visitante voltava ao formulário
   * em branco, sem nenhum sinal de que o envio funcionou.
   */
  it('sem JavaScript, o envio termina numa página de confirmação', () => {
    expect(html).toContain('action="/obrigado/"')
    expect(html).not.toContain('action="/simular-galpao/"')
    const confirmacao = readFileSync(resolve(RAIZ, 'obrigado.html'), 'utf8')
    expect(confirmacao).toContain('Sua configuração chegou à engenharia')
    // Página de confirmação não entra na busca.
    expect(confirmacao).toMatch(/name="robots" content="noindex/)
  })
})

describe('dados pessoais', () => {
  it('a etapa de contato informa a finalidade e aponta a política', () => {
    const contato = html.slice(html.indexOf('data-etapa="contato"'))
    expect(contato).toContain('href="/privacidade/"')
    expect(contato).toMatch(/LGPD art\. 7º, V/)
  })

  it('a política de privacidade existe e cobre o que o site realmente faz', () => {
    const politica = readFileSync(resolve(RAIZ, 'privacidade.html'), 'utf8')
    for (const tema of ['Netlify', 'Umami', 'Google Fonts', 'ANPD', 'LGPD', 'contato@eiff.com.br']) {
      expect(politica, tema).toContain(tema)
    }
    expect(politica).toMatch(/transferência internacional/i)
  })

  it('a política é alcançável do rodapé, que a landing inclui', () => {
    const rodape = readFileSync(resolve(RAIZ, 'src', 'partials', 'footer.html'), 'utf8')
    expect(rodape).toContain('href="/privacidade/"')
    expect(html).toContain('@include footer')
  })
})

describe('etapas e campos', () => {
  it('cada etapa do fluxo tem a sua seção no HTML', () => {
    for (const e of ETAPAS) expect(html, e.id).toContain(`data-etapa="${e.id}"`)
  })

  it('cada campo do fluxo existe como controle nomeado', () => {
    for (const campo of ETAPAS.flatMap((e) => e.campos)) {
      expect(html, campo).toMatch(new RegExp(`name="${campo}"`))
    }
  })

  it('as opções do HTML são exatamente as dos catálogos', () => {
    const catalogos = { uso: USOS, cobertura: COBERTURAS, fechamento: FECHAMENTOS, piso: PISOS, escopo: ESCOPOS, terreno: TERRENOS, projeto: PROJETOS, prazo: PRAZOS }
    for (const [campo, catalogo] of Object.entries(catalogos)) {
      const bloco = campo === 'uso'
        ? html.match(/name="uso"[\s\S]*?<\/div>/)![0]
        : html.match(new RegExp(`name="${campo}"[\\s\\S]*?</select>`))![0]
      const valores = [...bloco.matchAll(/value="([\w-]+)"/g)].map((m) => m[1])
      expect(valores.sort(), campo).toEqual(catalogo.map((o) => o.id).sort())
    }
  })

  it('cada campo validável tem um lugar para a mensagem de erro', () => {
    for (const campo of ETAPAS.flatMap((e) => e.campos)) {
      if (campo === 'observacao') continue
      expect(html, campo).toContain(`data-erro="${campo}"`)
    }
  })
})

describe('acessibilidade e funcionamento sem JavaScript', () => {
  it('nenhuma etapa é escondida por HTML: sem JS o formulário é uma página só', () => {
    expect(html).not.toMatch(/data-etapa="[\w-]+" hidden/)
  })

  it('com JS, as etapas seguintes à primeira já nascem ocultas pelo CSS', () => {
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'styles', 'simulador.css'), 'utf8')
    expect(css).toContain('html.js .sim__etapa[data-oculta]')
    expect(html).toMatch(/data-etapa="uso">/)
    for (const id of ['dimensoes', 'especificacao', 'contexto', 'contato']) {
      expect(html, id).toMatch(new RegExp(`data-etapa="${id}" data-oculta`))
    }
  })

  it('tem aviso para quem está sem JavaScript', () => {
    expect(html).toContain('<noscript>')
  })

  it('todo campo visível tem rótulo associado', () => {
    const ids = atributo(/<(?:input|select|textarea)[^>]*\sid="([\w-]+)"/g)
    const rotulados = atributo(/<label[^>]*\sfor="([\w-]+)"/g)
    for (const id of ids) expect(rotulados, `sem label: ${id}`).toContain(id)
  })

  it('os erros são anunciados por leitor de tela', () => {
    const erros = [...html.matchAll(/data-erro="[\w-]+"[^>]*/g)].map((m) => m[0])
    for (const e of erros) expect(e).toContain('role="alert"')
  })

  it('a barra de progresso declara o papel e os limites', () => {
    expect(html).toMatch(/id="simProgresso"[^>]*role="progressbar"/)
    expect(html).toMatch(/aria-valuemin="0"[^>]*aria-valuemax="100"/)
  })

  it('preserva os canais de contato atuais', () => {
    expect(html).toContain('mailto:contato@eiff.com.br')
    expect(html).toContain('href="/contato/"')
  })
})

describe('croqui inicial coerente com os valores padrão', () => {
  const padrao = (nome: string) => Number(html.match(new RegExp(`id="${nome}"[^>]*value="([\\d.]+)"`))![1])

  it('o desenho estático corresponde ao vão e ao pé-direito iniciais', () => {
    const c = desenharPortico({ vao: padrao('vao'), peDireito: padrao('peDireito') }, MOLDURA_PADRAO)
    const noHtml = (id: string) => html.match(new RegExp(`id="${id}"[^>]*\\sd="([^"]+)"`))![1]
    expect(noHtml('cqPilares')).toBe(c.pilares)
    expect(noHtml('cqCobertura')).toBe(c.cobertura)
    expect(noHtml('cqBanzo')).toBe(c.banzo)
    expect(noHtml('cqTrelica')).toBe(c.trelica)
    expect(noHtml('cqSolo')).toBe(c.solo)
    expect(noHtml('cqCotaVao')).toBe(c.cotaVao.caminho)
    expect(noHtml('cqCotaPe')).toBe(c.cotaPeDireito.caminho)
  })

  it('a área inicial mostrada bate com as medidas padrão', () => {
    const area = padrao('vao') * padrao('comprimento')
    expect(html).toMatch(new RegExp(`id="simArea">${area.toLocaleString('pt-BR')} m²`))
  })

  it('os valores que já vêm no HTML passam na validação: avançar sem tocar nas dimensões funciona', () => {
    const estado = estadoInicial({ uso: 'industrial', vao: padrao('vao'), comprimento: padrao('comprimento'), peDireito: padrao('peDireito') })
    expect(validarEtapa('dimensoes', estado)).toEqual([])
  })

  it('o deslizador de cada medida tem a mesma faixa do campo numérico', () => {
    for (const campo of ['vao', 'comprimento', 'peDireito']) {
      const numero = html.match(new RegExp(`id="${campo}"[^>]*>`))![0]
      const slider = html.match(new RegExp(`<input class="sim__slider"[^>]*data-espelho="${campo}"[^>]*>`))![0]
      for (const attr of ['min', 'max', 'step', 'value']) {
        const de = (t: string) => t.match(new RegExp(`${attr}="([\\d.]+)"`))![1]
        expect(de(slider), `${campo}.${attr}`).toBe(de(numero))
      }
    }
  })
})

describe('nenhuma promessa de valor na página', () => {
  it('não anuncia preço', () => {
    expect(html).not.toMatch(/R\$\s*\d/)
  })

  it('diz com todas as letras que o orçamento não é automático', () => {
    expect(html).toMatch(/não está disponível nesta fase/)
  })
})
