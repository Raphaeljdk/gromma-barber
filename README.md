# GROMMA BARBER

MVP do painel administrativo da plataforma para revisar e liberar cadastros de barbearias.

## Escopo implementado
- Cadastro público de barbearia
- Status: Pendente, Liberada, Bloqueada, Rejeitada
- Administrador da plataforma separado do gestor da barbearia
- Admin vê somente cadastros de barbearias
- Aprovação define plano Essencial ou Pro
- Liberação grava módulos permitidos por plano
- Bloqueio remove acesso sem apagar o cadastro
- Auditoria das decisões do administrador
- PostgreSQL/Neon via Prisma

## Variáveis
Copie `.env.example` para `.env.local` e preencha:
- `DATABASE_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

## Banco
```bash
npm install
npx prisma migrate deploy
npm run dev
```

## Vercel
Configure as mesmas variáveis em Production e Preview. O comando de build executa `prisma generate`; a migração deve ser aplicada antes da primeira publicação.
