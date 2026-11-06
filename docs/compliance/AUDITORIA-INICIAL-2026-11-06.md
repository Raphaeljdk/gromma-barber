# Auditoria preliminar de conformidade — GROMMA BARBER

Data: 06/11/2026. Escopo inspecionado: package.json e localização convencional de middleware. **Não é auditoria completa nem declaração de conformidade.**

## Evidências iniciais
Next.js 16, Prisma, Vercel Blob. Priorizar autorização por unidade/papel, URLs de anexos, clientes e profissionais, histórico de comissões, consentimento de marketing.
- Não foi encontrado middleware.ts na raiz nem src/middleware.ts; isso **não prova** ausência de autenticação ou autorização, que podem estar implementadas em outros módulos.
- A busca indexada por palavras-chave não retornou evidência suficiente para avaliar os fluxos reais.

## Controles a implementar após leitura dos módulos
1. Inventário de dados, fornecedores, bases legais e retenção.
2. Autorização server-side e testes de acesso cruzado entre usuários/empresas.
3. Política de privacidade e canal de direitos do titular com validação jurídica.
4. Preferências de cookies não essenciais, quando houver rastreamento.
5. Termos, aceite e histórico de versão nos fluxos contratuais aplicáveis.
6. Proteção de logs, arquivos, backups e resposta a incidentes.
7. Transparência de preço, renovação, cancelamento e arrependimento conforme natureza da contratação.
8. Acessibilidade e verificação de licença de mídia.

## Critérios de homologação
- Testes automatizados relevantes passando e execução em ambiente QA.
- Verificação manual de fluxos de ponta a ponta e casos de acesso indevido.
- Sem deploy de mudanças em pagamento, autenticação ou dados sem homologação.
- Registrar evidência, PR e responsável por aprovação.

Status: auditoria inicial documentada; implementação e testes de conformidade pendentes.
