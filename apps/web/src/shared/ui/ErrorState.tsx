type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = "Something went wrong",
  message = "Please try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-red-900">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-red-800">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md bg-red-900 px-3 py-1.5 text-sm text-white hover:bg-red-800"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
