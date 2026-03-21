# Netlify Frontend Deployment

This repo is a monorepo. Netlify should deploy the frontend from the `client` directory, not from the repo root output.

## What is already configured

- [netlify.toml](E:\neurlaplay\netlify.toml)
- [client/public/_redirects](E:\neurlaplay\client\public\_redirects)

The current config tells Netlify to:

- build from `client`
- run `npm run build`
- publish `client/dist`
- rewrite all frontend routes to `index.html`

## Required environment variable

Set this in Netlify:

```text
VITE_API_BASE_URL=https://<your-fly-backend>.fly.dev
```

Without that variable, the frontend will try to call the Netlify domain for `/api/*`, which is wrong because the backend is hosted on Fly.

## Netlify settings

If you deploy from the UI, the values should be:

- Base directory: `client`
- Build command: `npm run build`
- Publish directory: `dist`

If Netlify reads [netlify.toml](E:\neurlaplay\netlify.toml), those values are already defined and the UI settings should match.

## Redeploy

After setting `VITE_API_BASE_URL`, trigger a fresh deploy.
