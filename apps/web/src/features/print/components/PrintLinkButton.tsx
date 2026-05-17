import { Link } from "react-router-dom";

type PrintLinkButtonProps = {
  to: string;
  className?: string;
};

export function PrintLinkButton({ to, className }: PrintLinkButtonProps) {
  return (
    <Link
      to={to}
      className={
        className ??
        "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      }
    >
      Print view
    </Link>
  );
}
