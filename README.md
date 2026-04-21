This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Running locally

DID Scanner is a multi-dialer Convoso management app backed by Neon Postgres
(Drizzle ORM) with a nightly full sync plus a 5-minute live pulse.

### Required environment variables

Copy `.env.example` to `.env.local` and fill in:

- `DATABASE_URL` - Neon pooled connection string.
- `APP_ENCRYPTION_KEY` - 32-byte key, base64-encoded, used for AES-256-GCM
  encryption of Convoso auth tokens at rest.
  Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
- `CONVOSO_USE_FIXTURES` - set to `true` to bypass the live Convoso API and
  use the built-in fixture data (good for local development and the overnight
  agent). Unset or `false` in production.
- `VERCEL_CRON_SECRET` - bearer token required by `/api/sync/full` and
  `/api/sync/pulse`. Cron routes return 401 without it.

Optional legacy fallback (only used by `npm run db:seed` to insert a single
`Default` dialer when the table is empty):

- `CONVOSO_API_URL`
- `CONVOSO_AUTH_TOKEN`

### First run

```bash
npm install
npm run db:push        # applies Drizzle schema to DATABASE_URL
npm run db:seed        # optional: seeds "Default" dialer from CONVOSO_* env
npm run dev
```

Then visit `http://localhost:3000`. If no dialers exist yet you'll be
redirected to `/settings` to create one.

### Fixture mode

Set `CONVOSO_USE_FIXTURES=true`. Every call to the Convoso client resolves
from `src/lib/convoso/fixtures.ts` - about 2200 synthetic logs, ~30 DIDs,
a mix of `OUTBOUND`, `MANUAL`, and `INBOUND` call types. The outbound-only
filter drops inbound rows at the client layer before they reach aggregation.

Trigger a full sync manually:

```bash
curl -X POST \
  -H "Authorization: Bearer $VERCEL_CRON_SECRET" \
  http://localhost:3000/api/sync/full
```

### Scripts

- `npm run dev` - Next.js dev server.
- `npm run build` - production build.
- `npm run lint` - ESLint.
- `npm run db:push` - apply schema via Drizzle.
- `npm run db:generate` - generate migration SQL.
- `npm run db:studio` - Drizzle Studio.
- `npm run db:seed` - one-time default-dialer seed.
