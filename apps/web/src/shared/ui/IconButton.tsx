import { forwardRef, type ButtonHTMLAttributes } from "react";

import { buttonClassName } from "./buttonStyles";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  size?: "sm" | "md";
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = "md", className, children, ...props },
  ref
) {
  const dimension = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  return (
    <button
      ref={ref}
      type={props.type ?? "button"}
      aria-label={label}
      title={label}
      className={buttonClassName({ variant: "ghost", size, className: `${dimension} !p-0 ${className ?? ""}` })}
      {...props}
    >
      {children}
    </button>
  );
});
