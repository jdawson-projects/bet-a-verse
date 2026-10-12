// Colors for the campus map, day and night. Faces get three shades from one
// base color; night pulls everything toward navy and lights the windows.

export type RGB = readonly [number, number, number];

export function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const WHITE: RGB = [1, 1, 1];
const BLACK: RGB = [0, 0, 0];
const NAVY: RGB = hex("#070a14");

export interface Shades {
  top: RGB;
  left: RGB;
  right: RGB;
  edge: RGB;
}

export interface Palette {
  night: boolean;
  shades: (base: RGB) => Shades;
  roofShades: (base: RGB) => Shades;
  land: RGB;
  landEdge: RGB;
  street: RGB;
  dash: RGB;
  park: RGB;
  path: RGB;
  water: RGB;
  waterRim: RGB;
  berm: RGB;
  rail: RGB;
  tie: RGB;
  trunk: RGB;
  leaf: RGB;
  leafLight: RGB;
  leafEdge: RGB;
  window: RGB;
  windowAlpha: number;
  windowLit: RGB;
  windowDark: RGB;
  shadow: RGB;
  shadowAlpha: number;
  cloud: RGB;
  cloudAlpha: number;
  star: RGB;
  glass: RGB;
  track: RGB;
  fieldLine: RGB;
  rink: RGB;
  fountain: RGB;
}

export const DAY: Palette = {
  night: false,
  shades: (b) => ({ top: mix(b, WHITE, 0.3), left: b, right: mix(b, BLACK, 0.3), edge: mix(b, BLACK, 0.58) }),
  roofShades: (b) => ({ top: mix(b, WHITE, 0.08), left: b, right: mix(b, BLACK, 0.28), edge: mix(b, BLACK, 0.55) }),
  land: hex("#e3e6ee"),
  landEdge: hex("#c2c7d3"),
  street: hex("#c0c5cf"),
  dash: hex("#f3eec2"),
  park: hex("#b9d6a0"),
  path: hex("#e8e4d6"),
  water: hex("#86b6e3"),
  waterRim: hex("#a9b0bc"),
  berm: hex("#8f9a7e"),
  rail: hex("#4a505c"),
  tie: hex("#6b7280"),
  trunk: hex("#6b4728"),
  leaf: hex("#5b9a45"),
  leafLight: hex("#8ccb66"),
  leafEdge: hex("#2f5a28"),
  window: hex("#1b2440"),
  windowAlpha: 0.5,
  windowLit: hex("#1b2440"),
  windowDark: hex("#1b2440"),
  shadow: hex("#1a2340"),
  shadowAlpha: 0.1,
  cloud: WHITE,
  cloudAlpha: 0.95,
  star: WHITE,
  glass: hex("#9ec8e8"),
  track: hex("#c86f58"),
  fieldLine: hex("#f4f7f0"),
  rink: hex("#e7f2fb"),
  fountain: WHITE,
};

export const NIGHT: Palette = {
  night: true,
  shades: (b) => ({
    top: mix(mix(b, NAVY, 0.45), WHITE, 0.04),
    left: mix(b, NAVY, 0.62),
    right: mix(b, NAVY, 0.74),
    edge: mix(b, NAVY, 0.9),
  }),
  roofShades: (b) => ({ top: mix(b, NAVY, 0.5), left: mix(b, NAVY, 0.6), right: mix(b, NAVY, 0.75), edge: mix(b, NAVY, 0.9) }),
  land: hex("#1a2030"),
  landEdge: hex("#0e121d"),
  street: hex("#252b3a"),
  dash: hex("#6a6440"),
  park: hex("#1f3a2b"),
  path: hex("#2b3142"),
  water: hex("#1b3a60"),
  waterRim: hex("#2a3244"),
  berm: hex("#26302a"),
  rail: hex("#8a92a6"),
  tie: hex("#3a4150"),
  trunk: hex("#2d2117"),
  leaf: hex("#2b5536"),
  leafLight: hex("#3f7a48"),
  leafEdge: hex("#142b1c"),
  window: hex("#ffd36a"),
  windowAlpha: 1,
  windowLit: hex("#ffd36a"),
  windowDark: hex("#1c2436"),
  shadow: BLACK,
  shadowAlpha: 0.4,
  cloud: hex("#8c9ec8"),
  cloudAlpha: 0.14,
  star: hex("#e8eeff"),
  glass: hex("#3a6f9c"),
  track: hex("#5a3a33"),
  fieldLine: hex("#6b7a6a"),
  rink: hex("#a9d2f0"),
  fountain: hex("#cfe3f6"),
};
