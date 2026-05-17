import { Link } from "react-router-dom";

type PrintLinkButtonProps = {
  to: string;
  className?: string;
  label?: string;
  openInNewTab?: boolean;
};

export function PrintLinkButton({
  to,
  className,
  label = "Print view",
  openInNewTab = true
}: PrintLinkButtonProps) {
  return (
    <Link
      to={to}
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noopener noreferrer" : undefined}
      className={
        className ??
        "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      }
    >
      {label}
    </Link>
  );
}
