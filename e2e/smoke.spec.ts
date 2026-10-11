// Smoke test: sign up with a magic-link code, pick a username, place 10 bets
// in under a minute, and check the balance and the ledger.
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function latestCode(email: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=1`);
    const { messages } = (await res.json()) as { messages: { ID: string }[] };
    if (messages?.length) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { Text: string };
      const code = msg.Text.match(/\b(\d{6})\b/)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No sign-in email for ${email} in Mailpit (${MAILPIT})`);
}

async function balance(page: Page): Promise<number> {
  const label = await page.getByTestId("balance").getAttribute("aria-label");
  return Number(label?.replace(/\D/g, ""));
}

test("sign up, get 1,000 coins, place 10 bets in under 60 seconds", async ({ page }) => {
  const stamp = Date.now().toString(36);
  const email = `e2e-${stamp}@uchicago.edu`;
  const username = `e2e_${stamp}`.slice(0, 20);

  // Sign up
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.getByPlaceholder("you@uchicago.edu").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText("We sent a link and a 6-digit code")).toBeVisible();
  await page.getByPlaceholder("123456").fill(await latestCode(email));
  await page.getByRole("button", { name: "Sign in" }).click();

  // Onboarding
  await expect(page).toHaveURL(/\/welcome/);
  await page.getByLabel("Username").fill(username);
  await page.getByRole("button", { name: "Start swiping" }).click();
  await expect(page.getByText("You've got 1,000 coins to start")).toBeVisible();
  expect(await balance(page)).toBe(1000);

  // 10 bets: alternate buttons and keyboard, YES and NO, default 5-coin stake.
  const cards = page.locator("article");
  await expect(cards.first()).toBeVisible();
  const started = Date.now();
  for (let i = 0; i < 10; i++) {
    const question = await cards.first().getAttribute("aria-label");
    const placed = page.waitForResponse((r) => r.url().includes("/rpc/place_bet") && r.request().method() === "POST");
    if (i % 2 === 0) await page.getByRole("button", { name: i % 4 === 0 ? "Bet YES" : "Bet NO" }).click();
    else await page.keyboard.press(i % 4 === 1 ? "ArrowLeft" : "ArrowRight");
    const res = await placed;
    expect(res.status(), `bet ${i + 1} on "${question}"`).toBe(200);
    await expect(cards.first()).not.toHaveAttribute("aria-label", question ?? "");
  }
  const elapsed = Date.now() - started;
  expect(elapsed, `10 bets took ${elapsed} ms`).toBeLessThan(60_000);
  await expect.poll(() => balance(page)).toBe(950);

  // Undo the last one is not needed; check the ledger agrees with the balance.
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    const { rows } = await db.query<{ balance: number; ledger: number; bets: number }>(
      `select p.balance,
              (select coalesce(sum(amount), 0)::int from public.ledger l where l.user_id = p.id) as ledger,
              (select count(*)::int from public.bets b where b.user_id = p.id and b.status = 'active') as bets
         from public.profiles p where p.username = $1`,
      [username],
    );
    expect(rows[0]).toEqual({ balance: 950, ledger: 950, bets: 10 });
  } finally {
    await db.end();
  }

  // Skip works and doesn't cost coins.
  const skipped = await cards.first().getAttribute("aria-label");
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(cards.first()).not.toHaveAttribute("aria-label", skipped ?? "");
  expect(await balance(page)).toBe(950);
});
