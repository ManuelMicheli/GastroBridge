import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/formatters";

interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
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
              className="f-label"
            >
              {label}
            </label>
          )}
          <div
            className={cn(
              "f-input flex items-center gap-2 !h-auto min-h-11 disabled:opacity-50",
              error && "!border-[var(--f-danger)]"
            )}
          >
            {prefix && <span className="text-[var(--f-muted)] shrink-0">{prefix}</span>}
            <input
              ref={ref}
              id={inputId}
              className={cn(
                "flex-1 py-2.5 bg-transparent text-[var(--f-ink)] placeholder:text-[var(--f-faint)] focus:outline-none disabled:opacity-50",
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
            {suffix && <span className="text-[var(--f-muted)] shrink-0">{suffix}</span>}
          </div>
          {error && (
            <p
              id={`${inputId}-error`}
              className="text-[13px] text-[var(--f-danger)]"
              role="alert"
            >
              {error}
            </p>
          )}
          {helperText && !error && (
            <p id={`${inputId}-helper`} className="text-[13px] text-[var(--f-muted)]">
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
            className="f-label"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "f-input disabled:opacity-50",
            error && "!border-[var(--f-danger)]",
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
            className="text-[13px] text-[var(--f-danger)]"
            role="alert"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="text-[13px] text-[var(--f-muted)]">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input, type InputProps };
