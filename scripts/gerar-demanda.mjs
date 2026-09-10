/**
 * Gera as páginas de demanda (SEO) a partir de um conteúdo estruturado.
 * Uso: node scripts/gerar-demanda.mjs  → grava <slug>.html na raiz do projeto.
 * As páginas usam os mesmos partials e estilos do restante do site.
 */
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SETA = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M1 7h12M8 2l5 5-5 5"/></svg>'

const CASES = {
  logistico: { href: '/projetos#logistico', tag: 'Logística', foto: 'foto-galpao-aereo', titulo: 'Complexo logístico', meta: 'Aparecida de Goiânia, GO · 3.600 m² · 3 galpões', alt: 'Complexo logístico em Aparecida de Goiânia' },
  smartfit: { href: '/projetos#smartfit', tag: 'Comercial', foto: 'foto-smartfit', titulo: 'Smart Fit Cabo Frio', meta: 'Cabo Frio, RJ · 1.200 m² · 65 dias', alt: 'Academia Smart Fit em Cabo Frio' },
  painelizada: { href: '/projetos#painelizada', tag: 'Tecnologia EIFF', foto: 'foto-estrutura-aerea', titulo: 'Edificação painelizada', meta: 'Goiânia, GO · 600 m² · área urbana central', alt: 'Edificação painelizada em Goiânia' },
  skyfit: { href: '/projetos#skyfit', tag: 'Comercial', foto: 'foto-skyfit', titulo: 'SkyFit Goiânia', meta: 'Goiânia, GO · 900 m² · 90 dias', alt: 'Academia SkyFit em Goiânia' },
  panobianco: { href: '/projetos#panobianco', tag: 'Comercial', foto: 'foto-panobianco', titulo: 'Panobianco Goiânia', meta: 'Goiânia, GO · 900 m² · 2 pavimentos · 120 dias', alt: 'Academia Panobianco em Goiânia' },
}

