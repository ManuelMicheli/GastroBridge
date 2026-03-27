"use client";

import { motion } from "motion/react";

type BarItem = {
  label: string;
  value: number;
  subtitle?: string;
};

type Props = {
  items: BarItem[];
  color?: string;
  maxItems?: number;
};

export function MiniBar({
  items,
  color = "var(--color-accent-green)",
  maxItems = 5,
}: Props) {
  const displayItems = items.slice(0, maxItems);
  const maxValue = Math.max(...displayItems.map((i) => i.value), 1);

  return (
    <div className="space-y-3">
      {displayItems.map((item, i) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary truncate mr-2">{item.label}</span>
            <span className="text-text-primary font-mono font-medium shrink-0">
              {item.subtitle || item.value}
            </span>
          </div>
          <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: color }}
              initial={{ width: 0 }}
              animate={{ width: `${(item.value / maxValue) * 100}%` }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
