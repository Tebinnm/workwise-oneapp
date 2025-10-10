import { createContext, useEffect, useState, ReactNode } from "react";

// Helper function to convert hex to HSL
function hexToHSL(hex: string): string {
  // Remove the hash if present
  hex = hex.replace(/^#/, "");

  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  const lValue = Math.round(l * 100);

  return `${h} ${s}% ${lValue}%`;
}

export interface BackgroundOption {
  id: string;
  label: string;
  url: string | null;
  thumbnail?: string;
}

export const backgroundOptions: BackgroundOption[] = [
  {
    id: "oneapp1",
    label: "OneApp 1",
    url: "/src/bg-oneapp1.png",
    thumbnail: "/src/bg-oneapp1.png",
  },
  {
    id: "oneapp2",
    label: "OneApp 2",
    url: "/src/bg-oneapp2.jpg",
    thumbnail: "/src/bg-oneapp2.jpg",
  },
  {
    id: "oneapp3",
    label: "OneApp 3",
    url: "/src/bg-oneapp3.jpg",
    thumbnail: "/src/bg-oneapp3.jpg",
  },
  {
    id: "oneapp4",
    label: "OneApp 4",
    url: "/src/bg-oneapp4.jpg",
    thumbnail: "/src/bg-oneapp4.jpg",
  },
  {
    id: "oneapp5",
    label: "OneApp 5",
    url: "/src/bg-oneapp5.jpg",
    thumbnail: "/src/bg-oneapp5.jpg",
  },
  {
    id: "oneapp6",
    label: "OneApp 6",
    url: "/src/bg-oneapp6.jpg",
    thumbnail: "/src/bg-oneapp6.jpg",
  },
];

interface ThemeContextType {
  themeColor: string;
  setThemeColor: (color: string) => void;
  background: string;
  setBackground: (backgroundId: string) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(
  undefined
);

const STORAGE_KEY_COLOR = "workwise-theme-color";
const STORAGE_KEY_BACKGROUND = "workwise-background";
const DEFAULT_COLOR = "#ff6b35"; // Orange default
const DEFAULT_BACKGROUND = "oneapp1";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeColor, setThemeColorState] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_COLOR);
    return stored || DEFAULT_COLOR;
  });

  const [background, setBackgroundState] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_BACKGROUND);
    return stored || DEFAULT_BACKGROUND;
  });

  useEffect(() => {
    const root = document.documentElement;
    const hslColor = hexToHSL(themeColor);

    // Parse HSL to adjust lightness for glow effect
    const [h, s, l] = hslColor.split(" ");
    const lightnessValue = parseInt(l);
    const glowLightness = Math.min(lightnessValue + 7, 100);

    // Apply theme CSS variables
    root.style.setProperty("--primary", hslColor);
    root.style.setProperty("--primary-glow", `${h} ${s} ${glowLightness}%`);
    root.style.setProperty("--accent", hslColor);
    root.style.setProperty("--ring", hslColor);

    // Update sidebar colors to match
    root.style.setProperty("--sidebar-ring", hslColor);
    root.style.setProperty("--sidebar-primary", hslColor);

    // Update gradient primary
    root.style.setProperty(
      "--gradient-primary",
      `linear-gradient(135deg, hsl(${hslColor}), hsl(${h} ${s} ${glowLightness}%))`
    );

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY_COLOR, themeColor);
  }, [themeColor]);

  useEffect(() => {
    const selectedBackground = backgroundOptions.find(
      (bg) => bg.id === background
    );

    if (selectedBackground) {
      const body = document.body;
      if (selectedBackground.url) {
        body.style.backgroundImage = `url(${selectedBackground.url})`;
      } else {
        body.style.backgroundImage = "none";
      }
      localStorage.setItem(STORAGE_KEY_BACKGROUND, background);
    }
  }, [background]);

  const setThemeColor = (newColor: string) => {
    setThemeColorState(newColor);
  };

  const setBackground = (backgroundId: string) => {
    setBackgroundState(backgroundId);
  };

  return (
    <ThemeContext.Provider
      value={{ themeColor, setThemeColor, background, setBackground }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