const PAGINAS = [
  {
    slug: 'galpao-metalico-industrial',
    title: 'Galpão metálico industrial: projeto, fabricação e montagem | EIFF',
    description: 'Construção de galpões metálicos industriais com engenharia própria, fábrica em Goiânia e montagem parafusada. Pé-direito de 12 m, piso para 7 t/m², prazo previsível.',
    eyebrow: 'Galpão metálico industrial',
    h1: 'Galpão metálico industrial com engenharia, fábrica e montagem na mesma empresa.',
    lead: 'A EIFF projeta, fabrica e monta galpões metálicos para indústria: plantas, ampliações, áreas produtivas e coberturas. Estrutura pré-industrializada e inteiramente parafusada, dimensionada para a operação real, com custo e prazo decididos na engenharia.',
    aside: [['Pé-direito executado', '12 m'], ['Vão livre', 'até 40 m em projeto · 32 m executado'], ['Piso industrial', '7 t/m²']],
    foto: { arquivo: 'foto-galpao-branco', alt: 'Galpão metálico industrial sob céu nublado', cap: 'Galpão industrial · fechamento metálico' },
    entregas: [
      ['Concepção e estudo preliminar', 'Implantação, modulação e sistema estrutural definidos pela operação: equipamentos, cargas, fluxo e expansão futura.'],
      ['Projeto estrutural completo', 'Cálculo, modelagem e detalhamento de cada peça e ligação conforme NBR 8800 e NBR 14762.'],
      ['Fundações e piso', 'Projeto e execução compatibilizados com a estrutura: blocos, chumbadores e piso industrial para a carga real.'],
      ['Fabricação em fábrica própria', 'Seis estações em Goiânia, com rastreabilidade por corrida do aço e inspeção por estação.'],
      ['Montagem parafusada', 'Sem solda em campo. Içamento na sequência do plano, com romaneio por carga.'],
      ['Cobertura, fechamento e interfaces', 'Telhas, painéis PIR, calhas, rufos, pontes rolantes e instalações, conforme o escopo do contrato.'],
    ],
    comoTitulo: 'Dimensionado para a operação, não para o catálogo.',
    comoTexto: ['Um galpão industrial começa pela operação que vai dentro dele: ponte rolante, silos, mezaninos, equipamentos pesados, expansão prevista. Esses dados entram no modelo antes de qualquer perfil ser cortado.', 'O resultado é uma estrutura sem sobras nem reforços improvisados, com fabricação em lotes e montagem em dias, não em meses.'],
    spec: [['Sistema', 'Pré-industrializado · 100% parafusado'], ['Fechamento', 'Telha metálica, painel PIR ou isotérmico'], ['Escopo', 'Da engenharia à entrega, conforme o contrato']],
    stats: [['12', 'm', 'Pé-direito livre executado', 'Complexo logístico · Aparecida de Goiânia'], ['7', 't/m²', 'Piso industrial executado', 'Preparado para empilhadeiras e porta-paletes'], ['100', '%', 'Ligações parafusadas em campo', 'Sem solda no canteiro']],
    faq: [
      ['Quanto tempo leva para construir um galpão metálico industrial?', 'Depende da área, das fundações e do fechamento. Nos projetos executados pela EIFF, edificações de 900 a 1.200 m² foram entregues entre 65 e 120 dias, da fundação ao fechamento completo. Galpões maiores seguem cronograma físico-financeiro definido na proposta, com fabricação em paralelo às fundações.'],
      ['Qual o vão livre possível em um galpão metálico?', 'A EIFF executou vãos de até 32 m e tem solução em projeto para 40 m de vão livre com 12 m de pé-direito, preparada para operação logística e industrial.'],
      ['O galpão pode receber ponte rolante ou mezanino?', 'Sim. Pontes rolantes, mezaninos, silos e equipamentos entram no modelo estrutural desde a concepção, com as cargas reais de operação.'],
      ['Quanto custa um galpão metálico por m²?', 'O custo depende do vão, do pé-direito, do tipo de fechamento, do piso e das fundações. A EIFF responde com um estudo preliminar e uma proposta com cronograma físico-financeiro, sem custo, a partir das informações do formulário.'],
      ['A EIFF atende fora de Goiás?', 'Sim. A fábrica fica em Goiânia e a EIFF executa em todo o Brasil, com logística planejada conforme a sequência de montagem. Um dos cases é em Cabo Frio, no Rio de Janeiro.'],
    ],
    cases: ['logistico', 'painelizada', 'panobianco'],
  },
  {
    slug: 'galpao-logistico',
    title: 'Galpão logístico e centro de distribuição em estrutura metálica | EIFF',
    description: 'Galpões logísticos e centros de distribuição com grandes vãos, pé-direito de 12 m e piso para 7 t/m². Engenharia, fabricação e montagem parafusada pela EIFF.',
    eyebrow: 'Galpão logístico',
    h1: 'Galpão logístico e centro de distribuição: grandes vãos, pé-direito alto, piso para operação pesada.',
    lead: 'Centros de distribuição, armazéns, hubs e cross-docking dimensionados para empilhadeiras, porta-paletes e docas. Vão livre de até 40 m em projeto, 12 m de pé-direito e piso para 7 t/m² executados.',
    aside: [['Vão livre', 'até 40 m em projeto'], ['Pé-direito', '12 m executado'], ['Referência', '3 galpões · 3.600 m² · Aparecida de Goiânia']],
    foto: { arquivo: 'foto-galpao-interior', alt: 'Interior de galpão logístico com mezanino e piso polido', cap: 'Galpão logístico · piso polido e mezanino' },
    entregas: [
      ['Layout pela operação', 'Docas, corredores, porta-paletes e fluxo de veículos definem modulação, vão e pé-direito.'],
      ['Estrutura de grandes vãos', 'Pórticos treliçados e ligações parafusadas para vãos de 30 a 40 m sem pilares internos.'],
      ['Piso industrial', 'Projeto e execução do piso para a carga real da operação: 7 t/m² já executado.'],
      ['Cobertura e fechamento', 'Painel PIR e isotérmico para controle térmico, com iluminação zenital quando o projeto pede.'],
      ['Fabricação e romaneio', 'Conjuntos fabricados em Goiânia e expedidos na ordem de montagem.'],
      ['Montagem em dias', 'Estrutura parafusada sobe em sequência planejada, com fechamento acompanhando.'],
    ],
    comoTitulo: 'Um complexo de três galpões, pensado como um só sistema.',
    comoTexto: ['Em Aparecida de Goiânia, a EIFF executou três galpões logísticos com 3.600 m², pé-direito de 12 m, vãos de até 32 m e piso para 7 t/m², com fechamento metálico e isotérmico e cobertura PIR.', 'O mesmo modelo estrutural alimentou fabricação, logística e montagem, sem retrabalho de informação entre etapas.'],
    spec: [['Vãos', 'até 32 m executado · 40 m em projeto'], ['Piso', '7 t/m²'], ['Cobertura', 'PIR · fechamento metálico e isotérmico']],
    stats: [['3600', 'm²', 'Em um único complexo logístico', '3 galpões · Aparecida de Goiânia'], ['32', 'm', 'Vão executado sem pilares internos', 'Pórticos treliçados parafusados'], ['12', 'm', 'Pé-direito livre', 'Para porta-paletes e empilhadeiras']],
    faq: [
      ['Qual pé-direito é indicado para um galpão logístico?', 'Para porta-paletes e empilhadeiras convencionais, 10 a 12 m de pé-direito livre costuma ser o ponto de equilíbrio entre capacidade de armazenagem e custo. A EIFF executou 12 m e dimensiona conforme a operação prevista.'],
      ['Um galpão logístico pode ser ampliado depois?', 'Sim. A estrutura parafusada e modulada permite acrescentar baias ou novos galpões sem demolição, desde que a ampliação seja prevista na concepção.'],
      ['Que carga o piso precisa suportar?', 'Depende da operação. Para porta-paletes e empilhadeiras pesadas, a EIFF projetou e executou piso para 7 t/m². O piso é dimensionado junto com as fundações e a estrutura.'],
      ['Quanto tempo leva a montagem?', 'A fabricação corre em paralelo às fundações. Com romaneio por carga, a montagem da estrutura de um galpão logístico se conta em dias, e o fechamento acompanha.'],
    ],
    cases: ['logistico', 'painelizada', 'skyfit'],
  },
  {
    slug: 'construcao-de-academias',
    title: 'Construção de academias e lojas em estrutura metálica | EIFF',
    description: 'Construção de academias, lojas e operações de varejo em estrutura metálica pré-industrializada: Smart Fit, SkyFit e Panobianco entregues entre 65 e 120 dias.',
    eyebrow: 'Academias e varejo',
    h1: 'Construção de academias e lojas em estrutura metálica, com prazo que vira receita.',
    lead: 'Para academias, supermercados e lojas, cada semana de obra é faturamento adiado. A EIFF entregou Smart Fit, SkyFit e Panobianco com estrutura pré-industrializada e fechamento completo, entre 65 e 120 dias.',
    aside: [['Smart Fit · Cabo Frio', '1.200 m² · 65 dias'], ['SkyFit · Goiânia', '900 m² · 90 dias'], ['Panobianco · Goiânia', '900 m² · 2 pavimentos · 120 dias']],
    foto: { arquivo: 'foto-smartfit', alt: 'Fachada da academia Smart Fit construída pela EIFF', cap: 'Smart Fit · Cabo Frio' },
    entregas: [
      ['Projeto para a marca', 'Fachada, pé-direito, aberturas e mezanino compatíveis com o padrão da rede e com a estrutura.'],
      ['Estrutura pré-industrializada', 'Pórticos e painéis fabricados em Goiânia, montados parafusados em terreno urbano.'],
      ['Dois pavimentos quando o terreno pede', 'Mezanino estrutural para 700 kg/m², como na Panobianco Goiânia.'],
      ['Fechamento e cobertura PIR', 'Conforto térmico e acústico para a operação, com acabamento pronto para a fachada.'],
      ['Fundação ao fechamento', 'Escopo completo, com cronograma físico-financeiro e medições aprovadas por engenheiro.'],
      ['Interfaces com concessionárias', 'Gestão de energia, água e aprovações, para a loja abrir na data.'],
    ],
    comoTitulo: 'Três academias, três prazos cumpridos.',
    comoTexto: ['Smart Fit em Cabo Frio: 1.200 m², pé-direito de 6 m, piso para 700 kg/m², fechamento e cobertura PIR, da fundação ao fechamento completo em 65 dias.', 'Em Goiânia, SkyFit com 900 m² em 90 dias e Panobianco com 900 m² em dois pavimentos em 120 dias, ambas em terreno urbano com logística restrita.'],
    spec: [['Pé-direito', '6 m'], ['Piso', '700 kg/m² · mezanino estrutural'], ['Fechamento', 'PIR · cobertura PIR']],
    stats: [['65', 'dias', 'Da fundação ao fechamento completo', 'Smart Fit · Cabo Frio · 1.200 m²'], ['90', 'dias', 'Academia de 900 m² entregue', 'SkyFit · Goiânia'], ['2', 'pav.', 'Academia em dois pavimentos', 'Panobianco · Goiânia · 120 dias']],
    faq: [
      ['Quanto tempo leva para construir uma academia em estrutura metálica?', 'Nos projetos da EIFF, entre 65 e 120 dias da fundação ao fechamento completo, para 900 a 1.200 m². O prazo depende do terreno, das fundações, do número de pavimentos e das aprovações.'],
      ['A estrutura metálica atende ao padrão das redes de academia?', 'Sim. Smart Fit, SkyFit e Panobianco foram construídas pela EIFF seguindo o padrão de fachada, pé-direito e piso de cada rede.'],
      ['É possível construir em terreno urbano pequeno?', 'Sim. A pré-industrialização reduz canteiro, ruído e resíduo. Os painéis chegam prontos e sobem parafusados, com mínima interferência na vizinhança.'],
      ['Dá para fazer dois pavimentos?', 'Sim. A Panobianco Goiânia tem dois pavimentos com mezanino estrutural, entregues em 120 dias.'],
    ],
    cases: ['smartfit', 'skyfit', 'panobianco'],
  },
  {
    slug: 'coberturas-e-mezaninos',
    title: 'Coberturas metálicas, mezaninos e estruturas especiais | EIFF',
    description: 'Coberturas metálicas, marquises, mezaninos, passarelas e reforços estruturais com cálculo, fabricação e montagem pela EIFF. Parceria técnica para arquitetos e engenharias.',
    eyebrow: 'Estruturas especiais',
    h1: 'Coberturas metálicas, mezaninos e estruturas especiais: quando a arquitetura pede engenharia.',
    lead: 'Coberturas de pátio, marquises, mezaninos, passarelas, reforços e ampliações. A EIFF atua como parceiro técnico e fabril de arquitetos, engenharias e indústrias: cálculo, detalhamento, fabricação e montagem da peça que o projeto precisa.',
    aside: [['Mezanino executado', '700 kg/m² · 2 pavimentos'], ['Ligações', '100% parafusadas'], ['Parceria', 'Arquitetos · engenharias · incorporadores']],
    foto: { arquivo: 'foto-estrutura-noite', alt: 'Estrutura metálica iluminada à noite entre árvores', cap: 'Estrutura especial · montagem noturna' },
    entregas: [
      ['Cobertura metálica', 'Pátios, docas, estacionamentos e áreas de carga com grandes vãos e drenagem resolvida.'],
      ['Mezanino metálico', 'Ampliação de área útil sem obra civil pesada, dimensionado para a carga de uso.'],
      ['Marquise e fachada', 'Estruturas de fachada, brises e marquises integradas ao projeto arquitetônico.'],
      ['Passarelas e escadas', 'Interligação entre edificações e acessos em aço, com guarda-corpo e piso.'],
      ['Reforço e ampliação', 'Diagnóstico, cálculo e execução de reforço em estruturas existentes.'],
      ['Detalhamento para o parceiro', 'Desenhos de fabricação e montagem entregues ao escritório de arquitetura ou engenharia.'],
    ],
    comoTitulo: 'A peça certa, fabricada e montada por quem calculou.',
    comoTexto: ['Em estruturas especiais, o problema costuma nascer na interface: quem calcula não fabrica, quem fabrica não monta. A EIFF fecha esse ciclo com o mesmo modelo alimentando cálculo, fabricação e içamento.', 'Para arquitetos e engenharias, isso significa um único responsável pela peça, do detalhamento à entrega.'],
    spec: [['Normas', 'NBR 8800 · NBR 14762 · NBR 6123'], ['Fabricação', 'Fábrica própria em Goiânia'], ['Escopo', 'Cálculo, detalhamento, fabricação e montagem']],
    stats: [['700', 'kg/m²', 'Mezanino estrutural executado', 'Panobianco · Goiânia'], ['100', '%', 'Ligações parafusadas', 'Sem solda em campo'], ['6', 'estações', 'Na fábrica, com inspeção', 'Corte a expedição']],
    faq: [
      ['A EIFF executa só a estrutura, sem a obra completa?', 'Sim. Em estruturas especiais a EIFF pode entregar apenas cálculo, detalhamento, fabricação e montagem da peça, integrada ao projeto de outro escritório.'],
      ['Qual a carga de um mezanino metálico?', 'Depende do uso. Para academias e comércio, a EIFF executou mezanino para 700 kg/m². Para estoque e indústria, o dimensionamento segue a carga real prevista.'],
      ['Vocês fazem cobertura metálica para pátio ou estacionamento?', 'Sim. Coberturas de grandes vãos com pilares afastados, drenagem e iluminação resolvidas no projeto.'],
      ['Como funciona a parceria com escritórios de arquitetura?', 'O escritório traz o partido arquitetônico; a EIFF entra com o sistema estrutural, o detalhamento e a fabricação, e devolve desenhos compatibilizados antes da produção.'],
    ],
    cases: ['panobianco', 'painelizada', 'logistico'],
  },
  {
    slug: 'estrutura-metalica-goiania',
    title: 'Estrutura metálica em Goiânia e Aparecida de Goiânia: fábrica própria | EIFF',
    description: 'Empresa de estrutura metálica em Goiânia com fábrica na GO-080: galpões industriais e logísticos, academias, coberturas e mezaninos. Engenharia, fabricação e montagem parafusada.',
    eyebrow: 'Goiânia e Aparecida de Goiânia',
    h1: 'Estrutura metálica em Goiânia com fábrica própria, engenharia e montagem.',
    lead: 'A EIFF tem fábrica na Rodovia GO-080, em Goiânia, e executa galpões industriais e logísticos, academias, coberturas e mezaninos em Goiânia, Aparecida de Goiânia, Anápolis e em todo o estado. Engenharia, fabricação e montagem na mesma empresa, com prazo decidido na engenharia.',
    aside: [['Fábrica', 'Rodovia GO-080, km 8 · Goiânia'], ['Obras em Goiás', 'Aparecida de Goiânia · Goiânia'], ['Atendimento', 'Todo o Brasil']],
    foto: { arquivo: 'foto-fabrica-vigas', alt: 'Vigas metálicas prontas na fábrica da EIFF em Goiânia', cap: 'Fábrica EIFF · Goiânia' },
    entregas: [
      ['Galpões industriais e logísticos', 'Complexo de três galpões com 3.600 m² em Aparecida de Goiânia: 12 m de pé-direito, vãos de até 32 m, piso para 7 t/m².'],
      ['Academias e varejo', 'SkyFit e Panobianco em Goiânia, 900 m² cada, entregues em 90 e 120 dias.'],
      ['Edificações painelizadas', 'Tecnologia própria de painéis pré-montados para terrenos urbanos com logística restrita.'],
      ['Coberturas e mezaninos', 'Estruturas especiais para indústria, comércio e arquitetura.'],
      ['Fábrica a minutos da obra', 'Menos transporte, visita à fábrica durante a produção, expedição na sequência de montagem.'],
      ['Engenharia local', 'Concepção, cálculo e detalhamento em Goiânia, com conhecimento das concessionárias e aprovações da região.'],
    ],
    comoTitulo: 'Engenharia e fábrica no mesmo lugar, a minutos da sua obra.',
    comoTexto: ['A fábrica da EIFF fica na GO-080, em Goiânia. Quem detalha vê a peça sair; quem vai receber a obra pode acompanhar a fabricação de perto.', 'Para obras em Goiânia, Aparecida de Goiânia, Senador Canedo, Anápolis e região, isso significa logística curta e resposta rápida a qualquer ajuste de campo.'],
    spec: [['Fábrica', 'Rodovia GO-080, km 8 · Goiânia, GO'], ['Região', 'Goiânia · Aparecida · Anápolis · todo o estado'], ['Contato', 'contato@eiff.com.br']],
    stats: [['3600', 'm²', 'Em um único complexo logístico', 'Aparecida de Goiânia'], ['2', 'academias', 'Entregues em Goiânia', 'SkyFit · Panobianco'], ['6', 'estações', 'Fábrica própria em Goiânia', 'Corte a expedição']],
    faq: [
      ['Onde fica a fábrica da EIFF?', 'Na Rodovia GO-080, km 8, em Goiânia, Goiás. Clientes podem visitar a fabricação durante a produção da estrutura.'],
      ['A EIFF atende Aparecida de Goiânia e Anápolis?', 'Sim. O complexo logístico de 3.600 m² foi executado em Aparecida de Goiânia. Anápolis, Senador Canedo, Trindade e todo o estado estão no raio de atendimento direto da fábrica.'],
      ['Vocês fazem galpão metálico em Goiânia com projeto incluso?', 'Sim. A EIFF entrega concepção, cálculo, detalhamento, fabricação e montagem, e, conforme o contrato, fundações, fechamentos e interfaces com concessionárias.'],
      ['Como pedir um orçamento de estrutura metálica em Goiânia?', 'Pelo formulário "Iniciar um projeto", informando tipo de empreendimento, área aproximada, cidade e prazo. A EIFF responde com estudo preliminar e proposta com cronograma físico-financeiro.'],
    ],
    cases: ['logistico', 'skyfit', 'panobianco'],
  },
]

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const cardCase = (id, i) => { const c = CASES[id]; return `          <a class="case" href="${c.href}" data-cursor="Ver" data-reveal${i ? ` data-reveal-delay=".${i}"` : ''}>
            <div class="case__media"><span class="case__tag">${c.tag}</span><img src="/img/${c.foto}.jpg" srcset="/img/${c.foto}-800.jpg 800w, /img/${c.foto}.jpg 1600w" sizes="(max-width: 640px) 100vw, (max-width: 1080px) 50vw, 33vw" alt="${c.alt}" loading="lazy" decoding="async"></div>
            <div class="case__body"><span class="case__title">${c.titulo}</span><span class="case__meta">${c.meta}</span><span class="case__num">0${i + 1}</span></div>
          </a>` }

