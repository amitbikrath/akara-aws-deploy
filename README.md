# Akara — akara.studio

Sacred art for your screen — wallpapers, music, shop, and the Akara Times,
served fully serverless on AWS (S3 + CloudFront + Lambda + Cognito).

> **Read the repo-root [`CLAUDE.md`](../CLAUDE.md) before changing anything.**
> It documents the #1 recurring mistake (editing the wrong frontend) and the
> only safe deploy workflow.

## What actually renders akara.studio

- **The site UI** is a React app delivered as Babel-compiled JSX:
  [`frontend/public/akara/*.jsx`](frontend/public/akara/) — nav/hero, gallery,
  wallpapers, music story, socials, shop, panchang rail, auth, lightbox, footer.
  The Next.js app in `frontend/src/` is only the thin shell (`layout.tsx` +
  `page.tsx`) that mounts this bundle into `<div id="root">`. The same script
  list exists in `public/akara/akara.html` and `public/akara/index.html` —
  keep all three in lockstep.
- **Akara Times** (`/times/{slug}`) — one SEO article per day, written directly
  to S3 by the `akara-times-daily` Lambda. Not present in this repo.
- **Admin** — `admin/` Next.js app at admin.akara.studio.
- **Lambdas** — `lambdas/` (catalog, auth/image protection, social pollers,
  Times engine, and more; some live Lambdas exceed what Terraform declares).
- **Infra** — `infra/terraform/` is PARTIAL vs live. Never `apply` blind.

## Development

```bash
npm install
npm run build:frontend   # static export to frontend/out/ (shell must match live)
```

There is no meaningful local dev server for the public site — the jsx bundle
calls the production `/api/*`. Verify frontend changes by serving
`frontend/out/` statically, then deploy targeted files.

## Deployment (the only safe way)

Targeted uploads + scoped invalidation. Example for a jsx change:

```bash
aws s3 cp frontend/public/akara/gallery.jsx \
  s3://akara-frontend-738983679688-us-east-1/akara/gallery.jsx
aws cloudfront create-invalidation --distribution-id EBWBTLYBASPTD \
  --paths "/akara/gallery.jsx"
# then: curl the live URL and grep for your change
```

Never run `npm run deploy:*`, `deploy-all.sh` (archived), or unreviewed
`terraform apply` — see `CLAUDE.md` and `docs/archive-2026-07-obsolete/`.

## License

Private — All rights reserved
