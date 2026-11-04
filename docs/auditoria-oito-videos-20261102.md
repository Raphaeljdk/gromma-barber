# GROMMA BARBER — auditoria de requisitos dos oito vídeos (02/11/2026)

**Referência:** Issue #78. Transcrição automática das oito gravações processada no Descript em 04/11/2026, duração total aproximada de 48 minutos. Ruídos, troca de interlocutores e alguns erros de reconhecimento exigem validação humana para definições financeiras.

## Fontes de transcrição

| Horário do vídeo | Projeto Descript | Tema predominante |
|---|---|---|
| 11:16:21 | https://web.descript.com/1a1e95bd-79d7-4112-8ffb-4fc173109be0 | Ficha de profissional, foto, contratos, grupos e privacidade |
| 11:24:56 | Mesmo projeto | Seleção múltipla de serviços, horários e persistência de posição da tela |
| 11:36:45 | https://web.descript.com/739a394e-6ff1-4329-a03c-ac1eed125157 | Referências visuais da jornada; áudio com falhas |
| 11:38:52 | Primeiro projeto | Ligação interrompida, sem requisito funcional |
| 11:39:27 | Segundo projeto | Layout compacto, comissões de produtos e bonificação de assinatura |
| 11:52:30 | Segundo projeto | Lista de equipe, profissional em destaque, parâmetros de filial e pote |
| 12:00:30 | Segundo projeto | Marca e dados empresariais, URL, taxas e primeira experiência do app |
| 12:05:20 | https://web.descript.com/793c3020-9760-4cc8-b658-c4c5f3ded44a | Cancelamento, não comparecimento, nome do clube, percentual do pote |

## Matriz de cobertura do código

Legenda: ✅ existente; 🔧 correção na PR #81; ⚠️ parcial; ⛔ não comprovado ou não implementado. A marcação é uma auditoria **estática** de código, não uma afirmação de funcionamento integral em produção.

| Pedido identificado | Estado | Evidência ou lacuna |
|---|---|---|
| Ficha em página completa | ⚠️ | `app/erp/[tenant]/equipe/novo/page.tsx` cria identificação e abre ficha detalhada depois de salvar; são duas etapas |
| Eliminar campo de URL da foto | 🔧 | PR #81 oculta campo duplicado, preservando URL já salva; upload por `uploadProfessionalPhoto` |
| Anexar contrato PDF do computador | ⚠️ | `saveProfessionalSection` seção `contract-add` aceita **URL HTTPS**, não upload privado de PDF |
| Grupos por perfil de acesso | ⚠️ | `lib/role-permissions.ts`, `saveRolePermissions`; configura papéis gerais, mas a granularidade solicitada no vídeo ainda não está integralmente representada |
| Permissões adicionais individuais | ✅ | `app/erp/[tenant]/equipe/[userId]/page.tsx` e seção `permissions`; verificar cada ação/endpoint antes de liberar capacidades novas |
| Restringir PII do cliente ao barbeiro | ⚠️ | `app/erp/[tenant]/page.tsx` redireciona BARBER ao painel de profissional; checar todos os fluxos da agenda e app para garantir mascaramento consistente |
| Selecionar/desmarcar todos os serviços | 🔧 | PR #81 `ProfessionalServiceBatchEditor`; filtro e seleção em massa |
| Editar comissão (%) de múltiplos serviços | 🔧 | PR #81 aplica percentual aos selecionados com limite 0–100 e mantém server action auditada |
| Remover vários serviços de uma vez | 🔧 | PR #81 desmarca serviços em massa; salva lista permitida sem deletar serviços do catálogo |
| Jornada semanal e pausas | ✅ | `professional-actions.ts` seção `schedule` / `break-add`; conflito com agendamentos existente |
| Lista de intervalos crescendo abaixo dos controles | ⚠️ | Formulário e lista existentes, mas layout ainda não coincide integralmente com a referência visual do vídeo |
| Não voltar ao topo ao salvar seção | 🔧 | PR #81 redireciona para âncora da seção alterada |
| Comissão de produtos fixa ou escalonada | ✅ | `professional-product-commission-editor.tsx`, `lib/product-commission-rules.ts` |
| Bonificação de venda de assinaturas por meta | ⚠️ | `base-commissions` e `subscription-tiers` existentes; UI ainda expõe opções separadas, que o vídeo propõe consolidar |
| Profissional de destaque no app público | ⛔ | Não identificada configuração integrada ponta a ponta na pesquisa de código |
| Lista de equipe com filtro por unidade e exclusão segura | ⚠️ | Navegação e equipe existem; verificar filtro e operação de desativação, preferível a exclusão física sem preservação de histórico |
| Editar informações completas por filial | ⚠️ | `unit-actions.ts` salva nome/código/cidade/UF/endereço/ativo; CNPJ, meios e taxa por unidade não aparecem nesse fluxo |
| Conta PJ e chave Pix por filial | ⛔ | Não há cadastro e **verificação de titularidade** bancária demonstrados. Não declarar conta como PJ apenas pelo formato da chave |
| Formas de pagamento, taxas e prazos por filial | ⛔ | Não há módulo integrado/validado por filial com conciliação e recebíveis |
| Percentual do pote independente por filial | ⚠️ | `subscriptionPot.percent` é configuração do workspace; não é taxa específica de cada filial |
| Branding: logo, cor, nome do clube | ✅ | `branding-actions.ts` e seção `configuracoes` |
| URL personalizada, telas e fotos do onboarding do cliente | ⚠️ | Multitenancy possui tenant/slug e branding básico; apresentação visual por unidade é trabalho adicional |
| Receita de implantação, mensalidade e taxa por assinatura para a plataforma | ⛔ | Requer modelo comercial, split/taxas definidos e infraestrutura financeira segregada; não confundir com comissão do barbeiro |
| Prazos de cancelamento, bloqueio por ausência e penalidades | ⛔ | Exemplo verbal: 1h de antecedência e penalidade de 12h; é configuração **por unidade**, ainda não comprovada no fluxo real |
| Reduzir rolagem e cliques | ⚠️ | Parte da ficha e módulos estão compactados, mas a referência dos vídeos requer revisão visual mais ampla |

## Condições para dar baixa na Issue #78

1. PR #81 aprovada por CI e testes, integrada ao `main`, publicação Vercel READY e checagem de navegação em computador/celular.
2. Confirmar e implementar os requisitos marcados com ⚠️/⛔ em PRs isoladas, sem alteração indevida da base produtiva.
3. Para requisitos financeiros (Pix/conta PJ, taxas da plataforma, pote por filial), definir regras com a gestão e validar titularidade/conciliação antes de armazenar ou movimentar valores.
4. Para documentos do profissional, usar armazenamento com acesso controlado, não um PDF público por URL enumerável.
5. Revisar trechos ambíguos dos áudios antes de decidir percentuais ou regras definitivas.

A transcrição está concluída; a **auditoria de implementação e as lacunas estão em aberto** até que cada item tenha evidência e teste correspondente.
