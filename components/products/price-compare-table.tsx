"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatUnitShort } from "@/lib/utils/formatters";
import { Star, Shield, Plus, Minus, ChevronDown, Truck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { UnitType } from "@/types/database";
import type { PriceCompareRow, ProductBadge } from "@/types/products";

const BADGE_CONFIG: Record<ProductBadge, { label: string; variant: "success" | "warning" | "info" | "default" }> = {
  "miglior-prezzo": { label: "Miglior prezzo", variant: "success" },
  "piu-venduto": { label: "Piu venduto", variant: "info" },
  "nuovo": { label: "Nuovo", variant: "warning" },
  "consegna-domani": { label: "Consegna domani", variant: "info" },
  "bio": { label: "BIO", variant: "success" },
  "dop": { label: "DOP", variant: "success" },
  "igp": { label: "IGP", variant: "success" },
  "km0": { label: "Km 0", variant: "success" },
};

interface PriceCompareTableProps {
  rows: PriceCompareRow[];
  productName: string;
  unit: UnitType;
  onAddToCart: (row: PriceCompareRow, quantity: number) => void;
}

export function PriceCompareTable({ rows, productName, unit, onAddToCart }: PriceCompareTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(rows.map((r) => [r.supplier.id, r.product.min_quantity]))
  );

  const sortedRows = [...rows].sort((a, b) => a.product.price - b.product.price);

  return (
    <div>
      <h2 className="text-xl font-bold text-charcoal mb-1">{productName}</h2>
      <p className="text-sm text-sage mb-6">
        {rows.length} fornitori disponibili — ordinati per prezzo
      </p>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-2xl shadow-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-6 py-3 text-xs font-semibold text-sage uppercase tracking-wider">Fornitore</th>
              <th className="px-6 py-3 text-xs font-semibold text-sage uppercase tracking-wider">Prezzo/{formatUnitShort(unit)}</th>
              <th className="px-6 py-3 text-xs font-semibold text-sage uppercase tracking-wider">Consegna</th>
              <th className="px-6 py-3 text-xs font-semibold text-sage uppercase tracking-wider">Rating</th>
              <th className="px-6 py-3 text-xs font-semibold text-sage uppercase tracking-wider">Quantita</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => {
              const isBest = i === 0;
              const isExpanded = expandedId === row.supplier.id;
              const qty = quantities[row.supplier.id] ?? row.product.min_quantity;

              return (
                <motion.tr
                  key={row.supplier.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className={cn(
                    "border-t border-sage-muted/20 cursor-pointer hover:bg-gray-50/50 transition-colors",
                    isBest && "bg-forest-light/50"
                  )}
                  onClick={() => setExpandedId(isExpanded ? null : row.supplier.id)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-sage-muted/30 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-sage">
                          {row.supplier.company_name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-charcoal text-sm">
                            {row.supplier.company_name}
                          </span>
                          {row.supplier.is_verified && (
                            <Shield className="h-3.5 w-3.5 text-forest" />
                          )}
                        </div>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {row.badges.map((badge) => (
                            <Badge key={badge} variant={BADGE_CONFIG[badge].variant} className="text-[10px] px-1.5 py-0">
                              {BADGE_CONFIG[badge].label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "font-mono font-bold text-lg",
                      isBest ? "text-forest" : "text-charcoal"
                    )}>
                      {formatCurrency(row.product.price)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-sage">
                      <Truck className="h-4 w-4" />
                      <span>
                        {row.deliveryInfo.canDeliverTomorrow ? "Domani" : "2-3 gg"}
                      </span>
                    </div>
                    {row.deliveryInfo.deliveryFee > 0 && (
                      <span className="text-xs text-sage">
                        +{formatCurrency(row.deliveryInfo.deliveryFee)}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-terracotta text-terracotta" />
                      <span className="text-sm font-semibold">{row.supplier.rating_avg.toFixed(1)}</span>
                      <span className="text-xs text-sage">({row.supplier.rating_count})</span>
                    </div>
                  </td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setQuantities((q) => ({
                          ...q,
                          [row.supplier.id]: Math.max(row.product.min_quantity, (q[row.supplier.id] ?? row.product.min_quantity) - 1),
                        }))}
                        className="p-1 rounded-lg hover:bg-sage-muted/30"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        value={qty}
                        min={row.product.min_quantity}
                        onChange={(e) => setQuantities((q) => ({
                          ...q,
                          [row.supplier.id]: Math.max(row.product.min_quantity, parseFloat(e.target.value) || row.product.min_quantity),
                        }))}
                        className="w-14 text-center border border-sage-muted rounded-lg py-1 text-sm font-mono"
                      />
                      <button
                        onClick={() => setQuantities((q) => ({
                          ...q,
                          [row.supplier.id]: (q[row.supplier.id] ?? row.product.min_quantity) + 1,
                        }))}
                        className="p-1 rounded-lg hover:bg-sage-muted/30"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      onClick={() => onAddToCart(row, qty)}
                    >
                      Aggiungi
                    </Button>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Stack */}
      <div className="md:hidden space-y-4">
        {sortedRows.map((row, i) => {
          const isBest = i === 0;
          const qty = quantities[row.supplier.id] ?? row.product.min_quantity;

          return (
            <motion.div
              key={row.supplier.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className={cn(
                "bg-white rounded-2xl p-5 shadow-card",
                isBest && "ring-2 ring-forest"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-sage-muted/30 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-sage">
                      {row.supplier.company_name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-sm">{row.supplier.company_name}</span>
                      {row.supplier.is_verified && <Shield className="h-3.5 w-3.5 text-forest" />}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="h-3 w-3 fill-terracotta text-terracotta" />
                      <span className="text-xs">{row.supplier.rating_avg.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
                <span className={cn(
                  "font-mono font-bold text-xl",
                  isBest ? "text-forest" : "text-charcoal"
                )}>
                  {formatCurrency(row.product.price)}
                </span>
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                {row.badges.map((badge) => (
                  <Badge key={badge} variant={BADGE_CONFIG[badge].variant} className="text-[10px]">
                    {BADGE_CONFIG[badge].label}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setQuantities((q) => ({
                      ...q,
                      [row.supplier.id]: Math.max(row.product.min_quantity, (q[row.supplier.id] ?? row.product.min_quantity) - 1),
                    }))}
                    className="p-1.5 rounded-lg border border-sage-muted"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    value={qty}
                    min={row.product.min_quantity}
                    onChange={(e) => setQuantities((q) => ({
                      ...q,
                      [row.supplier.id]: Math.max(row.product.min_quantity, parseFloat(e.target.value) || row.product.min_quantity),
                    }))}
                    className="w-14 text-center border border-sage-muted rounded-lg py-1.5 text-sm font-mono"
                  />
                  <button
                    onClick={() => setQuantities((q) => ({
                      ...q,
                      [row.supplier.id]: (q[row.supplier.id] ?? row.product.min_quantity) + 1,
                    }))}
                    className="p-1.5 rounded-lg border border-sage-muted"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <Button size="sm" onClick={() => onAddToCart(row, qty)}>
                  Aggiungi
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
