import { Button } from "./Button";

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = "Something went wrong",
  message = "Please try again.",
  onRetry
}: ErrorStateProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-red-900 dark:border-red-900 dark:bg-red-950/50">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-red-800 dark:text-red-200">{message}</p>
      {onRetry ? (
        <Button variant="danger" className="mt-4" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
