import { z } from "zod/v4";

// ==========================================
// Auth Schemas
// ==========================================

export const loginSchema = z.object({
  email: z.email("Inserisci un'email valida"),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri"),
});

export const signupSchema = z.object({
  email: z.email("Inserisci un'email valida"),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri"),
  companyName: z.string().min(2, "Inserisci il nome dell'azienda"),
  role: z.enum(["restaurant", "supplier"]),
  vatNumber: z
    .string()
    .optional()
    .refine(
      (val) => !val || isValidPartitaIVA(val),
      "Partita IVA non valida"
    ),
});

export const magicLinkSchema = z.object({
  email: z.email("Inserisci un'email valida"),
});

// ==========================================
// Product Schemas
// ==========================================

export const productSchema = z.object({
  name: z.string().min(2, "Nome prodotto obbligatorio"),
  description: z.string().optional(),
  brand: z.string().optional(),
  sku: z.string().optional(),
  categoryId: z.string().uuid(),
  subcategoryId: z.string().uuid().optional(),
  unit: z.enum([
    "kg",
    "g",
    "lt",
    "ml",
    "pz",
    "cartone",
    "bottiglia",
    "latta",
    "confezione",
  ]),
  price: z.number().positive("Il prezzo deve essere positivo"),
  minQuantity: z.number().positive().default(1),
  maxQuantity: z.number().positive().optional(),
  origin: z.string().optional(),
  certifications: z.array(z.string()).optional(),
});

// ==========================================
// Order Schemas
// ==========================================

export const orderNotesSchema = z.object({
  notes: z.string().max(500).optional(),
});

// ==========================================
// Review Schemas
// ==========================================

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  qualityRating: z.number().int().min(1).max(5).optional(),
  deliveryRating: z.number().int().min(1).max(5).optional(),
  serviceRating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(1000).optional(),
});

// ==========================================
// Profile Schemas
// ==========================================

export const profileSchema = z.object({
  companyName: z.string().min(2, "Nome azienda obbligatorio"),
  vatNumber: z
    .string()
    .optional()
    .refine(
      (val) => !val || isValidPartitaIVA(val),
      "Partita IVA non valida"
    ),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().max(2).optional(),
  zipCode: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^\d{5}$/.test(val),
      "CAP non valido"
    ),
});

// ==========================================
// P.IVA Validation (Italian VAT number)
// ==========================================

export function isValidPartitaIVA(piva: string): boolean {
  // Remove spaces and ensure 11 digits
  const cleaned = piva.replace(/\s/g, "");
  if (!/^\d{11}$/.test(cleaned)) return false;

  // Luhn-like check for Italian P.IVA
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    const digit = parseInt(cleaned[i]!, 10);
    if (i % 2 === 0) {
      sum += digit;
    } else {
      const doubled = digit * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    }
  }
  return sum % 10 === 0;
}

// ==========================================
// Type exports
// ==========================================

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
