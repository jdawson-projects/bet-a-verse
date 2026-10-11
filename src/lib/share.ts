/** Native share sheet when available, else copy to clipboard. Returns what happened. */
export async function shareLink(url: string, text: string): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await navigator.share({ url, text, title: "Bet-a-Verse" });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return "copied";
  } catch {
    return "failed";
  }
}

export function marketUrl(id: string): string {
  return `${window.location.origin}/m/${id}`;
}
