import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import {
  applyResolvedTheme,
  getStoredThemePreference,
  resolveTheme,
  setStoredThemePreference,
  type ResolvedTheme,
  type ThemePreference
} from "./themePreference";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => getStoredThemePreference());
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(getStoredThemePreference()));

  const syncResolved = useCallback((pref: ThemePreference) => {
    const next = resolveTheme(pref);
    setResolved(next);
    applyResolvedTheme(next);
  }, []);

  useEffect(() => {
    syncResolved(preference);
  }, [preference, syncResolved]);

  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => syncResolved("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference, syncResolved]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setStoredThemePreference(next);
      setPreferenceState(next);
    },
    []
  );

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
