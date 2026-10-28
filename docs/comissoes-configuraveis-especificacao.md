# GROMMA BARBER — Comissões configuráveis e folha de pagamento

Status: especificação aprovada; implementação pendente.

## Profissionais
- Configurar percentual padrão para serviços.
- Configurar percentual próprio de assinaturas, independente dos serviços.
- Configurar percentual de produtos, valor inicial sugerido de 30%, editável pelo gestor.
- Cadastrar dias da semana, horários de atendimento e serviços habilitados.

## Serviços
- Permitir comissão opcional específica por serviço, percentual ou valor fixo.
- Quando não houver regra específica, usar a comissão padrão do profissional.
- Não somar as duas regras sobre o mesmo atendimento.

## Apuração
- Filtro inclusivo por data inicial e final.
- Colunas: profissional, comandas, assinaturas, produtos, bonificações, descontos, total bruto e a receber.
- Considerar somente transações elegíveis, com vínculo ao profissional, sem duplicar lançamentos.
- Preservar valores e regras aplicadas em pagamentos antigos mesmo após alterações cadastrais.
- Definir base de cálculo de descontos, estornos e cancelamentos antes de liberar pagamentos.

## Pagamento
- Botão Pagar por profissional e período.
- Registrar data, forma de pagamento, usuário responsável e estado da liquidação.
- Evitar pagamentos duplicados e preservar histórico auditável.

## Folha PDF
- Identificação da barbearia e profissional, período, discriminação por origem, bonificações, descontos, total, data, forma e status.
- Disponibilizar download e compartilhamento via WhatsApp.

## Critérios de aceite
- Comissão específica de serviço prevalece sobre a padrão do profissional.
- Assinaturas e produtos usam suas próprias regras.
- Recalcular períodos abertos sem alterar pagamentos quitados.
- Testar filtros, cálculos, pagamento único, reemissão PDF e visualização mobile.
- Não publicar em produção sem migrações revisadas, testes e validação.
