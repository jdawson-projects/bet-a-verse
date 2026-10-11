import { describe, expect, it } from "vitest";
import { decideSwipe } from "@/components/card-stack/card-stack";

const T = 110;
const V = 650;
const still = { x: 0, y: 0 };

describe("decideSwipe (card stack release physics)", () => {
  it("past the threshold commits: right → YES side, left → NO side, up → skip", () => {
    expect(decideSwipe({ x: 120, y: 10 }, still, T, V)).toBe("right");
    expect(decideSwipe({ x: -130, y: -20 }, still, T, V)).toBe("left");
    expect(decideSwipe({ x: 15, y: -140 }, still, T, V)).toBe("up");
  });

  it("short of the threshold springs back", () => {
    expect(decideSwipe({ x: 80, y: 0 }, still, T, V)).toBeNull();
    expect(decideSwipe({ x: 0, y: -90 }, still, T, V)).toBeNull();
  });

  it("a fast fling commits a shorter drag, but not a tiny twitch", () => {
    expect(decideSwipe({ x: 45, y: 0 }, { x: 900, y: 0 }, T, V)).toBe("right");
    expect(decideSwipe({ x: 10, y: 0 }, { x: 900, y: 0 }, T, V)).toBeNull();
  });

  it("dragging down never commits", () => {
    expect(decideSwipe({ x: 0, y: 300 }, { x: 0, y: 1200 }, T, V)).toBeNull();
  });
});
