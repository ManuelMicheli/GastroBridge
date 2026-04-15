"use client";

import type { CertificationType } from "@/types/database";
import { CERTIFICATION_VALUES } from "@/lib/restaurants/schemas";
import { cn } from "@/lib/utils/formatters";

export function CertificationMultiSelect({
  value,
  onChange,
  disabled,
}: {
  value: CertificationType[];
  onChange: (next: CertificationType[]) => void;
  disabled?: boolean;
}) {
  const toggle = (cert: CertificationType) => {
    if (value.includes(cert)) {
      onChange(value.filter((c) => c !== cert));
    } else {
      onChange([...value, cert]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {CERTIFICATION_VALUES.map((cert) => {
        const active = value.includes(cert);
        return (
          <button
            key={cert}
            type="button"
            disabled={disabled}
            onClick={() => toggle(cert)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold border-2 transition-colors",
              active
                ? "bg-forest text-white border-forest"
                : "bg-white text-sage border-sage-muted hover:border-forest/60",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {cert}
          </button>
        );
      })}
    </div>
  );
}
