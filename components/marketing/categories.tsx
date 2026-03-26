"use client";

import { motion } from "motion/react";
import {
  Salad, Package, Wine, Snowflake, Box, SprayCan, Wrench,
} from "lucide-react";

const CATEGORIES = [
  { name: "Food Fresco", icon: Salad, count: "1.200+ prodotti", color: "bg-green-50 text-green-700" },
  { name: "Food Secco", icon: Package, count: "800+ prodotti", color: "bg-amber-50 text-amber-700" },
  { name: "Bevande", icon: Wine, count: "600+ prodotti", color: "bg-purple-50 text-purple-700" },
  { name: "Surgelati", icon: Snowflake, count: "400+ prodotti", color: "bg-blue-50 text-blue-700" },
  { name: "Packaging", icon: Box, count: "300+ prodotti", color: "bg-orange-50 text-orange-700" },
  { name: "Cleaning", icon: SprayCan, count: "200+ prodotti", color: "bg-cyan-50 text-cyan-700" },
  { name: "Attrezzature", icon: Wrench, count: "150+ prodotti", color: "bg-slate-50 text-slate-700" },
];

export function Categories() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-display text-charcoal mb-4">
            Tutto per la tua cucina
          </h2>
          <p className="text-sage text-lg max-w-xl mx-auto">
            7 categorie, migliaia di prodotti. Dal fresco ai surgelati, dalle bevande alle attrezzature.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {CATEGORIES.map((cat, i) => (
            <motion.div
              key={cat.name}
              className="bg-white rounded-2xl p-6 shadow-card hover:shadow-elevated transition-shadow cursor-pointer group"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3 ${cat.color}`}>
                <cat.icon className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-charcoal group-hover:text-forest transition-colors">
                {cat.name}
              </h3>
              <p className="text-xs text-sage mt-1">{cat.count}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
