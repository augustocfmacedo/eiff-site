# EIFF — site institucional

Presença digital da EIFF (engenharia, fabricação e construção industrializada) para `www.eiff.com.br`.
Site estático, sem framework de UI: HTML por página + CSS + TypeScript, com GSAP (ScrollTrigger, SplitText, DrawSVG),
Lenis (scroll suave) e Three.js (cenas em linhas: hero e Processo).

## Comandos

- `npm run dev` — desenvolvimento em `http://localhost:5180`
- `npm run build` — checagem de tipos + build em `dist/`
- `npm run preview` — serve o `dist/`

Publicação no Netlify: `netlify.toml` já aponta `npm run build` → `dist/`; `public/_redirects` cria as rotas limpas
(`/empresa`, `/engenharia`…) e a 404. O formulário de contato usa Netlify Forms (`name="iniciar-projeto"`); o destino da
notificação (e-mail) é configurado no painel do Netlify.

## Estrutura

- `index.html`, `empresa.html`, `engenharia.html`, `fabricacao.html`, `solucoes.html`, `produtos.html`, `projetos.html`,
  `tecnologia.html`, `contato.html`, `404.html` — HTML completo por página (SEO), com partials injetados no build.
- `src/partials/` — `head`, `nav` (preloader, cortina, cursor, menu, lightbox), `footer`, `cta`, `simbolo`.
  Uso: `<!-- @include nome -->` (plugin em `vite.config.ts`).
- `src/styles/` — `tokens` (cores, tipos, espaçamentos), `base`, `components`, `home`, `pages`.
- `src/core/app.ts` — scroll suave, preloader, transição entre páginas, navegação, cursor, botões magnéticos,
  reveals/split de texto, contadores, lightbox do YouTube.
- `src/home/desenho.ts` — vocabulário 3D (galpão 40 m × 12 m em segmentos com ordem de desenho, terreno com
  curvas de nível, material de linha com frente de desenho e fade). `hero3d.ts` (abertura) e `processo3d.ts`
  (sete etapas conduzidas pelo scroll) usam o mesmo vocabulário. `filme.ts` sincroniza copy e trilho;
  `secoes.ts` cuida de manifesto, engenharia (SVG progressivo), destaque, fabricação horizontal, soluções.
- `public/img/` — stills e posters extraídos das filmagens da EIFF, usados nas páginas internas e nas soluções.

## Regras de marca aplicadas

- EIFF não é sigla; referência conceitual a Gustave Eiffel. Sem vínculo institucional.
- `#c84119` só como assinatura (CTAs, cotas, indicadores). Base preto/grafite/aço/branco quente.
- Mostrar > afirmar: números só com obra correspondente (Aparecida de Goiânia, Cabo Frio, Goiânia).
  Capacidade fabril, toneladas e área acumulada ficam marcados como "em consolidação" até haver documentação.
- `prefers-reduced-motion` desliga scroll suave, cortina, cursor e cenas animadas (estrutura aparece pronta).
