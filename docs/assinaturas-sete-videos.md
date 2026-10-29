# Assinaturas — requisitos dos sete vídeos

Fonte: os sete MP4 anexados à conversa, transcritos e conferidos individualmente. As alterações são aditivas: não há migração, preenchimento fictício ou reescrita automática de dados existentes.

| Vídeo | Pedido | Implementação e conferência |
| --- | --- | --- |
| a85f7d81 | Tirar os indicadores de Relatórios e levar para Operacional → Dashboard; deixar a página principal de Relatórios sem dashboard | Indicadores, rankings e visões consolidadas aparecem no Dashboard. Relatórios mantém apenas o cabeçalho e a navegação para as subtelas. |
| 7302d4ec | Lista de assinantes, plano anterior, plano adquirido/atual, data e histórico de upgrade/downgrade | Gestão → Relatórios → Assinaturas → Troca de assinatura. Cada troca preserva nomes e valores daquele momento. Sem período, assinantes sem trocas também aparecem. |
| d2bfa19e | Cancelados por período com início e fim | Cancelados por período: cliente, plano, contratação e cancelamento; filtro inclusivo por data em São Paulo. Cancelamentos antigos sem data aparecem apenas sem período. |
| 171e87b7 | Pagamentos do cliente, datas de início/vencimento/captura, período, busca por nome e botão de estorno | Históricos de transações: cobranças vinculadas e pagamentos do Financeiro; busca por nome/descrição; período; solicitação e registro de estorno. |
| 6a3ac3d9 | Nome, plano, contratação, vencimento; dashboards de clientes, assinaturas, valor bruto, adimplentes e inadimplentes | Quantidade de assinantes com os cinco indicadores; busca por nome, plano e status combináveis, paginação e Limpar filtros. |
| d06e9a5f | Vendas por período, início/fim e plano opcional | Vendas novas por período lista contratações e valor original, com filtros e total. Cobranças recorrentes não contam como novas vendas. |
| 7f9abfa8 | Cliente informa vendedor; origem agrupada por vendedor, período/plano, total, valor, data e plano | Cadastro interno recebe vendedor. Em Clube / Assinaturas, gerar link individual permite ao cliente escolher plano e vendedor. Vendas por origem agrupa por vendedor e lista as contratações. |

## Limite da integração financeira

O áudio de 171e87b7 descreve a plataforma de cobrança recorrente como integração futura, sem indicar fornecedor. Nenhuma API de pagamento foi presumida ou conectada.

- A contratação gera somente um recebível interno pendente, sem débito bancário/cartão.
- A captura exibida corresponde à data de baixa registrada no Financeiro até haver integração.
- “Estornar” registra uma solicitação, sem movimentar dinheiro.
- “Confirmar devolução realizada” exige confirmação explícita e referência do comprovante. Registra uma saída compensatória de mesmo valor, mantém o pagamento original e grava auditoria. Não executa a devolução bancária.
- Cobrança recorrente automática, captura por webhook e estorno via API dependem da escolha/configuração do gateway.

## Preservação do histórico

Novas contratações registram vendedor, origem, valor e plano; trocas e cancelamentos registram eventos. Cobranças novas ganham vínculo com assinante e período. Registros antigos sem esses dados exibem “Não registrado”/“Sem vínculo histórico”; nenhum preço ou vendedor é inventado. O indicador de inadimplência considera vencimento de recebíveis vinculados e, para o legado sem vínculo, o vencimento cadastrado da assinatura.

## Roteiro de aceitação

Use um ambiente de teste para operações de contratação, cobrança e estorno. As consultas podem ser conferidas em produção sem alterar dados.

1. Abrir o Dashboard e localizar Visões de acompanhamento; abrir Relatórios e conferir que esse painel não aparece lá.
2. Em Quantidade de assinantes, combinar parte do nome (inclusive sem acento), plano e status. Conferir contratação, vencimento, lista, contagem e indicadores; trocar de página e limpar filtros.
3. Em Clube / Assinaturas, cadastrar uma assinatura de teste com vendedor e primeira cobrança. Conferir que a venda aparece uma vez em Vendas por período e Vendas por origem.
4. Trocar o plano para valor maior e depois menor. Conferir duas linhas no histórico, valores/classificação preservados e plano atual correto. Cobranças anteriores mantêm seus valores.
5. Cancelar essa assinatura. Conferir data em Cancelados por período, incluindo a data final. Repetir o cancelamento não duplica o evento.
6. Gerar um link para outro cliente de teste, abrir e escolher plano/vendedor. Após contratar, conferir a origem do vendedor e que reutilizar o link não cria outra assinatura. Link expirado ou de outra barbearia não deve dar acesso.
7. Registrar uma baixa de teste no Financeiro. Em Históricos de transações, filtrar por nome e data da baixa, conferir as datas e solicitar estorno. A solicitação não cria saída. Somente confirmar uma devolução já realizada deve criar uma saída; repetir a confirmação não a duplica.

## Verificação técnica

Testes cobrem: isolamento por barbearia, vendedor/cliente inválido, duplicidade de contratação/cobrança, snapshots de troca, cancelamento idempotente, confirmação de estorno e auditoria, links expirados/reutilizados, datas inclusivas em São Paulo, filtros combinados, legado e renderização dos seis relatórios. Testes locais usam dados em memória e não acessam registros reais.
