// pnpm snapshot → freeze the landing page's bets into src/components/landing/snapshot.json
//
// The GitHub Pages copy of the landing page has no database behind it, so it
// shows this file instead. Run it against a freshly seeded local database
// (`pnpm db:reset`), commit the result, then `pnpm deploy:pages`.
//
// Markets with fewer than three bets are left out, so every bubble shows a real pot.
// Closing times are stored as "seconds from now" so the preview always reads
// like a live board ("closes in 2d 17h") instead of drifting into "closed".
// Only what the anonymous landing RPCs already expose is written: no user ids,
// no emails, no ledger rows.
import { writeFileSync } from "node:fs";
import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const OUT = "src/components/landing/snapshot.json";

async function main() {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    const { rows: markets } = await db.query(`
      select id, question, category, community_slug,
             greatest(extract(epoch from (closes_at - now()))::int, 3600) as closes_in_s,
             yes_total, no_total, bet_count, featured
      from public.get_landing_markets(40)
      where bet_count >= 3`); // a bubble with 0 coins looks dead on a page meant for sharing
    const { rows } = await db.query("select open_markets, bets_today, players from public.get_landing_stats()");
    if (markets.length < 6) {
      console.error(`Only ${markets.length} open markets. Run \`pnpm db:reset\` first so the preview has a full board.`);
      process.exit(1);
    }
    writeFileSync(OUT, `${JSON.stringify({ markets, stats: rows[0] ?? null }, null, 2)}\n`);
    console.log(`Wrote ${markets.length} markets to ${OUT}`);
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
