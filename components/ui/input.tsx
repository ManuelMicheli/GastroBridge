import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/formatters";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { className, label, error, helperText, prefix, suffix, id, ...props },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    if (prefix || suffix) {
      return (
        <div className="flex flex-col gap-1.5">
          {label && (
            <label
              htmlFor={inputId}
              className="text-sm font-semibold text-charcoal"
            >
              {label}
            </label>
          )}
          <div
            className={cn(
              "flex items-center gap-2 w-full border-2 border-sage-muted rounded-xl px-4 font-body transition-colors duration-200 focus-within:border-forest disabled:opacity-50",
              error && "border-red-500 focus-within:border-red-500"
            )}
          >
            {prefix && <span className="text-sage shrink-0">{prefix}</span>}
            <input
              ref={ref}
              id={inputId}
              className={cn(
                "flex-1 py-3.5 bg-transparent text-charcoal placeholder:text-sage focus:outline-none disabled:opacity-50",
                className
              )}
              aria-invalid={error ? "true" : undefined}
              aria-describedby={
                error
                  ? `${inputId}-error`
                  : helperText
                    ? `${inputId}-helper`
                    : undefined
              }
              {...props}
            />
            {suffix && <span className="text-sage shrink-0">{suffix}</span>}
          </div>
          {error && (
            <p
              id={`${inputId}-error`}
              className="text-sm text-red-600"
              role="alert"
            >
              {error}
            </p>
          )}
          {helperText && !error && (
            <p id={`${inputId}-helper`} className="text-sm text-sage">
              {helperText}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-semibold text-charcoal"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full border-2 border-sage-muted rounded-xl py-3.5 px-4 font-body text-charcoal placeholder:text-sage transition-colors duration-200 focus:border-forest focus:outline-none focus:ring-0 disabled:opacity-50 disabled:bg-gray-50",
            error && "border-red-500 focus:border-red-500",
            className
          )}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={
            error
              ? `${inputId}-error`
              : helperText
                ? `${inputId}-helper`
                : undefined
          }
          {...props}
        />
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-sm text-red-600"
            role="alert"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="text-sm text-sage">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input, type InputProps };
