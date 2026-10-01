# Banco de dados e deploy

O build da Vercel **não executa migrations nem seed**. Isso evita concorrência entre deployments e o erro de advisory lock do PostgreSQL (Prisma P1002).

## Build normal

```bash
npm run build
```

Executa apenas:

```bash
prisma generate
next build
```

## Quando houver alteração de schema

Execute uma única vez, fora do build concorrente:

```bash
npm run db:release
```

Esse comando executa:

1. `prisma migrate deploy`
2. `prisma db seed`

Também é possível executar separadamente:

```bash
npm run db:deploy
npm run db:seed
```

Nunca coloque `prisma migrate deploy` novamente no script `build`.
