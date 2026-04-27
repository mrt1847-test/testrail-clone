type LoadingStateProps = {
  message?: string;
};

export function LoadingState({ message = "Loading…" }: LoadingStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white py-16 text-slate-600"
      role="status"
      aria-live="polite"
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800"
        aria-hidden
      />
      <p className="text-sm">{message}</p>
    </div>
  );
}
