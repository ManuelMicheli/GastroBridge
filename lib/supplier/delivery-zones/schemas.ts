import { z } from "zod";

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DeliverySlotSchema = z.object({
  from: z.string().regex(HH_MM, "Orario 'da' non valido (HH:MM)"),
  to: z.string().regex(HH_MM, "Orario 'a' non valido (HH:MM)"),
  label: z.string().trim().max(40).optional().default(""),
  capacity: z
    .number()
    .int()
    .min(1, "Capacità minima 1")
    .max(999, "Capacità massima 999"),
});

export type DeliverySlotInput = z.infer<typeof DeliverySlotSchema>;

export const DeliveryZoneSchema = z.object({
  id: z.string().uuid().optional(),
  zone_name: z
    .string()
    .trim()
    .min(1, "Il nome della zona è obbligatorio")
    .max(120),
  provinces: z
    .array(z.string().trim().length(2, "Sigla provincia (2 lettere)"))
    .min(1, "Almeno una provincia"),
  zip_codes: z
    .array(z.string().regex(/^\d{5}$/, "CAP non valido (5 cifre)"))
    .optional()
    .default([]),
  delivery_fee: z
    .number()
    .min(0, "Costo non può essere negativo")
    .max(9999),
  free_delivery_above: z
    .number()
    .min(0)
    .max(99999)
    .nullable()
    .optional(),
  delivery_days: z
    .array(z.number().int().min(0).max(6))
    .min(1, "Seleziona almeno un giorno di consegna"),
  cutoff_time: z.string().regex(HH_MM, "Orario cutoff non valido (HH:MM)"),
  delivery_slots: z
    .array(DeliverySlotSchema)
    .min(1, "Aggiungi almeno uno slot orario"),
  warehouse_id: z.string().uuid("Seleziona una sede di partenza"),
});

export type DeliveryZoneInput = z.infer<typeof DeliveryZoneSchema>;
