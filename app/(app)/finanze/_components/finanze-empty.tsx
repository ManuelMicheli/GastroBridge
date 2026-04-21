"use client";

import Link from "next/link";
import { Receipt, ArrowRight } from "lucide-react";

type Props = {
  heading: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
};

export function FinanzeEmpty({ heading, body, ctaLabel, ctaHref }: Props) {
  return (
    <div className="bg-surface-card border border-border-subtle rounded-2xl p-8 lg:p-12 text-center">
      <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-accent-green/10 mb-5">
        <Receipt className="h-6 w-6 text-accent-green" />
      </div>
      <h2 className="text-xl font-semibold text-text-primary mb-2">{heading}</h2>
      <p className="text-sm text-text-secondary max-w-md mx-auto mb-6">{body}</p>
      <Link
        href={ctaHref}
        className="inline-flex items-center gap-2 rounded-lg bg-accent-green px-4 py-2 text-sm font-medium text-surface-base hover:bg-accent-green/90 transition-colors"
      >
        {ctaLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
