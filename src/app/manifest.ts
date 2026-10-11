import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bet-a-Verse",
    short_name: "Bet-a-Verse",
    description: "Swipe right for YES, left for NO. Fast, social prediction markets with play coins.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f5fa",
    theme_color: "#3554f5",
    categories: ["games", "social", "entertainment"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
