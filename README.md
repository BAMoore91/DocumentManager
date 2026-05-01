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

# 3. Apply the schema
npm run db:push

# 4. Run
npm run dev
```

Open `http://localhost:3000` — you'll be redirected to `/setup` to create the
first Super Admin. Once created, sign in at `/login`. The setup page is
auto-disabled after a Super Admin exists.

> Optional: `npm run db:seed` will create a bootstrap admin from
> `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` instead of using the
> `/setup` page.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Add a Postgres database (Vercel Storage → Postgres). Vercel injects `DATABASE_URL` automatically.
4. Add Blob storage (Vercel Storage → Blob). This injects `BLOB_READ_WRITE_TOKEN`.
5. Add env var: `AUTH_SECRET` (`openssl rand -base64 32`).
6. Deploy. After the first deploy, push the schema to the database once:
   ```bash
   npx vercel env pull .env.production.local
   npx prisma db push
   ```
7. Visit your Vercel URL — you'll be redirected to `/setup` to create the first
   Super Admin in the browser. Setup page disables itself after.

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
