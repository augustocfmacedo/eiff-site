# Privacidade — o que a política promete e quem executa

A página `/privacidade/` é pública e faz promessas. Este documento é o lado de dentro: quem executa cada
promessa, com que frequência, e o que ainda falta decidir. **Não é texto de enfeite — é o que torna a
política verdadeira.** Se uma rotina aqui deixar de ser executada, a política passa a mentir, e corrigir o
texto é mais honesto do que manter a promessa.

Vale para o site `eiff.com.br` e para os dois formulários: `iniciar-projeto` e `simular-galpao`.

## 1. Controlador — pendente de decisão do titular do negócio

A política identifica o controlador por **marca, endereço da fábrica e canal de contato**, e diz que razão
social e CNPJ são informados a quem pedir pelo canal. Falta a identificação societária completa.

O que falta **não é um número, é uma decisão**: qual pessoa jurídica responde pelos leads de `eiff.com.br`.
Não é dedutível de fora, e preencher por presunção é pior do que deixar incompleto — controlador errado é um
defeito jurídico real e uma afirmação pública sobre um terceiro.

Para fechar, o titular do negócio informa:

1. a razão social completa da pessoa jurídica controladora;
2. o CNPJ dela;
3. se é essa mesma entidade que figura nas respostas aos titulares.

Então: substituir a frase do canal, no bloco "Quem é o controlador", por razão social e CNPJ, e liberar o
teste `a política não publica dado societário presumido` em `src/simulador/pagina.test.ts` — que hoje recusa
qualquer coisa com cara de CNPJ no arquivo, de propósito.

## 2. Encarregado de dados — termo não usado até designação formal

O art. 41 da LGPD manda o controlador **indicar** um encarregado e divulgar a identidade dele. Um endereço de
e-mail não é identidade de pessoa, e não há designação formal registrada.

Por isso a página diz **"Contato para privacidade"**, e não "Encarregado de dados": o canal é verdadeiro, o
cargo não seria. Um teste impede que o termo volte sem designação.

Para passar a usar o termo: designar formalmente a pessoa (ato interno, com data), divulgar nome e cargo, e só
então trocar o rótulo.

## 3. Retenção — 24 meses

A política promete eliminar em até **24 meses do último contato** as solicitações que não viraram projeto, em
*todos* os lugares onde o pedido parou, com conferência semestral.

**Responsável:** quem responde pelo canal `contato@eiff.com.br` — hoje, a diretoria. A rotina é de quem tem
acesso ao painel do Netlify e à caixa comercial; se esse acesso mudar de mãos, a responsabilidade vai com ele.

**Quando:** revisão semestral, em **janeiro** e **julho**. A primeira roda no mês seguinte à publicação da
landing, para que a rotina já tenha existido antes do primeiro vencimento de prazo.

**O que fazer, em ordem:**

1. **Netlify.** Painel → Forms → cada formulário → ordenar por data → selecionar as submissões cujo último
   contato passou de 24 meses e que não viraram contrato → *Delete submission*. É o registro-mestre: enquanto
   ele existir, o dado existe.
2. **E-mail.** A notificação do Netlify manda uma cópia integral do lead para `contato@eiff.com.br`. Apagar as
   mensagens correspondentes, **inclusive da lixeira e dos itens enviados** quando o lead foi reencaminhado
   internamente. Cópia em caixa de e-mail é a que mais sobrevive a faxina de banco de dados.
3. **Exportações.** Qualquer CSV baixado do painel, planilha de acompanhamento comercial ou relatório de
   campanha que contenha nome, e-mail, telefone ou identificador de clique: apagar as linhas vencidas. Se a
   planilha não distingue data de último contato, ela não serve para guardar lead — refazer a partir do painel.
4. **Registro.** Anotar data da revisão, quantas submissões foram eliminadas e por qual critério. Sem registro
   não há como provar à ANPD que a rotina existe.

**Contrato assinado é exceção:** o prazo passa a ser o da legislação civil, fiscal e trabalhista. Esses leads
saem da contagem de 24 meses — e precisam estar identificáveis como tal antes da faxina.

**Pedido do titular chega antes do prazo:** executar os passos 1 a 3 só para aquele titular e responder em até
15 dias, como a política promete.

## 4. Oposição à medição de campanha

A política diz que o titular pode se opor ao uso da origem da visita e do identificador de clique para medir
campanha, e que isso **não** afeta o atendimento do pedido dele.

Na prática: parar de usar aqueles campos nos relatórios e retirar as linhas das planilhas de acompanhamento.
O registro original no Netlify não é editável campo a campo — ele sai inteiro pela retenção, no prazo normal.
A política foi escrita para dizer exatamente isso, e não mais: não prometa apagar um campo de dentro de uma
submissão do Netlify, porque não dá.

## 5. Conversões para plataformas de publicidade — desligado nesta fase

Nada é devolvido ao Google ou a qualquer rede: sem tag de anúncio, sem pixel, sem público de remarketing, sem
importação de conversão offline. O identificador de clique é coletado e guardado, mas **não sai**.

O código está preparado para que isso seja possível depois (o `gclid` chega íntegro, com `wbraid` e `gbraid`
para iOS), e é justamente por isso que a decisão é explícita: **ligar a importação de conversões exige alterar
a política antes**, porque passa a existir compartilhamento com terceiro para fim publicitário. Ordem correta:
decidir, atualizar `/privacidade/`, publicar, só então ligar.

## 6. Fornecedores

| Fornecedor | Papel | Dado que vê |
| --- | --- | --- |
| Netlify | hospedagem e recebimento dos formulários | o lead inteiro |
| Umami Cloud | audiência agregada | sem dado pessoal, sem cookie |
| Google Fonts | fontes | IP do visitante, no carregamento |

Os três operam fora do Brasil — a política declara a transferência internacional. Fornecedor novo que toque
dado de formulário entra nessa tabela e na política antes de entrar no site.
