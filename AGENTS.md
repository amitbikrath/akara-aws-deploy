# Agents

## Cursor Cloud specific instructions

### Overview

Akara Studio is an npm workspaces monorepo with three packages: `frontend` (public Next.js site, port 3000), `admin` (admin Next.js site, port 3001), and `lambdas` (AWS Lambda functions). Both Next.js apps use `output: 'export'` (static site generation).

### Running services

- **Frontend**: `npm run dev:frontend` — starts on http://localhost:3000
- **Admin**: `npm run dev:admin` — starts on http://localhost:3001
- See `README.md` and root `package.json` for all available scripts.

### Environment files

Before running dev servers, copy `.env.example` files:
```
cp frontend/.env.example frontend/.env.local
cp admin/.env.example admin/.env.local
cp lambdas/.env.example lambdas/.env
```

### Lint and type-check

- `npm run type-check --workspace=frontend` and `npm run type-check --workspace=admin` both pass.
- `npm run lint --workspace=admin` has pre-existing lint errors (unused vars, missing React imports) that also cause `npm run build:admin` to fail. These are **not** environment issues.
- Frontend lint (`npm run lint --workspace=frontend`) triggers an interactive ESLint setup prompt because the frontend workspace has no `.eslintrc` file. You must create one (matching admin's `.eslintrc.json`) or skip frontend lint.
- Lambdas `lint` and `type-check` fail because the workspace has `.js` source files but its scripts expect `.ts` files and a `tsconfig.json`. This is a pre-existing repo issue.

### Gotchas

- The Wallpapers and Music pages on the frontend show JSON parsing errors when running locally — this is expected because they try to fetch catalog data from `https://cdn.akara.studio` which is the production CDN.
- The admin app redirects to `/login` and requires AWS Cognito credentials (configured via `NEXT_PUBLIC_COGNITO_USER_POOL_ID` and `NEXT_PUBLIC_COGNITO_CLIENT_ID` in `admin/.env.local`). Without real AWS credentials, the login page renders but authentication won't work.
- Both Next.js apps use `output: 'export'` so there is no server-side rendering — they produce static HTML.
