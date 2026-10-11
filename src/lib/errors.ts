// Stable error codes raised by the SQL functions (the exception message) mapped to toasts.
const MESSAGES: Record<string, string> = {
  not_authenticated: "Sign in to keep playing",
  profile_not_found: "Finish setting up your profile first",
  banned: "Your account is suspended",
  market_not_found: "That market doesn't exist anymore",
  market_closed: "Betting has closed on this one",
  invalid_side: "Pick YES or NO",
  invalid_stake: "Stakes are 1, 5, 10 or 25 coins",
  stake_over_max: "That stake is over this market's max",
  exposure_cap: "You've hit the 100-coin limit on this market",
  insufficient_balance: "Not enough coins for that stake",
  rate_limited: "Easy there. Try again in a few seconds",
  bet_not_found: "That bet doesn't exist",
  not_your_bet: "You can only undo your own bets",
  bet_not_active: "That bet is already locked in",
  undo_window_expired: "Too late to undo. Bets lock after 5 seconds",
  not_allowed: "You don't have permission to do that",
  already_settled: "This market is already settled",
  invalid_outcome: "Pick YES or NO",
  closes_too_soon: "Markets have to close at least 10 minutes from now",
  comment_parent_invalid: "That reply isn't on this market",
  comment_not_found: "That comment is gone",
  bonus_already_claimed: "Already claimed today. Come back tomorrow",
  balance_write_forbidden: "Balances only change through bets",
  // Postgres SQLSTATEs
  "23505": "That's already taken",
  "23514": "That doesn't pass validation",
  "42501": "You don't have permission to do that",
};

export interface DbErrorLike {
  message?: string;
  code?: string;
  hint?: string | null;
}

/** The stable code: our exception message, else the SQLSTATE. */
export function errorCode(err: DbErrorLike | null | undefined): string {
  if (!err) return "unknown";
  if (err.message && MESSAGES[err.message]) return err.message;
  return err.code ?? "unknown";
}

export function errorMessage(err: DbErrorLike | null | undefined): string {
  if (!err) return "Something went wrong";
  const code = errorCode(err);
  if (MESSAGES[code]) return MESSAGES[code];
  if (err.message?.toLowerCase().includes("fetch")) return "You're offline. Check your connection";
  return "Something went wrong. Try again";
}
