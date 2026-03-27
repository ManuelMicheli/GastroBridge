"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";

type Props = {
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  index?: number;
};

export function QuickAction({ href, label, description, icon: Icon, index = 0 }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={href}
        className="group flex items-center gap-3 p-3 rounded-xl bg-surface-card border border-border-subtle hover:border-border-accent hover:bg-surface-hover transition-all"
      >
        <div className="p-2 rounded-lg bg-accent-green-muted group-hover:bg-accent-green/20 transition-colors">
          <Icon className="h-4 w-4 text-accent-green" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary">{label}</p>
          {description && (
            <p className="text-xs text-text-tertiary truncate">{description}</p>
          )}
        </div>
        <ArrowUpRight className="h-4 w-4 text-text-tertiary group-hover:text-accent-green transition-colors shrink-0" />
      </Link>
    </motion.div>
  );
}
