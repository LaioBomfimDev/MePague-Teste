"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeChoice =
  | "system"
  | "light"
  | "dark"
  | "pink"
  | "pink-full"
  | "pink-night"
  | "blue"
  | "blue-full"
  | "blue-night"
  | "lime-pop"
  | "aurora-mint"
  | "graphite-coral";
export type EffectiveTheme = Exclude<ThemeChoice, "system">;

type ThemeContextValue = {
  effectiveTheme: EffectiveTheme;
  setTheme: (theme: ThemeChoice) => void;
  theme: ThemeChoice;
};

const STORAGE_KEY = "me-pague:theme";
const THEME_CHOICES: ThemeChoice[] = [
  "system",
  "light",
  "dark",
  "pink",
  "pink-full",
  "pink-night",
  "blue",
  "blue-full",
  "blue-night",
  "lime-pop",
  "aurora-mint",
  "graphite-coral",
];
const ThemeContext = createContext<ThemeContextValue | null>(null);

const themeMeta: Record<EffectiveTheme, { colorScheme: "dark" | "light"; themeColor: string }> = {
  "aurora-mint": { colorScheme: "light", themeColor: "#F5FDFF" },
  blue: { colorScheme: "light", themeColor: "#F4F9FF" },
  "blue-full": { colorScheme: "light", themeColor: "#DBEAFE" },
  "blue-night": { colorScheme: "dark", themeColor: "#06152E" },
  dark: { colorScheme: "dark", themeColor: "#101011" },
  "graphite-coral": { colorScheme: "dark", themeColor: "#111716" },
  "lime-pop": { colorScheme: "light", themeColor: "#F7FFE9" },
  light: { colorScheme: "light", themeColor: "#FFFFFF" },
  pink: { colorScheme: "light", themeColor: "#FFF6FB" },
  "pink-full": { colorScheme: "light", themeColor: "#FFD6E9" },
  "pink-night": { colorScheme: "dark", themeColor: "#240012" },
};

function isThemeChoice(value: string | null): value is ThemeChoice {
  return Boolean(value && THEME_CHOICES.includes(value as ThemeChoice));
}

function getStoredTheme(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isThemeChoice(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function getSystemTheme(): EffectiveTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(theme: ThemeChoice): EffectiveTheme {
  return theme === "system" ? getSystemTheme() : theme;
}

function applyTheme(theme: ThemeChoice) {
  const effectiveTheme = resolveTheme(theme);
  const meta = themeMeta[effectiveTheme];
  const root = document.documentElement;
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

  root.dataset.theme = effectiveTheme;
  root.dataset.themeChoice = theme;
  root.style.colorScheme = meta.colorScheme;

  if (themeColor) {
    themeColor.content = meta.themeColor;
  }

  return effectiveTheme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("system");
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>("light");

  const setTheme = useCallback((nextTheme: ThemeChoice) => {
    setThemeState(nextTheme);

    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // Theme still applies for the current session when storage is unavailable.
    }

    setEffectiveTheme(applyTheme(nextTheme));
  }, []);

  useEffect(() => {
    const storedTheme = getStoredTheme();
    setThemeState(storedTheme);
    setEffectiveTheme(applyTheme(storedTheme));
  }, []);

  useEffect(() => {
    if (theme !== "system") {
      setEffectiveTheme(applyTheme(theme));
      return;
    }

    const systemPreference = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => setEffectiveTheme(applyTheme("system"));

    syncSystemTheme();
    systemPreference.addEventListener("change", syncSystemTheme);

    return () => systemPreference.removeEventListener("change", syncSystemTheme);
  }, [theme]);

  const value = useMemo(
    () => ({
      effectiveTheme,
      setTheme,
      theme,
    }),
    [effectiveTheme, setTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}
