"use client";

import { Chips } from "@/components/fernly/chips";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * SegmentedControl — full-width Fernly chip rail with a sliding accent pill.
 * Keyboard: arrow keys cycle (radio-group semantics).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <Chips
      options={options}
      value={value}
      onChange={onChange}
      ariaLabel={ariaLabel}
      stretch
      size="sm"
      className={className}
    />
  );
}
