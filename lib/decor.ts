import { getTheme, type ThemeId } from "./themes";

// Fun illustrations: original doodle characters (components/Doodle.tsx) that decorate the big
// screen and voters' phones. Each slide design has its own pair; the presenter can turn them off.

export const CHARACTERS = ["blob", "mug", "bulb", "star", "cat", "robot", "trophy", "plane", "leaf", "moon", "pencil", "boat", "flower"] as const;
export type Character = (typeof CHARACTERS)[number];

const BY_THEME: Record<ThemeId, { screen: Character; phone: Character }> = {
  paper: { screen: "plane", phone: "blob" },
  mono: { screen: "pencil", phone: "plane" },
  harbour: { screen: "boat", phone: "mug" },
  forest: { screen: "leaf", phone: "blob" },
  blush: { screen: "flower", phone: "star" },
  pop: { screen: "star", phone: "blob" },
  anime: { screen: "cat", phone: "star" },
  chalk: { screen: "pencil", phone: "bulb" },
  midnight: { screen: "moon", phone: "star" },
  neon: { screen: "robot", phone: "bulb" },
  arcade: { screen: "trophy", phone: "star" },
};

/** The characters a design shows: a bigger one on the big screen, a small one on phones. */
export function charactersFor(theme: string | null | undefined): { screen: Character; phone: Character } {
  return BY_THEME[getTheme(theme).id];
}
