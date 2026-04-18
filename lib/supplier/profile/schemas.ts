import { z } from "zod";

const httpUrl = z
  .string()
  .trim()
  .url("URL non valido")
  .refine((v) => v.startsWith("http://") || v.startsWith("https://"), "URL non valido");

const optionalUrl = z.union([z.literal(""), httpUrl]).transform((v) => (v ? v : null));

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional();

export const SupplierProfileSchema = z.object({
  company_name: z.string().trim().min(2, "Nome ditta troppo corto").max(120),
  description: z
    .string()
    .trim()
    .max(800, "Massimo 800 caratteri")
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional(),
  logo_url: optionalUrl.nullable().optional(),
  cover_url: optionalUrl.nullable().optional(),
  website: optionalUrl.nullable().optional(),
  email: z
    .union([z.literal(""), z.string().email("Email non valida")])
    .transform((v) => (v ? v : null))
    .nullable()
    .optional(),
  phone: optionalString(40),
  address: optionalString(200),
  city: optionalString(80),
  province: z
    .string()
    .trim()
    .max(4)
    .transform((v) => (v.length === 0 ? null : v.toUpperCase()))
    .nullable()
    .optional(),
  zip_code: optionalString(10),
  min_order_amount: z
    .number({ error: "Importo non valido" })
    .min(0, "Non negativo")
    .max(100000, "Importo eccessivo")
    .nullable()
    .optional(),
  payment_terms_days: z
    .number({ error: "Giorni non validi" })
    .int()
    .min(0)
    .max(365)
    .optional(),
  cold_chain_available: z.boolean().optional(),
  certifications: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

export type SupplierProfileInput = z.infer<typeof SupplierProfileSchema>;
