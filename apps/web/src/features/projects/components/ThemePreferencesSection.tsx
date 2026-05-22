import { ThemePreferenceSelect } from "../../../shared/theme/ThemePreferenceSelect";

export function ThemePreferencesSection() {
  return (
    <section className="shell-panel p-4">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Appearance</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Choose light, dark, or match your system setting. Applies to navigation, login, and workbench chrome.
      </p>
      <div className="mt-4">
        <ThemePreferenceSelect />
      </div>
    </section>
  );
}
