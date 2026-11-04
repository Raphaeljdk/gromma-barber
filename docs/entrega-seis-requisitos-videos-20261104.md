# GROMMA BARBER — implantação das seis solicitações dos vídeos (04/11/2026)

Repositório: `Raphaeljdk/gromma-barber`. Referência: Issue #78.
A implementação preserva o banco Prisma: configurações de filial, destaques e identidade visual são guardados no JSON versionado `enabledFeatures.operations`, com leitura de dados antigos e auditoria.

## 1. Contratos PDF privados

- Envio de PDF de até **3 MB**, com verificação de cabeçalho `%PDF-`, apenas pela ficha acessível ao proprietário.
- Upload pelo SDK `@vercel/blob >= 2.3`, exclusivamente `access:"private"`, usando `GROMMA_PRIVATE_BLOB_TOKEN`; bloqueado se o token não existir.
- Download autenticado em `/erp/[tenant]/equipe/[userId]/contrato/[contractId]`, com validação de empresa/proprietário/profissional/contrato, sem cache, como anexo. Links de contratos antigos são preservados.
- `next.config.ts` permite 4 MB de body em server actions; contrato tem limite de 3 MB para respeitar o teto de 4,5 MB do Vercel Functions.
- **Ativação pendente:** conectar um Blob **privado** ao projeto e cadastrar um token do store privado sob `GROMMA_PRIVATE_BLOB_TOKEN` nos ambientes Vercel. **Não** reutilizar `BLOB_READ_WRITE_TOKEN` do store público (fotos/logos); não gravar contratos em armazenamento público. Foi criado o store privado `gromma-professional-contracts-private`, ainda sem associação/credencial no projeto. Após configurar, redeploy e teste de upload/download autenticado. Não compartilhar tokens.

## 2. Destaque no app

- Proprietário marca/desmarca profissional ativo da unidade/equipe; ação auditada, com limite de 12 destaques.
- Página pública responsiva `/barbearia/[tenant]` exibe primeiro os destacados, com selo, nome/apelido, foto se autorizada e unidade.
- Página pública **não** envia CPF, e-mail, telefones pessoais ou outros dados sensíveis do profissional.
- Trata-se da experiência **web/mobile**. Publicação em Apple Store/Google Play não está incluída.

## 3. Financeiro por filial

- Campos por filial: CNPJ (dígitos verificadores), e-mail e telefone, chave Pix (CNPJ/e-mail/+55/chave aleatória), tipos de pagamento, taxas de débito/crédito e dias de recebimento.
- No checkout, métodos desativados são ocultados e bloqueados **também no servidor** (uma requisição forjada não os aceita).
- A configuração **não valida titularidade de conta PJ nem executa PIX, split, tarifas ou conciliação**. Para isso é necessário conectar um PSP/banco, validar CNPJ/titularidade e homologar as regras de liquidação.
- Dados pessoais de recebimento não são copiados para o histórico de auditoria.

## 4. Pote por unidade

- Percentual específico opcional em cada filial; vazio herda o percentual geral anterior.
- Cálculo de recebimentos líquidos por unidade, devoluções por unidade e alocação por atendimentos elegíveis da **mesma filial**; consolidação mantém controle de centavos.
- Recebimentos sem unidade e atendimentos sem atribuição confiável permanecem sem rateio. O cálculo é uma prévia; **não transfere dinheiro**.
- Testes com unidades de 20% e 40% impedem contaminação do rateio entre filiais.

## 5. Personalização da experiência do cliente

- Configuração por empresa: título da abertura, mensagem/descrição, imagem de capa HTTPS, cor, logotipo e identidade do clube.
- Configuração por unidade: foto de capa e mensagem de boas-vindas.
- Página pública responsiva permite conhecer equipe/destaques e endereços, com contato por telefone cadastrado da unidade.
- Não há conta de cliente com login/agendamento self-service completa nesta atualização; não prometer funcionalidades inexistentes.

## 6. Cancelamento e penalidade por falta

- Configuração por filial de antecedência mínima em minutos e bloqueio por falta em horas (zero desliga). Valor inicial zero protege o comportamento dos clientes existentes.
- Ao criar um agendamento com cliente associado, uma falta (NO_SHOW) recente na filial bloqueia nova reserva durante o período configurado. Há checagem preliminar e repetição dentro da transação, com aviso claro na agenda.
- A equipe ainda pode cancelar/reagendar conforme suas permissões; a antecedência mínima para **cancelamento online pelo próprio cliente** está preparada como regra mas depende de um portal do cliente autenticado, que não existe no repositório atual. Não declarar penalização de cancelamento online já aplicada.
- Não existe cobrança automática de multa, restrição de outra filial nem alteração retroativa de agendamentos antigos.

## Validação e liberação

Testar `npm test`, `npx tsc --noEmit`, `npm run build`, navegação autenticada e deployment Vercel READY antes de declarar produção. Nenhuma migração destrutiva, chave de produção exposta, transação financeira real ou pagamento de comissão autorizado por este PR.
