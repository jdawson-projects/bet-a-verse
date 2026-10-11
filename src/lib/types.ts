import type { Database } from "@/lib/database.types";

type Fns = Database["public"]["Functions"];
type Tables = Database["public"]["Tables"];
export type Enums = Database["public"]["Enums"];

export type FeedCard = Fns["get_feed"]["Returns"][number];
export type PlaceBetResult = Fns["place_bet"]["Returns"][number];
export type CancelBetResult = Fns["cancel_bet"]["Returns"][number];
export type ProfileStats = Fns["get_profile_stats"]["Returns"][number];

export type Profile = Tables["profiles"]["Row"];
export type Market = Tables["markets"]["Row"];
export type Bet = Tables["bets"]["Row"];
export type Comment = Tables["comments"]["Row"];
export type Community = Tables["communities"]["Row"];

export type Category = Enums["market_category"];
export type MarketStatus = Enums["market_status"];
export type Role = Enums["user_role"];
