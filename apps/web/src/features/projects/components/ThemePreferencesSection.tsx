import { ThemePreferenceSelect } from "../../../shared/theme/ThemePreferenceSelect";

export function ThemePreferencesSection() {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Appearance</h2>
      <ThemePreferenceSelect />
    </section>
  );
}
