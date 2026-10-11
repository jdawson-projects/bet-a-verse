// Test harness for the SQL money functions. Every test runs inside one
// transaction that is rolled back, against the local Supabase database
// (`supabase start`). Functions are called as the `authenticated` role with JWT
// claims set, exactly like PostgREST does, so grants and RLS are exercised too.
import { randomUUID } from "node:crypto";
import { Client, type QueryResultRow } from "pg";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export class DbError extends Error {
  constructor(
    public readonly code: string,
    public readonly sqlState: string | undefined,
  ) {
    super(code);
  }
}

export class TestDb {
  private savepoint = 0;

  constructor(private readonly client: Client) {}

  /** Run SQL as the postgres superuser (bypasses RLS). */
  async sql<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
    return this.atomic(async () => (await this.client.query<T>(text, params)).rows);
  }

  /** Run SQL as a signed-in user: role `authenticated`, JWT `sub` = userId. */
  async as<T extends QueryResultRow = QueryResultRow>(
    userId: string,
    text: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    // On error the savepoint rollback also reverts the role and claims.
    return this.atomic(async () => {
      await this.client.query(
        `select set_config('request.jwt.claims', $1, true), set_config('role', 'authenticated', true)`,
        [JSON.stringify({ sub: userId, role: "authenticated" })],
      );
      const rows = (await this.client.query<T>(text, params)).rows;
      await this.client.query(`select set_config('request.jwt.claims', '', true), set_config('role', 'postgres', true)`);
      return rows;
    });
  }

  /** Wraps a statement in a savepoint so an expected error doesn't abort the test transaction. */
  private async atomic<T>(fn: () => Promise<T>): Promise<T> {
    const name = `sp_${++this.savepoint}`;
    await this.client.query(`savepoint ${name}`);
    try {
      const result = await fn();
      await this.client.query(`release savepoint ${name}`);
      return result;
    } catch (err) {
      await this.client.query(`rollback to savepoint ${name}`);
      const e = err as { message?: string; code?: string };
      throw new DbError(e.message ?? String(err), e.code);
    }
  }

  // --- fixtures -------------------------------------------------------------

  /** Creates an auth user; the signup trigger makes the profile and posts 1,000 coins. */
  async createUser(opts: { balance?: number; role?: "user" | "moderator" | "admin" } = {}): Promise<string> {
    const id = randomUUID();
    await this.sql(
      `insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data)
       values ($1, $2, 'authenticated', 'authenticated', '{}', '{}')`,
      [id, `test-${id}@example.com`],
    );
    await this.sql(`update public.profiles set username = $2 where id = $1`, [id, `t_${id.slice(0, 8)}`]);
    if (opts.role && opts.role !== "user") {
      await this.sql(`update public.profiles set role = $2 where id = $1`, [id, opts.role]);
    }
    if (opts.balance !== undefined && opts.balance !== 1000) {
      await this.sql(`select public.post_ledger($1, $2, 'adjustment', 'test', null)`, [id, opts.balance - 1000]);
    }
    return id;
  }

  async createMarket(
    creatorId: string,
    opts: { maxStake?: number; rakeBps?: number; closesInMinutes?: number; poolCapacity?: number | null } = {},
  ): Promise<string> {
    const [row] = await this.sql<{ id: string }>(
      `insert into public.markets (question, creator_id, closes_at, resolves_by, max_stake, rake_bps, pool_capacity)
       values ($1, $2, now() + make_interval(mins => $3), now() + make_interval(mins => $3) + interval '1 day', $4, $5, $6)
       returning id`,
      [
        "Will this test market resolve correctly?",
        creatorId,
        opts.closesInMinutes ?? 60,
        opts.maxStake ?? 25,
        opts.rakeBps ?? 500,
        opts.poolCapacity ?? null,
      ],
    );
    return row.id;
  }

  // --- RPCs as a user ----------------------------------------------------------

  async placeBet(userId: string, marketId: string, side: "yes" | "no", stake: number) {
    const [row] = await this.as<PlaceBetRow>(userId, `select * from public.place_bet($1, $2, $3)`, [
      marketId,
      side,
      stake,
    ]);
    return row;
  }

  async cancelBet(userId: string, betId: string) {
    const [row] = await this.as(userId, `select * from public.cancel_bet($1)`, [betId]);
    return row;
  }

  async resolve(userId: string, marketId: string, outcome: "yes" | "no") {
    const [row] = await this.as(userId, `select * from public.resolve_market($1, $2, 'test', null)`, [marketId, outcome]);
    return row;
  }

  async void(userId: string, marketId: string) {
    const [row] = await this.as(userId, `select * from public.void_market($1, 'test void')`, [marketId]);
    return row;
  }

  // --- reads -----------------------------------------------------------------

  async balance(userId: string): Promise<number> {
    const [row] = await this.sql<{ balance: number }>(`select balance from public.profiles where id = $1`, [userId]);
    return row.balance;
  }

  async bet(betId: string) {
    const [row] = await this.sql<{ status: string; payout: number | null; stake: number }>(
      `select status, payout, stake from public.bets where id = $1`,
      [betId],
    );
    return row;
  }

  async ledgerFingerprint(): Promise<{ rows: number; sum: number }> {
    const [row] = await this.sql<{ rows: number; sum: number }>(
      `select count(*)::int as rows, coalesce(sum(amount), 0)::int as sum from public.ledger`,
    );
    return row;
  }

  /** Users whose balance doesn't equal the sum of their ledger rows. */
  async invariantViolations(): Promise<{ id: string; balance: number; ledger_sum: number }[]> {
    return this.sql(
      `select p.id, p.balance, coalesce(sum(l.amount), 0)::int as ledger_sum
         from public.profiles p
         left join public.ledger l on l.user_id = p.id
        group by p.id
       having p.balance <> coalesce(sum(l.amount), 0)`,
    );
  }
}

export interface PlaceBetRow {
  bet_id: string;
  market_id: string;
  pool_id: string;
  side: "yes" | "no";
  stake: number;
  price_at_bet: string;
  balance: number;
  yes_total: number;
  no_total: number;
  implied_yes: string;
  pool_yes_total: number;
  pool_no_total: number;
  pool_yes_bettors: number;
  pool_no_bettors: number;
}

/** Opens a connection, runs the test body in a transaction, always rolls back. */
export async function withDb(fn: (db: TestDb) => Promise<void>): Promise<void> {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  try {
    await client.connect();
  } catch (err) {
    throw new Error(
      `Cannot reach the test database at ${TEST_DATABASE_URL}. Run \`pnpm exec supabase start\` first. (${String(err)})`,
    );
  }
  await client.query("begin");
  try {
    await fn(new TestDb(client));
  } finally {
    await client.query("rollback");
    await client.end();
  }
}

/** Asserts the promise fails with Postgres "insufficient privilege" (grants or RLS). */
export async function expectDenied(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof DbError && err.sqlState === "42501") return;
    throw new Error(`expected permission denied (42501), got "${err instanceof Error ? err.message : String(err)}"`);
  }
  throw new Error("expected permission denied, but the call succeeded");
}

/** Asserts the promise rejects with a given error code (the exception message). */
export async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof DbError && err.code === code) return;
    throw new Error(`expected error "${code}", got "${err instanceof Error ? err.message : String(err)}"`);
  }
  throw new Error(`expected error "${code}", but the call succeeded`);
}
