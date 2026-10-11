// Day-one content for `pnpm seed`. Everything here is fictional.

export type Category = "sports" | "campus" | "culture" | "crypto" | "news" | "other";
export type CommunitySlug = "uchicago" | "nba" | "internet";

export const COMMUNITIES: {
  slug: CommunitySlug;
  name: string;
  description: string;
  kind: "school" | "topic";
  emailDomain: string | null;
}[] = [
  {
    slug: "uchicago",
    name: "UChicago",
    description: "Hyde Park's finest predictions. Where fun goes to get priced.",
    kind: "school",
    emailDomain: "uchicago.edu",
  },
  {
    slug: "nba",
    name: "NBA",
    description: "Box scores, bad takes and buzzer beaters.",
    kind: "topic",
    emailDomain: null,
  },
  {
    slug: "internet",
    name: "Internet",
    description: "Views, likes, ratios and whatever is trending in the group chat.",
    kind: "topic",
    emailDomain: null,
  },
];

export const HOUSE = { username: "betaverse", displayName: "Bet-a-Verse", bio: "Official markets and resolutions." };

export const USERS: { username: string; displayName: string; bio: string; communities: CommunitySlug[] }[] = [
  { username: "regrat", displayName: "Maya", bio: "4th floor Reg, window seat. Don't ask.", communities: ["uchicago", "internet"] },
  { username: "hydeparkhank", displayName: "Hank", bio: "Econ '28. I price everything.", communities: ["uchicago", "nba"] },
  { username: "deepdish_dana", displayName: "Dana", bio: "Chicago born. Fades NY teams on principle.", communities: ["nba", "internet"] },
  { username: "pointjumper", displayName: "Theo", bio: "Swam at the Point in October once.", communities: ["uchicago"] },
  { username: "scavqueen", displayName: "Priya", bio: "Scav captain. Item 147 was me.", communities: ["uchicago", "internet"] },
  { username: "ratner_rat", displayName: "Jordan", bio: "Leg day is every day.", communities: ["uchicago", "nba"] },
  { username: "bartlett_bandit", displayName: "Sam", bio: "Takes three trays. Bets three coins.", communities: ["uchicago"] },
  { username: "bullsbeliever", displayName: "Marcus", bio: "This is the year. Every year.", communities: ["nba"] },
  { username: "midway_mo", displayName: "Mo", bio: "Skating the Midway when it freezes.", communities: ["uchicago", "nba", "internet"] },
  { username: "quadqueen", displayName: "Lena", bio: "Main Quad hammock enthusiast.", communities: ["uchicago", "internet"] },
  { username: "docfilms_dev", displayName: "Ari", bio: "Sees every Doc Films screening. Rates them all YES.", communities: ["internet"] },
  { username: "satoshi_ish", displayName: "Kai", bio: "Not financial advice. It's play money.", communities: ["internet", "nba"] },
];

/** lean = chance a seeded bettor picks YES; hours = time until close (open) or since close (resolved). */
export interface SeedMarket {
  question: string;
  details: string;
  category: Category;
  community?: CommunitySlug;
  lean: number;
  hours: number;
  featured?: boolean;
}

