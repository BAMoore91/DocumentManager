/**
 * One-off backfill that lowercases existing User.email rows.
 *
 * Login now lowercases email at the auth boundary, and every code path that
 * writes a new user lowercases first. This script normalizes rows that were
 * created before that fix.
 *
 * Run:   npm run db:normalize-emails
 *
 * Safety: detects collisions before writing. If two users exist with the
 * same case-insensitive email (e.g. "Bob@x.com" and "bob@x.com"), the script
 * reports both and updates neither — an operator must merge or rename one.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const candidates = await prisma.$queryRaw<{ id: string; email: string }[]>`
    SELECT "id", "email" FROM "User" WHERE "email" <> LOWER("email")
  `;

  if (candidates.length === 0) {
    console.log("All emails are already lowercase. Nothing to do.");
    return;
  }

  console.log(`Found ${candidates.length} user(s) with mixed-case email.`);

  const collisions: Array<{ id: string; email: string; conflictsWith: string }> = [];
  const willUpdate: Array<{ id: string; from: string; to: string }> = [];

  for (const row of candidates) {
    const target = row.email.toLowerCase();
    const conflict = await prisma.user.findFirst({
      where: { email: target, NOT: { id: row.id } },
      select: { id: true, email: true },
    });
    if (conflict) {
      collisions.push({ id: row.id, email: row.email, conflictsWith: conflict.id });
    } else {
      willUpdate.push({ id: row.id, from: row.email, to: target });
    }
  }

  for (const u of willUpdate) {
    await prisma.user.update({
      where: { id: u.id },
      data: { email: u.to },
    });
    console.log(`  ✓ ${u.from} → ${u.to}`);
  }

  if (collisions.length > 0) {
    console.warn(
      `\n⚠️  ${collisions.length} collision(s) NOT updated — resolve manually:`,
    );
    for (const c of collisions) {
      console.warn(
        `  ${c.email} (id=${c.id}) collides with existing lowercase row id=${c.conflictsWith}`,
      );
    }
    process.exitCode = 1;
  } else {
    console.log(`\nDone. ${willUpdate.length} row(s) updated.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
