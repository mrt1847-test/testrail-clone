import { useTheme } from "./ThemeProvider";
import type { ThemePreference } from "./themePreference";

const OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" }
];

type ThemePreferenceSelectProps = {
  className?: string;
  compact?: boolean;
};

export function ThemePreferenceSelect({ className = "", compact = false }: ThemePreferenceSelectProps) {
  const { preference, setPreference } = useTheme();

  if (compact) {
    return (
      <label className={`inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 ${className}`}>
        <span className="sr-only">Theme</span>
        <select
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          value={preference}
          onChange={(event) => setPreference(event.target.value as ThemePreference)}
          aria-label="Color theme"
        >
          {OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className={`block space-y-1 text-sm text-slate-700 dark:text-slate-200 ${className}`}>
      <span className="font-medium">Color theme</span>
      <select
        className="w-full max-w-xs rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        value={preference}
        onChange={(event) => setPreference(event.target.value as ThemePreference)}
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="text-xs text-slate-500 dark:text-slate-400">
        Stored in this browser. System follows your OS appearance setting.
      </span>
    </label>
  );
}
