import type { Category } from "@/lib/types";

/** Card backgrounds per category: deep gradients that keep white text readable. */
export const CATEGORY_GRADIENTS: Record<Category, string> = {
  campus: "linear-gradient(160deg, #8a1538 0%, #4a0a22 100%)",
  sports: "linear-gradient(160deg, #2747d6 0%, #0f1f6b 100%)",
  culture: "linear-gradient(160deg, #9b2bb5 0%, #45105e 100%)",
  crypto: "linear-gradient(160deg, #c2570c 0%, #5a2307 100%)",
  news: "linear-gradient(160deg, #0f7a73 0%, #063a37 100%)",
  other: "linear-gradient(160deg, #3b4760 0%, #121826 100%)",
};
