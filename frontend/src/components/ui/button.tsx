import * as React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#B8FF3B]/40 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]";

    const variantStyles = {
      primary:
        "bg-[#B8FF3B] text-[#090D12] hover:bg-[#A3E635] shadow-[0_0_20px_rgba(184,255,59,0.25)] hover:shadow-[0_0_25px_rgba(184,255,59,0.4)] border border-[#B8FF3B]/30",
      secondary:
        "bg-[#1A232D] text-[#F8FAFC] hover:bg-[#27313D] border border-[#27313D]",
      outline:
        "bg-transparent text-[#F8FAFC] hover:bg-[#121922] border border-[#27313D] hover:border-[#94A3B8]/30",
      ghost:
        "bg-transparent text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#121922]",
      danger:
        "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30",
    };

    const sizeStyles = {
      sm: "text-xs px-3 py-1.5 gap-1.5",
      md: "text-sm px-4 py-2.5 gap-2",
      lg: "text-base px-6 py-3.5 gap-2.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-current" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
