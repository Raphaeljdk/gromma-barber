# GROMMA BARBER — revisão das oito gravações de 02/11/2026

> **Estado:** implementação parcial em branch `feat/revisao-videos-20261102` (PR #79). A Issue #78 só pode ser encerrada depois da conferência literal das falas, testes de integração e homologação operacional. Não confundir telas apresentadas no Cash Barber com pedidos expressamente aprovados.

## Fontes recebidas
São oito gravações principais e duas cópias alternativas dos arquivos de 11:16:21 e 11:36:45. As telas foram revisadas visualmente. A transcrição completa do áudio não foi obtida porque a ferramenta de transcrição atingiu o limite da conta.

| Arquivo (início) | Área observada | Implementado nesta PR | Pontos ainda pendentes |
| --- | --- | --- | --- |
| 11:16:21 | Profissionais, documentos e permissões | Atalhos compactos entre as 8 partes do cadastro; preservação do fluxo de foto, documentos, papéis e agenda existente | Conferir literalmente explicações e comparar comportamento de todos os campos e permissões no navegador |
| 11:24:56 | Serviços, comissão, jornadas, cosméticos, bebidas, faixas e bônus | Prévia de faixas de comissão; restauração da regra da categoria com auditoria; cadastro existente preservado | Verificar todos os exemplos de comissão ditados verbalmente e simular cálculo/pote em banco isolado |
| 11:36:45 | Regras de comissão por categoria | Prévia/edição/restauração por categoria | Conferir regra desejada nas falas e a persistência em múltiplas filiais |
| 11:38:52 | Serviços e listas de referência | Mantida a tela de serviços já existente, sem alteração destrutiva | Validar quais detalhes do concorrente precisam ser trazidos |
| 11:39:27 | Cadastro de profissional e parametrização | Navegação e campos já presentes mantidos; comissão por produto melhorada | Verificar a lista falada de campos faltantes |
| 11:52:30 | Filiais, profissionais, formas de pagamento e comandas | Cadastro/edição de filiais com limites do plano, segurança e auditoria; apuração real por filial; testes de caixa/comandas corrigidos | Conferir detalhes específicos falados nas gravações e homologar navegação real no PC/celular |
| 12:00:30 | Marca, logo, cores e site/clube | Configuração por empresa, URL HTTPS/upload com autorização, cor/título/descrição e identidade no convite público | Homologação visual desktop/mobile, tokens Vercel Blob e identidade de outras telas públicas |
| 12:05:20 | Clube de assinaturas, valores, pote | Rateio do pote no comprovante; identidade por estabelecimento no convite | Conferir gravação, portal público e integração financeira automática futura |

## Fluxos novos
1. `components/commission-selection-table.tsx`: pesquisa, filtro por unidade e seleção. Botões de quitação só para proprietário quando a flag estiver habilitada e a apuração incluir todas as unidades.
2. `components/commission-payment-button.tsx`: confirmação explícita de pagamento **já realizado**, forma, data e valor exibido. Não efetua Pix/transferência.
3. `app/erp/[tenant]/commission-payment-actions.ts`: recalcula comissão no servidor, recupera recebimentos/pote, verifica período encerrado, impede sobreposição e garante escrita transacional de `CommissionPayment`, `FinancialEntry` e `AdminAuditLog`.
4. `components/professional-product-commission-editor.tsx` e `professional-actions.ts`: prévia de faixas e restauração da regra com auditoria.
5. `app/erp/[tenant]/branding-actions.ts` e `lib/erp-workspace.ts`: personalização por empresa sem migrações; `app/clube/[tenant]/[token]/page.tsx` exibe marca no convite válido.

## Correções e testes de 03/11/2026
- As **20 falhas já presentes na main** foram resolvidas na branch, sem retirar as regras do negócio: mocks de autenticação e desconto, justificativas obrigatórias para remover itens e reabrir comanda, navegação real, teste de produtividade e atualização dos testes de trocas e recorrência de assinaturas.
- Suíte geral aprovada em **184 testes, 0 falhas** no commit `4407a80541543a48ce1c439740b5566447b30fb8`, workflow GitHub Actions **#41648942547**, além do workflow específico **#41648942640** aprovado (TypeScript, testes de comissão/branding e Next.js build). Os números podem aumentar conforme forem adicionados testes.
- `app/erp/[tenant]/unit-actions.ts` e `page.tsx`: proprietário pode criar/editar unidade; valida o vínculo com tenant, limites ESSENTIAL/PRO, código único e impedimentos de desativação (última unidade, caixa aberto, agenda futura, colaboradores ativos). Guarda auditoria, não apaga históricos. Sete testes automatizados específicos aprovados.
- `app/erp/[tenant]/page.tsx`: cálculo de serviços/produtos passa a considerar `unitId` da comanda quando o filtro de filial é aplicado. Testes verificam separação entre duas unidades e consolidado geral.
- Neon QA criado: projeto `GROMMA BARBER`, branch **`qa-gromma-comissoes-20261103`** (ID `br-billowing-star-b6b58e10`), separada da produção. A produção clonada **não possuía** a tabela `CommissionPayment` nem a migration original marcada como aplicada. Aplicamos a migração original somente em QA.
- Nova migração `20261103093000_commission_no_overlap`: exclui por PostgreSQL períodos de comissão com datas sobrepostas por profissional/empresa, protegendo contra concorrência além do teste server-side. Em Neon QA, o intervalo duplicado e o parcialmente sobreposto foram impedidos; um período posterior não sobreposto foi permitido. Testes SQL revertidos por savepoint; nenhuma quitação de produção foi modificada.
- Reforço: não executamos o fluxo completo de quitação da aplicação em um navegador contra a branch Neon; o que foi testado em banco foi a migração e as restrições. Migrações de produção e habilitação da flag permanecem pendentes.
- Descript: mídia de 11:24:56 importada para biblioteca mas sem transcrição exportável. Tentativa com Agent Underlord bloqueada por **créditos de IA insuficientes**. Não há base para alegar que todas as falas dos oito vídeos foram verificadas.

## Não ligar pagamentos reais ainda
- O fechamento manual depende de `COMMISSION_PAYMENTS_ENABLED=true` e das migrations `20261028030000_commission_payments` e `20261103093000_commission_no_overlap`, ambas ainda NÃO aplicadas na produção clonada. A flag continua desligada.
- Antes de ligar: rodar transação em banco de homologação, testar pagamento repetido e concorrente, duas empresas, várias unidades, CPF/Dados sensíveis, impressão, somas do pote, financeiro e auditoria.
- Sem gateway de pagamento confirmado, o botão **registra pagamento já ocorrido**, sem executar transferência.
- A PR #73 tem uma implementação financeira diferente e está desatualizada; comparar regras antes de reaproveitar qualquer código.

## Qualidade
- O workflow isolado `commission-review-quality.yml` executa novos testes, TypeScript e build. Não substitui a suíte geral do ERP.
- O CI da `main` antes desta PR apresentava 20 falhas. Na branch, elas foram corrigidas e a suíte geral passou com 184/184 em 03/11/2026, mantendo os controles operacionais. A homologação em navegador e banco dedicado ainda é necessária.
- Logs e aprovações no PR #79 são a fonte para saber o estado real. Nunca marcar como publicado enquanto estiver em draft.

## Critérios finais de aceite
- [ ] Transcrever as oito falas integralmente, sem perder pedidos e condições.
- [ ] Registrar evidência em vídeo/tempo de cada regra.
- [ ] Conferir dados reais contra pedidos, sem reset, exclusão ou duplicidade.
- [ ] Testar a experiência de gestão compacta, profissionais, caixa, unidades, clube e personalização em desktop e smartphone.
- [x] Passar suíte geral, TypeScript e Next build em GitHub Actions (184/184).
- [x] Validar a migração e as restrições anti-duplicidade em Neon QA com transações revertidas.
- [ ] Testar pagamento concorrente e o fluxo completo da aplicação em ambiente isolado; conferir registros Financeiro/Auditoria.
- [ ] Aplicar migrações em produção somente no momento autorizado de publicação segura; avaliar dados antigos, manter feature flag desligada antes da homologação.
- [ ] Aprovar o PR, integrar e confirmar publicação na Vercel.
