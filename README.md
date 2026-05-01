# Document Manager

Multi-organization, multi-user web app for tracking certificate and document expirations. Built for Vercel.

## Features

- **Three roles**: Super Admin, Organization Admin, User
- **Super Admin dashboard**: cross-org metrics — total orgs, admins, users, documents, plus valid / expiring (90/60/30 day) / expired buckets and a per-org breakdown
- **Org Admin dashboard**: same expiration buckets scoped to their organization, member management, and ability to upload/manage documents on behalf of any user in the org
- **User dashboard**: personal expiration metrics and self-service document upload/management
- **File storage**: Vercel Blob (PDF / images / Office docs, up to 15 MB)
- **Auth**: NextAuth (Credentials provider) with bcrypt password hashing, JWT sessions, and middleware-enforced role-based routing

## Tech stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Prisma ORM + PostgreSQL (Vercel Postgres / Neon / Supabase)
- NextAuth v5 (`next-auth@beta`)
- Tailwind CSS
- Vercel Blob

## Local setup

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env
# - Set DATABASE_URL to your Postgres connection string
# - Set AUTH_SECRET to: openssl rand -base64 32
# - Set BLOB_READ_WRITE_TOKEN (optional locally; required to upload)

# 3. Apply schema and seed the bootstrap super admin
npm run db:push
npm run db:seed

# 4. Run
npm run dev
```

Sign in with the credentials in `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD`.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Add a Postgres database (Vercel Storage → Postgres). Vercel injects `DATABASE_URL` automatically.
4. Add Blob storage (Vercel Storage → Blob). This injects `BLOB_READ_WRITE_TOKEN`.
5. Add env vars: `AUTH_SECRET`, `SEED_SUPER_ADMIN_EMAIL`, `SEED_SUPER_ADMIN_PASSWORD`.
6. Deploy. After the first deploy, run the schema sync and seed once:
   ```bash
   npx vercel env pull .env.production.local
   npx prisma db push
   npx tsx prisma/seed.ts
   ```
7. Sign in at `/login`.

## Roles & flows

| Role           | Can…                                                                 |
| -------------- | -------------------------------------------------------------------- |
| Super Admin    | Create/delete organizations, create any user (including org admins), see global metrics |
| Org Admin      | Add/remove users in their org, upload/manage documents for any user in their org, see org dashboard |
| User           | Upload/manage their own documents, see personal expiration dashboard |

## Schema

- `Organization` — name + relations
- `User` — email, password hash, `role` (SUPER_ADMIN / ORG_ADMIN / USER), nullable `organizationId`
- `Document` — name, type, file URL/metadata, `expirationDate`, owner, uploader, organization

Expiration buckets are computed from `expirationDate` relative to today: `expired (<today)`, `≤30d`, `≤60d`, `≤90d`, `valid (≥today)`.

## Notes

- File uploads pass through Next.js server actions; for very large files migrate to client-direct uploads with `@vercel/blob/client`.
- Org Admins cannot create or modify Super Admins.
- Deleting an organization cascades and removes its users and documents.
