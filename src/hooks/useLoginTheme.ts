import { useContext } from "react";
import { LoginThemeContext } from "@/contexts/LoginThemeContext";

export function useLoginTheme() {
  const context = useContext(LoginThemeContext);
  if (context === undefined) {
    throw new Error("useLoginTheme must be used within a LoginThemeProvider");
  }
  return context;
}
