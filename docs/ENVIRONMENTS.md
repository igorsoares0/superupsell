# Ambientes — SuperUpsell

Este app possui dois ambientes: **development** e **production**.

---

## Estrutura de arquivos

```
shopify.app.development.toml   # Config Shopify CLI — app de dev
shopify.app.production.toml    # Config Shopify CLI — app de prod
.env                           # Env vars padrão (aponta pra dev)
.env.development               # Env vars de dev
.env.production                # Env vars de prod
react-router.config.ts         # Ativa preset Vercel apenas na Vercel
```

Todos os `.env*` estão no `.gitignore`.

---

## Development

**Rodar localmente (via WSL):**

```bash
shopify app dev --config development
```

Isso usa o `shopify.app.development.toml` e o banco de dados de dev.

**Loja de teste:** estilolivrevivaz.myshopify.com

---

## Production

**App Shopify:** `client_id` definido em `shopify.app.production.toml`
**Banco de dados:** Neon PostgreSQL (prod), definido em `.env.production`
**Hosting:** Vercel

---

## Vercel

O deploy de produção roda na Vercel. O preset `@vercel/react-router` é ativado automaticamente (a Vercel define a env var `VERCEL`).

### Environment variables na Vercel

Configurar no dashboard da Vercel (Settings → Environment Variables):

| Variável           | Descrição                              |
| ------------------ | -------------------------------------- |
| `DATABASE_URL`     | Connection string do Neon (prod)       |
| `SHOPIFY_API_KEY`  | `client_id` do app prod                |
| `SHOPIFY_API_SECRET` | API secret do app prod (Partner Dashboard) |
| `SCOPES`           | `write_products,write_discounts,read_orders` |
| `SHOPIFY_APP_URL`  | URL da Vercel (ex: `https://superupsell.vercel.app`) |

### Deploy

Cada `git push` na branch `main` faz deploy automático na Vercel.

### Deploy de extensions Shopify

Extensions (theme app extension, discount function) são gerenciadas separadamente pelo Shopify CLI:

```bash
shopify app deploy --config production
```

Rode este comando sempre que alterar arquivos dentro de `extensions/`.

---

## Migrations (Prisma)

**Dev — aplicar migrations em desenvolvimento:**

```bash
npx prisma migrate dev
```

**Prod — aplicar migrations no banco de produção:**

```bash
DATABASE_URL="<url_prod>" npx prisma migrate deploy
```

Na Vercel, o script `setup` do `package.json` roda `prisma migrate deploy` automaticamente se usado via Docker. Para Vercel, adicione como build command ou rode manualmente antes do deploy.

---

## Resumo rápido

| Ação                        | Comando                                    |
| --------------------------- | ------------------------------------------ |
| Dev local                   | `shopify app dev --config development`     |
| Build local                 | `npm run build`                            |
| Deploy extensions (prod)    | `shopify app deploy --config production`   |
| Deploy app (prod)           | `git push` (Vercel faz automaticamente)    |
| Migration dev               | `npx prisma migrate dev`                   |
| Migration prod              | `DATABASE_URL="..." npx prisma migrate deploy` |
