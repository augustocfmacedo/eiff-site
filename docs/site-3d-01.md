# SITE-3D-01 — visualização 3D do simulador (protótipo local)

**VISUALIZAÇÃO CONCEITUAL — NÃO É PROJETO EXECUTIVO.** Protótipo na branch `feature/site-3d-01`. Não publicado, não mesclado.

## O que é

Uma quarta vista no painel do simulador (`3D`, ao lado de Volume, Planta e Corte), com três modos — Arquitetura,
Estrutura e Interior —, câmera orbital, vistas predefinidas, zoom, restaurar e ampliar. O modelo é refeito a cada
mudança de vão, comprimento, pé-direito, cobertura e fechamento, sem recarregar a página.

| Arquivo | Papel |
|---|---|
| `src/simulador/geometria3d.ts` | Adaptador puro: configuração → medidas e eixos para desenhar. Sem DOM e sem three.js |
| `src/simulador/cena3d.ts` | A cena. Único módulo do simulador que importa three.js; baixado sob demanda |
| `src/simulador/visual3d.ts` | Liga a página à cena: detecção de WebGL, carga adiada, botões, fallback |
| `src/simulador/geometria3d.test.ts` | Geometria, coerência com o croqui, isolamento e página |

## Medidas que não se confundem

- **Vão livre**: o campo «vão», entre as faces internas dos pilares.
- **Distância entre eixos**: vão livre + seção ilustrativa do pilar.
- **Altura livre**: o campo «pé-direito», até a linha inferior da viga junto ao pilar.
- **Altura de referência na cumeeira**: pé-direito + meio vão × 10 %. É a «Altura total» que o painel já mostrava.

O 3D e o croqui mostram os mesmos números; um teste confere isso em toda a faixa do formulário.

## Hipóteses de representação (aparecem na tela, em «O que esta visualização presume»)

Inclinação de 10 %, pórticos a cada cerca de 6 m, terças e travessas a cada cerca de 1,8 m, pilares de oitão a cada
cerca de 6 m, contraventamento nos módulos de extremidade, seções nas proporções do croqui. Nada disso é dado de
projeto e nada foi dimensionado.

## Garantias

- A página abre sem three.js. A cena só é baixada depois da primeira tela, quando o painel aparece.
- Sem WebGL, com falha de download, com perda de contexto ou com `?3d=0`, a página fica com as ilustrações e o croqui.
- O formulário não ganhou campo nenhum; os botões do 3D são `type="button"` e sem `name`.
- A cena não fala com rede, laboratório nem serviço de engenharia, e não mostra grandeza calculada.

## Limitações conhecidas

- No croqui em corte a espessura ilustrativa cresce para DENTRO do vão; no 3D, para fora. Os números são os mesmos,
  mas o croqui deveria ser alinhado antes da homologação.
- A ilustração «Volume» usa caimento de 7 % e o croqui e o 3D usam 10 %: divergência anterior a esta etapa.
- Portas, docas, aberturas, mezaninos e piso não são desenhados.
- «Alvenaria» é desenhada como fechamento total; a opção diz «total ou parcial».
- Validado em navegador de mesa com emulação de celular. Falta teste em aparelhos reais (iOS e Android).
- A base desta branch é a `main` local. A correção `fix/p1-isolamento-formularios` não está na `main`.
