# Simulador de galpões — Fase 01

Landing de conversão em `/simular-galpao/`, integrada ao site institucional. Esta fase **coleta e organiza**
a configuração; **não calcula e não exibe valor**. A pré-engenharia automática é a Fase 02.

## O que está no ar nesta fase

| Camada | Arquivo | Papel |
| --- | --- | --- |
| Página | `simular-galpao.html` | HTML completo, funciona sem JavaScript |
| Entrada | `src/simulador.ts` | Sem GSAP, Lenis ou Three.js: a LP é leve de propósito |
| Parâmetros | `src/simulador/parametros.ts` | Catálogos, validação, leitura técnica |
| Fluxo | `src/simulador/fluxo.ts` | Máquina de etapas, pura e testável |
| Croqui | `src/simulador/croqui.ts` | Geometria do pórtico em SVG |
| Analytics | `src/simulador/analytics.ts` | Funil, UTM, consentimento, sem dado pessoal |
| Contrato | `src/simulador/orcamento.ts` | Interface da Fase 02 e provedor fail-closed |
| Tela | `src/simulador/tela.ts` | Única camada que toca no DOM |
| Estilo | `src/styles/simulador.css` | Sobre os tokens de `tokens.css` |

Destino do lead: **Netlify Forms**, formulário `simular-galpao`. Precisa de notificação por e-mail configurada
no painel (Forms → simular-galpao → Form notifications), como foi feito para `iniciar-projeto`.

## Regra que não muda

Nenhuma tabela comercial, coeficiente de custo, peso de aço por m² ou prazo derivado mora no frontend.
O teste `orcamento.test.ts` varre todos os módulos do simulador e falha se aparecer valor monetário literal
ou identificador de precificação. Os únicos números publicados são os das obras já executadas, cada um com
o projeto de referência citado (`REFERENCIAS` em `parametros.ts`).

## Contrato para a Fase 02

Já declarado em `src/simulador/orcamento.ts`. A Fase 02 implementa o serviço; a tela não muda.

### Requisição

`POST /api/pre-engenharia` (função no servidor, nunca direto do navegador para o MODO LAB)

```ts
interface PedidoPreEngenharia {
  versaoContrato: 'pre-engenharia-1'
  configuracao: {
    uso?: 'industrial' | 'logistico' | 'comercial' | 'agro' | 'especial'
    vao?: number          // metros, 6 a 60
    comprimento?: number  // metros, 10 a 400
    peDireito?: number    // metros, 3 a 20
    cobertura?: 'telha-simples' | 'termoacustica' | 'pir' | 'indefinido'
    fechamento?: 'metalico' | 'pir' | 'alvenaria' | 'aberto' | 'indefinido'
    piso?: 'leve' | 'medio' | 'pesado' | 'existente' | 'indefinido'
    escopo?: 'completo' | 'estrutura-fechamento' | 'estrutura' | 'indefinido'
    terreno?: 'proprio' | 'negociacao' | 'nao'
    projeto?: 'executivo' | 'arquitetonico' | 'estudo' | 'nenhum'
    prazo?: 'urgente' | '6-meses' | '12-meses' | 'estudando'
    cidade?: string
    observacao?: string
  }
  idSessao: string
  origem?: OrigemCampanha
}
```

O pedido **não carrega nome, e-mail nem telefone**: o contato viaja pelo lead, não pelo motor de cálculo.

### Resposta

```ts
type RespostaPreEngenharia =
  | { status: 'ok'; resultado: ResultadoPreEngenharia }
  | { status: 'fora-do-escopo'; motivo: string }
  | { status: 'indisponivel'; motivo: string }

interface ResultadoPreEngenharia {
  aco?: { min: number; max: number; unidade: string }
  prazo?: { min: number; max: number; unidade: string }
  investimento?: { min: number; max: number; unidade: string }
  ressalva: string                  // obrigatório; exibido sem edição
  premissas?: readonly string[]
  versaoMotor?: string
}
```

Três invariantes que o cliente já aplica, e que a Fase 02 deve respeitar:

1. **Faixa, nunca valor único.** Um número só sugere precisão que o estudo preliminar não tem.
2. **`ressalva` é obrigatória.** Resultado `ok` sem ressalva é tratado como `indisponivel` e não vai à tela
   (`provedorHttp` já faz isso, com teste).
3. **Falha é `indisponivel`, nunca estimativa.** Timeout, 5xx ou resposta ininteligível não viram número.

### Ligar na Fase 02

```ts
// src/simulador.ts
import { provedorHttp } from './simulador/orcamento'
iniciarSimulador(document, { provedor: provedorHttp('/api/pre-engenharia') })
```

A tela já trata `disponivel() === false` mostrando o aviso de que o orçamento sai do estudo preliminar.
Falta apenas a área de resultado, que deve exibir `ressalva` e `premissas` junto das faixas.

## Analytics

Provedor: Umami, o mesmo do site (sem cookies). Eventos:

| Evento | Quando |
| --- | --- |
| `simulador_inicio` | Carregamento da LP, com origem da campanha |
| `simulador_etapa` | Avanço para cada etapa |
| `simulador_etapa_erro` | Tentativa de avanço com campo inválido |
| `simulador_resumo` | Chegada à etapa de contato, com a configuração generalizada |
| `simulador_envio` | Lead enviado |
| `simulador_envio_erro` | Falha no envio |
| `simulador_contato_alternativo` | Saída por e-mail, formulário completo ou projetos |

Privacidade: lista fechada de propriedades (`CHAVES_PERMITIDAS`), área enviada em faixa e não em valor exato,
cidade reduzida à UF, respeito a Do Not Track e a opt-out local. Um teste garante que nome, e-mail, telefone,
empresa, cidade e o texto livre nunca entram num evento. A origem da campanha fica em `sessionStorage`,
morre com a aba e **nenhum cookie é criado** (verificado no navegador).

## Verificação

- `npm test` — 93 testes (parâmetros, fluxo, analytics, contrato, croqui, página)
- `npm run build` — checagem de tipos, testes e build; o deploy falha se algum teste falhar
- Navegador (Chromium): funil completo, validação, envio, acessibilidade (axe sem violações em desktop e
  mobile), ausência de rolagem horizontal, funcionamento sem JavaScript e com `prefers-reduced-motion`

## Pendências desta fase

- Notificação do formulário `simular-galpao` no painel do Netlify
- Endpoint e motor da pré-engenharia (Fase 02)
- Área de resultado na tela, quando houver o que mostrar
