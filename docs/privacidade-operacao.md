# Privacidade — o que a política promete e quem executa

A página `/privacidade/` é pública e faz promessas. Este documento é o lado de dentro: quem executa cada
promessa, com que frequência, e o que ainda falta decidir. **Não é texto de enfeite — é o que torna a
política verdadeira.** Se uma rotina aqui deixar de ser executada, a política passa a mentir, e corrigir o
texto é mais honesto do que manter a promessa.

Vale para o site `eiff.com.br` e para os dois formulários: `iniciar-projeto` e `simular-galpao`.

> **Estado: nada disto está em execução hoje.** A landing não foi publicada. As rotinas abaixo entram em
> vigor na publicação, e a publicação depende de a diretoria confirmar que elas serão executadas. Enquanto
> isso, a página pública **não declara nenhuma rotina como se já estivesse rodando** — só o prazo que será
> cumprido. Regra geral: o que não estiver operacional não aparece na política.

## 1. Controlador — pendente de decisão do titular do negócio

A política identifica o controlador por **marca, endereço da fábrica e canal de contato**, e diz que razão
social e CNPJ são informados a quem pedir pelo canal. Falta a identificação societária completa.

O que falta **não é um número, é uma decisão**: qual pessoa jurídica responde pelos leads de `eiff.com.br`.
Não é dedutível de fora, e preencher por presunção é pior do que deixar incompleto — controlador errado é um
defeito jurídico real e uma afirmação pública sobre um terceiro.

Para fechar, a diretoria informa:

1. a razão social completa da pessoa jurídica controladora;
2. o CNPJ dela;
3. que é essa mesma entidade que **responde efetivamente pelos dados do site** — quem recebe os leads, decide
   sobre eles e responde ao titular e à ANPD. Se quem recebe e quem responde não forem a mesma entidade,
   isso precisa ser dito antes, porque muda o texto.

Então: substituir a frase do canal, no bloco "Quem é o controlador", por razão social e CNPJ, e liberar o
teste `a política não publica dado societário presumido` em `src/simulador/pagina.test.ts` — que hoje recusa
qualquer coisa com cara de CNPJ no arquivo, de propósito.

## 2. Responsável operacional

**Augusto Cesar Faria Macedo, pela diretoria da EIFF**, responde por três coisas: a revisão mensal de
retenção, a eliminação dos dados vencidos e o atendimento dos pedidos dos titulares em até 15 dias.

A designação segue o acesso: a rotina só pode ser feita por quem tem o painel do Netlify e a caixa
`contato@eiff.com.br`. Se esse acesso passar a outra pessoa, a responsabilidade passa junto — e este
documento é atualizado no mesmo dia, com a data da troca. Responsável sem acesso é responsável no papel.

Enquanto não houver segunda pessoa com esses acessos, não há suplente: se o responsável ficar indisponível
no mês da revisão, a revisão atrasa, e a margem do item 4 existe justamente para absorver um atraso.

## 3. Onde o lead é registrado — o Netlify não basta

O painel do Netlify guarda **a submissão e a data em que ela chegou**. Só isso. Ele não sabe quando foi o
último contato comercial, não sabe se virou contrato e não tem onde anotar nenhum dos dois. Como a política
promete eliminar "em até 24 meses **do último contato**" e excetua quem tem contrato, esses dois fatos
precisam morar em algum lugar — senão a promessa não é verificável, e a exceção vira porta aberta.

**Registro:** uma planilha única, `Controle de leads — EIFF`, no Drive da empresa, com acesso restrito a quem
tem os acessos do item 2. **Criar antes da publicação** — é tarefa de pré-publicação, não de depois.

Uma linha por lead, com:

| Coluna | Quem preenche | Observação |
| --- | --- | --- |
| Data de entrada | copiada do painel do Netlify | único dado que o Netlify garante |
| Nome e e-mail | copiados do lead | é o que casa a linha com a submissão |
| Formulário | `iniciar-projeto` ou `simular-galpao` | |
| **Data do último contato** | quem falou com o lead, **a cada contato** | se estiver vazia, vale a data de entrada |
| **Status** | comercial | `Sem contato` · `Em negociação` · `Contrato assinado` · `Perdido` |
| Referência do contrato | comercial | obrigatória para o status `Contrato assinado` |
| Eliminar a partir de | calculada: último contato + 22 meses | é a coluna pela qual a revisão filtra |
| Eliminado em | quem executou a revisão | fecha a linha |

Duas regras que fazem o registro funcionar mesmo malcuidado:

- **Campo vazio conta contra a EIFF, nunca contra o titular.** Sem data de último contato, vale a data de
  entrada — o que só antecipa a eliminação. Nunca o contrário.
- **A exceção precisa ser marcada, não lembrada.** Só sai da contagem de 24 meses o lead com status
  `Contrato assinado` **e** referência do contrato preenchida. Linha não marcada é eliminada, ponto.

## 4. Retenção — revisão mensal, corte em 22 meses

A política promete eliminar em até **24 meses do último contato**. **Revisão semestral não garante isso**:
um lead que completasse 24 meses logo depois de uma revisão esperaria até seis meses pela seguinte, e seria
eliminado com até 30 meses. A promessa quebraria sozinha, sem ninguém errar.

Por isso a rotina é **mensal, com corte antecipado**:

