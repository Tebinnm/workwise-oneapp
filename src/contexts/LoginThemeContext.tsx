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

interface LoginThemeContextType {
  themeColor: string;
  setThemeColor: (color: string) => void;
}

export const LoginThemeContext = createContext<
  LoginThemeContextType | undefined
>(undefined);

const STORAGE_KEY_COLOR = "workwise-theme-color";
const DEFAULT_COLOR = "#ff6b35"; // Orange default

export function LoginThemeProvider({ children }: { children: ReactNode }) {
  const [themeColor, setThemeColorState] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_COLOR);
    return stored || DEFAULT_COLOR;
  });

  useEffect(() => {
    const root = document.documentElement;
    const hslColor = hexToHSL(themeColor);

    // Parse HSL to adjust lightness for glow effect
    const [h, s, l] = hslColor.split(" ");
    const lightnessValue = parseInt(l);
    const glowLightness = Math.min(lightnessValue + 7, 100);

    // Apply theme CSS variables for login page
    root.style.setProperty("--primary", hslColor);
    root.style.setProperty("--primary-glow", `${h} ${s} ${glowLightness}%`);
    root.style.setProperty("--accent", hslColor);
    root.style.setProperty("--ring", hslColor);

    // Update gradient primary
    root.style.setProperty(
      "--gradient-primary",
      `linear-gradient(135deg, hsl(${hslColor}), hsl(${h} ${s} ${glowLightness}%))`
    );

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY_COLOR, themeColor);
  }, [themeColor]);

  // Explicitly ensure light mode for login page
  useEffect(() => {
    const root = document.documentElement;
    // Remove dark class to ensure light mode
    root.classList.remove("dark");

    // Cleanup function to restore dark mode when component unmounts
    return () => {
      // Only add dark class back if we're not on the login page
      if (!window.location.pathname.includes("/auth")) {
        root.classList.add("dark");
      }
    };
  }, []);

  const setThemeColor = (newColor: string) => {
    setThemeColorState(newColor);
  };

  return (
    <LoginThemeContext.Provider
      value={{
        themeColor,
        setThemeColor,
      }}
    >
      {children}
    </LoginThemeContext.Provider>
  );
}
