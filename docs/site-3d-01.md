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

- Portas, docas, aberturas, mezaninos e piso não são desenhados.
- «Alvenaria» é desenhada como fechamento total; a opção diz «total ou parcial».
- Validado em navegador de mesa com emulação de celular. Falta teste em aparelhos reais (iOS e Android).
- Capturas em `docs/site-3d-01/antes` e `docs/site-3d-01/depois`.

## Base

Reconciliada em 26/11/2026 com a produção: `origin/main` em `f00893a` (o commit publicado em eiff.com.br, com a
correção P1 de isolamento dos formulários) foi mesclado localmente nesta branch, sem conflito.

## Convenção geométrica única (decisão da Direção de 26/11/2026, opção A)

Inclinação ilustrativa de 10 % sobre o meio vão em todas as representações, definida num só lugar:
`src/simulador/convencao.ts`. O croqui em corte, a ilustração «Volume» e o modelo 3D importam dela a inclinação,
a altura de referência e as proporções das seções. É convenção de desenho, não inclinação de projeto, e as seções
não foram dimensionadas.

| Representação | Antes | Depois |
|---|---|---|
| Croqui em corte | 10 % sobre o meio vão; pilares desenhados para DENTRO do vão | 10 %; pilares para FORA do vão livre |
| Ilustração «Volume» | 7 % sobre o vão inteiro (equivalia a 14 %) | 10 % sobre o meio vão |
| Modelo 3D | 10 % sobre o meio vão | sem mudança |
| «Altura total» do painel (25 m × 8 m) | 9,3 m | 9,3 m (não mudou) |

No croqui, a cota do vão vai de face interna a face interna, a cota do pé-direito vai até a linha inferior da viga
junto ao pilar, a viga fica acima dessa linha e a mísula abaixo dela só no joelho, como no 3D. Os testes do bloco
«convenção única» conferem as três figuras contra a conta escrita à mão em toda a faixa do formulário.

## Correções da revisão visual

- **Modo ampliado.** Passou a abrir num `<dialog>` modal, na camada superior do navegador: nada da página fica por
  cima. Esc fecha pelo evento nativo; o foco volta ao botão; a página atrás fica inerte.
- **Cotas.** Cada rótulo é medido, mantido dentro do palco e testado contra os outros e contra o selo. Sem lugar
  livre junto do ponto medido, o rótulo some em vez de se sobrepor.
- **Chamada comercial.** O botão quebra em duas linhas e nunca passa da borda do cartão.
- **Largura do painel.** Com o botão 3D a mais, o painel estourava a tela em 320 px. A coluna do painel passou a
  poder encolher e os botões ficam compactos em celulares.
- **Grafite.** Materiais difusos (sem metal, que escurecia por não haver mapa de ambiente), luz de preenchimento,
  nervuras mais marcadas, arestas e rodapé claro.
- **Aba inativa.** Ao voltar, a cena pede um quadro novo, e só um.