- **Quando:** todo dia **5**, ou no primeiro dia útil seguinte.
- **Corte:** eliminar tudo cujo último contato (ou, na falta dele, a data de entrada) tenha completado
  **22 meses**.
- **Pior caso:** um lead que completa 22 meses no dia 6 espera a revisão do mês seguinte e é eliminado com
  **23 meses** — um mês inteiro de margem antes do prazo prometido. A rotina tolera **uma** revisão perdida
  sem furar os 24 meses; duas, não.

**O que fazer, em ordem:**

1. **Planilha.** Filtrar por `Eliminar a partir de` vencida e status diferente de `Contrato assinado`. Essa
   lista é o trabalho do mês.
2. **Netlify.** Painel → Forms → o formulário → localizar cada submissão da lista → *Delete submission*. É o
   registro-mestre: enquanto ele existir, o dado existe.
3. **E-mail.** A notificação do Netlify manda uma cópia integral do lead para `contato@eiff.com.br`. Apagar
   as mensagens correspondentes, **inclusive da lixeira e dos itens enviados** quando o lead foi
   reencaminhado internamente. Cópia em caixa de e-mail é a que mais sobrevive a faxina de banco de dados.
4. **Exportações.** Qualquer CSV baixado do painel, planilha de acompanhamento comercial ou relatório de
   campanha que contenha nome, e-mail, telefone ou identificador de clique: apagar as linhas vencidas.
5. **Fechar a linha.** Preencher `Eliminado em` na planilha.
6. **Registrar a execução** (item 5 abaixo).

**Contrato assinado é exceção:** o prazo passa a ser o da legislação civil, fiscal e trabalhista, e a linha
sai da contagem — desde que marcada como manda o item 3.

**Pedido do titular chega antes do prazo:** executar os passos 2 a 5 só para aquele titular, e responder em
até 15 dias, como a política promete. Não espera a revisão do mês.

## 5. Registro verificável da execução

Sem registro datado não há como mostrar à ANPD que a rotina existe — e uma rotina que ninguém consegue provar
é, para todos os efeitos, uma rotina que não existe.

Na mesma planilha, aba `Execuções`, uma linha por revisão:

| Data | Quem executou | Data de corte usada | Linhas eliminadas | Netlify | E-mail | Exportações | Observações |
| --- | --- | --- | --- | --- | --- | --- | --- |

As três colunas de lugar são marcadas uma a uma, na execução — não no fim, de memória. Revisão em que não
havia nada a eliminar **também gera linha**, com zero: é ela que prova que o mês não foi pulado.

## 6. Oposição à medição de campanha

A política diz que o titular pode se opor ao uso da origem da visita e do identificador de clique para medir
campanha, e que isso **não** afeta o atendimento do pedido dele.

Na prática: parar de usar aqueles campos nos relatórios e retirar as linhas das planilhas de acompanhamento.
O registro original no Netlify não é editável campo a campo — ele sai inteiro pela retenção, no prazo normal.
A política foi escrita para dizer exatamente isso, e não mais: não prometa apagar um campo de dentro de uma
submissão do Netlify, porque não dá.

## 7. Conversões para plataformas de publicidade — desligado nesta fase

Nada é devolvido ao Google ou a qualquer rede: sem tag de anúncio, sem pixel, sem público de remarketing, sem
importação de conversão offline. O identificador de clique é coletado e guardado, mas **não sai**.

O código está preparado para que isso seja possível depois (o `gclid` chega íntegro, com `wbraid` e `gbraid`
para iOS), e é justamente por isso que a decisão é explícita: **ligar a importação de conversões exige alterar
a política antes**, porque passa a existir compartilhamento com terceiro para fim publicitário. Ordem correta:
decidir, atualizar `/privacidade/`, publicar, só então ligar.

## 8. Fornecedores

| Fornecedor | Papel | Dado que vê |
| --- | --- | --- |
| Netlify | hospedagem e recebimento dos formulários | o lead inteiro |
| Umami Cloud | audiência agregada | sem dado pessoal, sem cookie |
| Google Fonts | fontes | IP do visitante, no carregamento |

Os três operam fora do Brasil — a política declara a transferência internacional. Fornecedor novo que toque
dado de formulário entra nessa tabela e na política antes de entrar no site.

## 9. O que a política pode dizer

A regra que mantém os dois lados alinhados: **a página pública declara prazos e direitos; este documento
declara rotinas.** A política promete o resultado (eliminação em até 24 meses, resposta em 15 dias) porque o
resultado é o que o titular pode cobrar. Ela não descreve cadência, planilha, responsável nem ferramenta —
não porque sejam segredo, mas porque descrever um processo é afirmar que ele roda, e afirmação dessas só se
faz depois que ele roda.

Consequência prática: mudar a cadência ou a ferramenta aqui não exige mexer na política. Mudar o **prazo**,
os **lugares** onde a eliminação alcança ou as **finalidades** exige — e a política muda antes.

## Antes de publicar

- [ ] Razão social, CNPJ e confirmação de quem responde pelos dados (item 1).
- [ ] Planilha `Controle de leads — EIFF` criada, com as colunas do item 3, e os leads existentes migrados.
- [ ] Diretoria confirma que a revisão mensal do item 4 será executada.
- [ ] Apagar do painel os leads de teste da homologação.
