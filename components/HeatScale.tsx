"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { heatStops, scaleColor, type RGB } from "@/lib/colors";
import { getTheme } from "@/lib/themes";

// Score colours (colour grid, heatmap, summary…) follow the slide design: a blue design scores in blues.
const Stops = createContext<RGB[] | undefined>(undefined);

/** Gives every score colour inside it the design's scale. */
export function HeatScale({ theme, children }: { theme: string | null | undefined; children: React.ReactNode }) {
  const stops = useMemo(() => heatStops(getTheme(theme)), [theme]);
  return <Stops.Provider value={stops}>{children}</Stops.Provider>;
}

/** `scaleColor` on the design's scale (the default scale outside a HeatScale). */
export function useScaleColor() {
  const stops = useContext(Stops);
  return useCallback((value: number, scaleMax: number) => scaleColor(value, scaleMax, stops), [stops]);
}
