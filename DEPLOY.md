# Deploy do GROMMA BARBER

## 1. Banco Neon
Use a variável `DATABASE_URL` somente no ambiente seguro da Vercel. Não grave a URL real no repositório.

Depois de instalar as dependências, aplique a migração:

```bash
npx prisma migrate deploy
```

## 2. Variáveis na Vercel
Cadastre em Production (e Preview se usar o mesmo banco de teste):

- `DATABASE_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `SESSION_SECRET` (32+ caracteres aleatórios)

## 3. Rotas principais
- `/` — página inicial
- `/cadastro` — cadastro da barbearia
- `/admin/login` — login do administrador da plataforma
- `/admin/barbearias` — lista de cadastros
- `/api/health` — health check

## 4. Segurança
O administrador da plataforma não recebe menus de clientes, agenda, caixa, estoque ou financeiro. Ele controla apenas cadastros de barbearias e sua liberação.
