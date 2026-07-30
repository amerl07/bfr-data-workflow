/** Shared chart chrome colors (dataviz skill's reference palette § Chart
 * chrome & ink), so every chart on the Analytics/Performance pages agrees
 * on gridlines, axis lines, and ink regardless of which library rendered it. */
export const CHART_CHROME = {
  light: {
    surface: "#fcfcfb",
    grid: "#e1e0d9",
    axis: "#c3c2b7",
    text: "#52514e",
    textPrimary: "#0b0b0b",
    muted: "#898781",
    ring: "#fcfcfb",
  },
  dark: {
    surface: "#1a1a19",
    grid: "#2c2c2a",
    axis: "#383835",
    text: "#c3c2b7",
    textPrimary: "#ffffff",
    muted: "#898781",
    ring: "#1a1a19",
  },
} as const;
