import { z } from "zod";

/**
 * Data URL PNG proveniente dal canvas `signature_pad`.
 * Formato atteso: `data:image/png;base64,<payload>`.
 */
export const DataUrlPngSchema = z
  .string()
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, "Formato firma non valido")
  .max(2 * 1024 * 1024, "Firma troppo grande (max ~2MB)");

/** POD già caricato: restituiamo l'URL storage (path relativo al bucket). */
export const PodUrlSchema = z
  .string()
  .min(1)
  .max(512);

export const StartTransitSchema = z.object({
  delivery_id: z.string().uuid(),
});

export const MarkDeliveredSchema = z.object({
  delivery_id: z.string().uuid(),
  signature_data_url: DataUrlPngSchema,
  pod_photo_url: PodUrlSchema.optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const MarkFailedSchema = z.object({
  delivery_id: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(3, "Motivo troppo breve (min 3 caratteri)")
    .max(500, "Motivo troppo lungo (max 500 caratteri)"),
});

export const UploadPodSchema = z.object({
  delivery_id: z.string().uuid(),
  bytes_base64: z.string().min(1),
  mime_type: z.enum(["image/png", "image/jpeg", "image/webp"]),
});

export type StartTransitInput = z.infer<typeof StartTransitSchema>;
export type MarkDeliveredInput = z.infer<typeof MarkDeliveredSchema>;
export type MarkFailedInput = z.infer<typeof MarkFailedSchema>;
export type UploadPodInput = z.infer<typeof UploadPodSchema>;
