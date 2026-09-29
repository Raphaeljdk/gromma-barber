# GROMMA BARBER

Plataforma de gestão e automação para barbearias, estruturada a partir do modelo comercial da apresentação BarberMind.

## Perfis

### Administrador da plataforma
Vê somente cadastros de barbearias, analisa documentos, escolhe o plano e libera, bloqueia ou rejeita o acesso.

### Operação da barbearia
Estrutura prevista para gestor e barbeiros, liberada por plano e feature flags.

## Planos

### Essencial — não personalizado
- Aquisição: R$ 5.000,00
- Recorrência: R$ 319,90/mês
- Unidade adicional: +50% da mensalidade
- Até 2 unidades
- Gestão, sistema do barbeiro, WhatsApp, IA e NF

### Pro — personalizado
- Implementação: R$ 30.000,00
- Recorrência: R$ 400,00/mês
- Unidade adicional: +50% da mensalidade
- Sem limite de unidades
- Tudo do Essencial + marca personalizada, totem, check-in/out, fechamento automático de comandas e operação por tablets

## Integrações externas ainda necessárias
- Provedor/API oficial de WhatsApp
- Provedor de IA e base de conhecimento
- Emissor/API de Nota Fiscal
- Configuração física dos totens/tablets para operações Pro

## Variáveis
- `DATABASE_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `SESSION_SECRET` (opcional; se ausente, o sistema deriva uma chave de sessão das credenciais administrativas)

## Banco
```bash
npm install
npx prisma migrate deploy
npm run dev
```

## Rotas principais
- `/` — apresentação comercial
- `/recursos` — diferenciais e módulos
- `/planos` — comparação Essencial x Pro
- `/cadastro` — solicitação de cadastro
- `/admin/login` — administrador da plataforma
- `/admin/barbearias` — análise e liberação de cadastros
