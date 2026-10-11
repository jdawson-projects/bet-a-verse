// pnpm make-admin <email> [admin|moderator|user]
// Sets the role on the profile of an existing account (sign in once first).
import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const [email, role = "admin"] = process.argv.slice(2);
if (!email || !["admin", "moderator", "user"].includes(role)) {
  console.error("Usage: pnpm make-admin <email> [admin|moderator|user]");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run `pnpm env:local` (local) or export it (cloud).");
  process.exit(1);
}

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const { rows } = await db.query<{ username: string | null }>(
      `update public.profiles p set role = $2::public.user_role
       from auth.users u
      where u.id = p.id and lower(u.email) = lower($1)
     returning p.username`,
      [email, role],
    );
    if (rows.length === 0) {
      console.error(`No account for ${email}. Sign in to the app once, then re-run.`);
      process.exitCode = 1;
    } else {
      console.log(`${email} (${rows[0].username ?? "no username yet"}) is now ${role}.`);
    }
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