export const OPEN_MARKETS: SeedMarket[] = [
  // --- campus ---
  { question: "Will the Reg hit capacity before 8pm on Tuesday?", details: "Resolves YES if the Regenstein occupancy counter shows 100% or the front desk stops entry before 8:00 pm Tuesday.", category: "campus", community: "uchicago", lean: 0.7, hours: 52, featured: true },
  { question: "Will Bartlett serve the chicken tikka masala again this week?", details: "YES if it appears on the posted Bartlett dinner menu any night before Sunday.", category: "campus", community: "uchicago", lean: 0.55, hours: 120 },
  { question: "Will the 55 bus be more than 15 minutes late at Garfield on Monday at 9am?", details: "Resolved from the CTA tracker screenshot posted in the thread by 9:20 am Monday.", category: "campus", community: "uchicago", lean: 0.45, hours: 30 },
  { question: "Will more than 300 people show up to Friday's Doc Films screening?", details: "Per the Doc Films count posted on their Instagram story.", category: "campus", community: "uchicago", lean: 0.35, hours: 130 },
  { question: "Will the Midterm Week Mansueto line wrap past the doors on Wednesday?", details: "YES if a posted photo shows the line out the Mansueto entrance between 10am and 4pm Wednesday.", category: "campus", community: "uchicago", lean: 0.4, hours: 76 },
  { question: "Will the Maroons football team score 30+ points on Saturday?", details: "Final score from the athletics site.", category: "sports", community: "uchicago", lean: 0.5, hours: 140 },
  { question: "Will anyone jump into Botany Pond this weekend?", details: "Photo or video evidence posted in the comments by Sunday 11:59 pm. Ducks don't count.", category: "campus", community: "uchicago", lean: 0.6, hours: 150 },
  { question: "Will the Rockefeller carillon play a Taylor Swift song this week?", details: "Per the carillonneur's posted program or a video in the comments.", category: "culture", community: "uchicago", lean: 0.35, hours: 140 },
  { question: "Will someone wade into the Law School fountain this weekend?", details: "Photo evidence in the comments by Sunday 11:59 pm.", category: "campus", community: "uchicago", lean: 0.25, hours: 150 },
  { question: "Will Booth's atrium coffee run out before 10am on Thursday?", details: "Confirmed by a photo of the empty carafes between 9:45 and 10:15 am.", category: "campus", community: "uchicago", lean: 0.5, hours: 95 },
  { question: "Will Harper Library be full by 10am on the Sunday before midterms?", details: "YES if a photo posted by 10:15 am shows no open seats in the reading room.", category: "campus", community: "uchicago", lean: 0.55, hours: 165 },
  { question: "Will the Max P fire alarm go off before Thursday?", details: "Any unplanned alarm, confirmed by two residents in the comments.", category: "campus", community: "uchicago", lean: 0.3, hours: 90 },
  { question: "Will the Ratner squat racks have a wait at 6pm today?", details: "YES if someone in the thread posts a photo of a line at 6:00–6:15 pm.", category: "campus", community: "uchicago", lean: 0.75, hours: 7 },
  { question: "Will the Main Quad hammocks still be up next Friday?", details: "Resolved by a photo from the Quad at noon next Friday.", category: "campus", community: "uchicago", lean: 0.5, hours: 165 },
  { question: "Will the Pub run out of pretzels on trivia night?", details: "Per the bartender or a menu board photo before 11pm Thursday.", category: "campus", community: "uchicago", lean: 0.25, hours: 96 },
  { question: "Will Snell-Hitchcock win the house Halloween costume contest?", details: "Per the official RSO announcement.", category: "campus", community: "uchicago", lean: 0.4, hours: 160 },
  { question: "Will the average on Min Sok Lee's Econ 200 midterm break 75?", details: "Per the class average posted on Canvas after grading. Saieh Hall is already sweating.", category: "campus", community: "uchicago", lean: 0.3, hours: 110, featured: true },
  { question: "Will the Midway rink open before November?", details: "Official announcement from the university.", category: "campus", community: "uchicago", lean: 0.15, hours: 168 },
  { question: "Is the Cathey omelet line shorter than 10 people at 9am Saturday?", details: "Photo evidence in the comments at 9:00–9:10 am Saturday.", category: "campus", community: "uchicago", lean: 0.55, hours: 125 },

  // --- weather ---
  { question: "Will it rain in Hyde Park on Saturday?", details: "YES if the NWS records measurable precipitation (0.01 in or more) at Midway Airport on Saturday.", category: "news", community: "uchicago", lean: 0.45, hours: 100 },
  { question: "Will Chicago hit 70°F at any point this week?", details: "Per the NWS high temperature at O'Hare, through Sunday.", category: "news", lean: 0.35, hours: 150 },
  { question: "Will Chicago see its first frost before next Monday?", details: "NWS frost or freeze advisory issued for Cook County.", category: "news", lean: 0.3, hours: 166 },
  { question: "Will wind gusts top 40 mph downtown tomorrow?", details: "Per the NWS station at Northerly Island.", category: "news", lean: 0.25, hours: 28 },

  // --- sports / NBA ---
  { question: "Will the Bulls win their preseason finale?", details: "Final score of the Bulls' last preseason game.", category: "sports", community: "nba", lean: 0.5, hours: 70, featured: true },
  { question: "Will any NBA player score 50+ on opening night?", details: "Any player, any opening-night game, per the official box score.", category: "sports", community: "nba", lean: 0.2, hours: 168 },
  { question: "Will the Bulls' starting lineup include a rookie on opening night?", details: "Per the official starting lineup.", category: "sports", community: "nba", lean: 0.35, hours: 160 },
  { question: "Will Victor Wembanyama record 5+ blocks in his first game?", details: "Per the official box score of his first regular-season game.", category: "sports", community: "nba", lean: 0.4, hours: 168 },
  { question: "Will the Knicks start the season 2-0?", details: "Results of the Knicks' first two regular-season games.", category: "sports", community: "nba", lean: 0.45, hours: 168 },
  { question: "Will any opening-week game go to double overtime?", details: "Any NBA regular-season game in the first week.", category: "sports", community: "nba", lean: 0.3, hours: 166 },
  { question: "Will the Bears win on Sunday?", details: "Final score of the Bears' next game.", category: "sports", lean: 0.5, hours: 150, featured: true },
  { question: "Will the Bears score a defensive touchdown on Sunday?", details: "Pick-six, fumble return or blocked-kick return TD by the Bears' defense or special teams.", category: "sports", lean: 0.15, hours: 150 },
  { question: "Will the Blackhawks score 4+ goals tonight?", details: "Regulation and overtime goals; shootout doesn't count.", category: "sports", lean: 0.3, hours: 9 },
  { question: "Will the NFL game of the week be decided by 3 points or fewer?", details: "Sunday Night Football final margin.", category: "sports", lean: 0.35, hours: 150 },
  { question: "Will LeBron play in the season opener?", details: "Per the official box score.", category: "sports", community: "nba", lean: 0.7, hours: 168 },
  { question: "Will a Bulls player post a triple-double this week?", details: "Any Bulls game this week, per the official box score.", category: "sports", community: "nba", lean: 0.15, hours: 160 },

  // --- culture / internet ---
  { question: "Will the #1 movie this weekend gross over $50M domestic?", details: "Per Box Office Mojo's weekend actuals on Monday.", category: "culture", lean: 0.4, hours: 150 },
  { question: "Will this week's SNL cold open pass 1M YouTube views in 24 hours?", details: "View count on the official SNL channel 24 hours after upload.", category: "culture", community: "internet", lean: 0.55, hours: 140 },
  { question: "Will a K-pop act top Spotify's Global Top 50 this week?", details: "Per the Spotify Global Top 50 on Friday.", category: "culture", community: "internet", lean: 0.3, hours: 120 },
  { question: "Will MrBeast's next video hit 50M views in its first week?", details: "Per YouTube view count 7 days after upload.", category: "culture", community: "internet", lean: 0.65, hours: 168 },
  { question: "Will the Maroon's Instagram post about the Scav list hit 10k likes?", details: "Like count on the post 48 hours after it goes up.", category: "culture", community: "uchicago", lean: 0.2, hours: 48, featured: true },
  { question: "Will this week's top r/uchicago post get over 1k upvotes?", details: "Top post of the week as of Sunday 11:59 pm.", category: "culture", community: "uchicago", lean: 0.3, hours: 155 },
  { question: "Will a new dance trend hit 1M TikTok videos by Friday?", details: "Per TikTok's sound page count, as posted in the comments.", category: "culture", community: "internet", lean: 0.35, hours: 120 },
  { question: "Will the new Pixar trailer outdo the last one's 24-hour views?", details: "Per Disney's announced 24-hour view figure.", category: "culture", community: "internet", lean: 0.5, hours: 100 },
  { question: "Will anyone in this thread get ratioed by a brand account this week?", details: "Screenshot evidence in the comments. Moderators decide.", category: "other", community: "internet", lean: 0.4, hours: 150 },
  { question: "Will a streamer break the all-time Twitch concurrent viewers record this month?", details: "Per TwitchTracker's record list.", category: "culture", community: "internet", lean: 0.1, hours: 168 },
  { question: "Will the Grammy nominations include a debut album in Album of the Year?", details: "Per the official nominations announcement.", category: "culture", lean: 0.45, hours: 168 },
  { question: "Will a Halloween costume of this year's biggest meme go viral on X?", details: "A post with 100k+ likes featuring the costume, linked in the comments.", category: "culture", community: "internet", lean: 0.6, hours: 166 },

  // --- crypto ---
  { question: "Will Bitcoin close the week higher than it opened?", details: "Monday 00:00 UTC open vs Sunday 23:59 UTC close on Coinbase.", category: "crypto", community: "internet", lean: 0.55, hours: 160 },
  { question: "Will ETH outperform BTC this week?", details: "Percent change Monday open to Sunday close, Coinbase spot prices.", category: "crypto", lean: 0.45, hours: 160 },
  { question: "Will Dogecoin move more than 10% in either direction in 24 hours?", details: "Max intraday swing from now, per CoinGecko.", category: "crypto", community: "internet", lean: 0.3, hours: 24 },
  { question: "Will Solana flip a new all-time daily transaction high this week?", details: "Per a public Solana explorer's daily transaction chart.", category: "crypto", lean: 0.25, hours: 150 },
  { question: "Will Bitcoin dominance be above 55% on Friday?", details: "Per CoinMarketCap at 12:00 UTC Friday.", category: "crypto", lean: 0.5, hours: 110 },
  { question: "Will a memecoin launched this week reach a $1B market cap?", details: "Per CoinGecko by Sunday 23:59 UTC.", category: "crypto", community: "internet", lean: 0.1, hours: 160 },

  // --- news ---
  { question: "Will the CTA announce a fare change before Thanksgiving?", details: "Official CTA press release.", category: "news", community: "uchicago", lean: 0.2, hours: 168 },
  { question: "Will the Fed cut rates at its next meeting?", details: "Per the FOMC statement.", category: "news", lean: 0.4, hours: 168 },
  { question: "Will gas in Chicago average under $4 this Friday?", details: "Per AAA's Chicago metro average.", category: "news", lean: 0.45, hours: 110 },
  { question: "Will Apple announce a new product by press release this week?", details: "Any newsroom press release announcing new hardware.", category: "news", lean: 0.35, hours: 150 },
  { question: "Will a new Chicago restaurant get a Michelin star this year?", details: "Per the Michelin Guide Chicago announcement.", category: "news", lean: 0.6, hours: 168 },

  // --- other ---
  { question: "Will this market get more than 50 bets before it closes?", details: "Bet count shown on the market at close.", category: "other", lean: 0.65, hours: 72 },
  { question: "Will the group project chat reply within an hour tonight?", details: "Self-reported by the creator with a screenshot. Trust the process.", category: "other", lean: 0.3, hours: 10 },
  { question: "Will Hyde Park get a new boba shop announced this month?", details: "A lease or opening announcement in local news.", category: "other", community: "uchicago", lean: 0.35, hours: 168 },
  { question: "Will the Metra Electric be on time Friday at 5:15pm?", details: "Departure from 59th St within 3 minutes of schedule, per the Metra tracker.", category: "other", community: "uchicago", lean: 0.5, hours: 115 },
  { question: "Is the next Scav Hunt theme going to leak before the list drops?", details: "Credible leak posted publicly before the official list release. Moderators decide.", category: "campus", community: "uchicago", lean: 0.2, hours: 168 },
];

