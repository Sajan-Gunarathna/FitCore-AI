import * as React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, helperText, icon, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8]"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-[#94A3B8]">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full rounded-xl bg-[#161F2B] border ${
              error ? "border-red-500/80 focus:border-red-500 focus:ring-red-500/30" : "border-[#27313D] focus:border-[#B8FF3B] focus:ring-[#B8FF3B]/30"
            } px-4 py-2.5 text-sm text-[#F8FAFC] placeholder-[#94A3B8]/50 transition-all duration-150 focus:outline-none focus:ring-2 ${
              icon ? "pl-10" : ""
            } ${className}`}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs text-red-400 font-medium">{error}</p>
        )}
        {!error && helperText && (
          <p className="text-xs text-[#94A3B8]">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
