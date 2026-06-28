import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "white" | "ghost";

interface BaseProps {
  variant?: ButtonVariant;
  size?: "md" | "lg";
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary hover:shadow-lg active:scale-95",
  secondary:
    "bg-secondary-container text-on-secondary-container border border-outline-variant hover:bg-muted",
  white:
    "bg-white text-primary hover:bg-primary-fixed shadow-xl active:scale-95",
  ghost:
    "bg-transparent text-on-surface-variant hover:text-primary",
};

const sizeClasses = {
  md: "px-8 py-4 text-sm",
  lg: "px-10 py-5 text-base",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-label font-medium tracking-wide transition-all";

interface ButtonAsButton
  extends BaseProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> {
  href?: undefined;
}

interface ButtonAsLink extends BaseProps {
  href: string;
}

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = "primary", size = "md", children, className = "" } = props;
  const classes = `${base} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={classes}>
        {children}
      </Link>
    );
  }

  const { href, ...buttonProps } = props as ButtonAsButton;
  return (
    <button className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