export const RESOLVED_MARKETS: (SeedMarket & { outcome: "yes" | "no" })[] = [
  { question: "Will it rain on O-Week move-in day?", details: "Measurable rain at Midway Airport.", category: "news", community: "uchicago", lean: 0.4, hours: 24 * 30, outcome: "no" },
  { question: "Will the Bulls win their preseason opener?", details: "Final score.", category: "sports", community: "nba", lean: 0.5, hours: 24 * 6, outcome: "yes" },
  { question: "Will the Reg open 24/7 during reading period?", details: "Library announcement.", category: "campus", community: "uchicago", lean: 0.6, hours: 24 * 20, outcome: "yes" },
  { question: "Will the Bears cover the spread last Sunday?", details: "Final score vs closing line.", category: "sports", lean: 0.45, hours: 24 * 7, outcome: "no" },
  { question: "Will Bitcoin end September green?", details: "Monthly candle on Coinbase.", category: "crypto", community: "internet", lean: 0.55, hours: 24 * 11, outcome: "yes" },
  { question: "Will the first-week Econ problem set be curved?", details: "Per the course announcement.", category: "campus", community: "uchicago", lean: 0.3, hours: 24 * 9, outcome: "no" },
  { question: "Will the Pub's trivia night sell out?", details: "Per the Pub's Instagram story.", category: "campus", community: "uchicago", lean: 0.5, hours: 24 * 4, outcome: "yes" },
  { question: "Will a trailer break 100M views in 24 hours this month?", details: "Per the studio's announcement.", category: "culture", community: "internet", lean: 0.35, hours: 24 * 12, outcome: "no" },
  { question: "Will the Cubs make the postseason?", details: "Final MLB standings.", category: "sports", lean: 0.5, hours: 24 * 14, outcome: "yes" },
  { question: "Will Chicago top 90°F after Labor Day?", details: "NWS O'Hare high.", category: "news", lean: 0.4, hours: 24 * 25, outcome: "yes" },
  { question: "Will the Maroon's first issue have a crossword?", details: "Print edition.", category: "campus", community: "uchicago", lean: 0.7, hours: 24 * 16, outcome: "yes" },
  { question: "Will Dogecoin outperform Bitcoin last week?", details: "Weekly percent change on Coinbase.", category: "crypto", lean: 0.4, hours: 24 * 5, outcome: "no" },
  { question: "Will the Ratner pool reopen before October?", details: "Athletics announcement.", category: "campus", community: "uchicago", lean: 0.5, hours: 24 * 13, outcome: "no" },
  { question: "Will a viral cat video top 10M views this week?", details: "Any cat video on YouTube or TikTok.", category: "culture", community: "internet", lean: 0.65, hours: 24 * 3, outcome: "yes" },
  { question: "Will the NBA schedule drop with a Bulls Christmas game?", details: "Official NBA schedule release.", category: "sports", community: "nba", lean: 0.3, hours: 24 * 40, outcome: "no" },
];

export const COMMENT_LINES = {
  yes: [
    "YES and it's not close",
    "free money, thank me later",
    "calling it now. screenshot this",
    "lock of the week",
    "if this hits NO I'm deleting the app",
    "every time I doubt it, it happens",
    "smashed YES with 25, no regrets",
  ],
  no: [
    "fading this all day",
    "NO. y'all are coping",
    "bro really thinks this is happening 💀",
    "easiest NO of my life",
    "the vibes say no and the vibes are never wrong",
    "taking the other side of all of you",
    "my roommate bet YES so I had to go NO",
  ],
  neutral: [
    "who's taking the other side?",
    "odds feel off to me",
    "this one's going to be close",
    "need a source for the resolution tbh",
    "following for the drama",
    "I'll bet once the line moves",
  ],
  replies: ["we'll see 👀", "bookmarking this", "hold that thought", "skill issue", "respect the conviction", "say less"],
};