for (const p of PAGINAS) {
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: p.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <!-- @include head -->
  <title>${esc(p.title)}</title>
  <meta name="description" content="${esc(p.description)}">
  <link rel="canonical" href="https://eiff.com.br/${p.slug}">
  <meta property="og:title" content="${esc(p.title)}">
  <meta property="og:description" content="${esc(p.description)}">
  <meta property="og:url" content="https://eiff.com.br/${p.slug}">
  <script type="application/ld+json">${JSON.stringify(faqLd)}</script>
  <script type="module" src="/src/page.ts"></script>
</head>
<body data-page="solucoes">
  <!-- @include nav -->
  <main id="conteudo">

    <section class="page-hero">
      <div class="bg-grid" aria-hidden="true"></div>
      <div class="wrap">
        <div class="page-hero__grid">
          <div>
            <span class="eyebrow" data-reveal>${p.eyebrow}</span>
            <h1 class="h1" data-split>${p.h1}</h1>
            <p class="lead" data-reveal>${p.lead}</p>
            <div style="margin-top:32px;display:flex;gap:14px;flex-wrap:wrap" data-reveal>
              <a class="btn btn--primary" href="/contato" data-magnetic><span>Iniciar um projeto</span><svg class="btn__arrow" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M2 12 12 2M4 2h8v8"/></svg></a>
              <a class="btn" href="/projetos" data-magnetic><span>Ver projetos executados</span></a>
            </div>
          </div>
          <div class="page-hero__aside" data-reveal>
${p.aside.map(([k, v]) => `            <div><span>${k}</span><strong>${v}</strong></div>`).join('\n')}
          </div>
        </div>
        <div class="page-hero__media" data-reveal><img src="/img/${p.foto.arquivo}.jpg" srcset="/img/${p.foto.arquivo}-800.jpg 800w, /img/${p.foto.arquivo}.jpg 1600w" sizes="100vw" alt="${p.foto.alt}" loading="eager" decoding="async"><span class="cap">${p.foto.cap}</span></div>
      </div>
    </section>

    <section class="section section--tight">
      <div class="wrap">
        <div class="section-head">
          <div><span class="eyebrow" data-reveal>O que entregamos</span><h2 class="h2" data-split style="margin-top:22px">Da engenharia à entrega, em um único processo.</h2></div>
          <div class="section-head__side" data-reveal><p class="body">Quem projeta, fabrica. Quem fabrica, monta. Quem monta participou da engenharia. O escopo se ajusta ao contrato; o método é sempre o mesmo.</p></div>
        </div>
        <div class="steps">
${p.entregas.map(([t, d], i) => `          <div class="step" data-reveal><span class="idx">0${i + 1}</span><h3 class="h4">${t}</h3><p>${d}</p></div>`).join('\n')}
        </div>
      </div>
    </section>

    <section class="section" style="background:var(--bg-2)">
      <div class="wrap split split--rev">
        <div class="figure figure--wide" data-reveal><img src="/img/${p.foto.arquivo}.jpg" srcset="/img/${p.foto.arquivo}-800.jpg 800w, /img/${p.foto.arquivo}.jpg 1600w" sizes="(max-width: 1080px) 100vw, 58vw" alt="${p.foto.alt}" loading="lazy" decoding="async"><span class="cap">${p.foto.cap}</span></div>
        <div>
          <span class="eyebrow" data-reveal>Como fazemos</span>
          <h2 class="h2" data-split>${p.comoTitulo}</h2>
${p.comoTexto.map((t) => `          <p class="body" data-reveal>${t}</p>`).join('\n')}
          <dl class="spec" style="margin-top:28px" data-reveal>
${p.spec.map(([k, v]) => `            <dt>${k}</dt><dd>${v}</dd>`).join('\n')}
          </dl>
        </div>
      </div>
    </section>

    <section class="section section--s">
      <div class="wrap">
        <div class="cap__grid">
${p.stats.map(([n, u, l, nota]) => `          <div class="stat" data-reveal><span class="stat__value"><span data-count="${n}">0</span><sub>${u}</sub></span><span class="stat__label">${l}</span><span class="stat__note">${nota}</span></div>`).join('\n')}
        </div>
      </div>
    </section>

    <section class="section" style="background:var(--bg-2)">
      <div class="wrap split">
        <div>
          <span class="eyebrow" data-reveal>Perguntas frequentes</span>
          <h2 class="h2" data-split>O que costumam perguntar antes de contratar.</h2>
        </div>
        <div class="list-rows">
${p.faq.map(([q, a], i) => `          <div class="list-rows__item" data-reveal><span class="idx">0${i + 1}</span><h3 class="h4">${q}</h3><p class="body">${a}</p></div>`).join('\n')}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <div><span class="eyebrow" data-reveal>Projetos relacionados</span><h2 class="h2" data-split style="margin-top:22px">O que já ficou de pé.</h2></div>
          <div class="section-head__side" data-reveal><a class="link-arrow" href="/projetos">Todos os projetos ${SETA}</a></div>
        </div>
        <div class="proj__grid">
${p.cases.map(cardCase).join('\n')}
        </div>
      </div>
    </section>

    <!-- @include cta -->
  </main>
  <!-- @include footer -->
</body>
</html>
`
  writeFileSync(resolve(raiz, `${p.slug}.html`), html)
  console.log('gerado', p.slug + '.html')
}
