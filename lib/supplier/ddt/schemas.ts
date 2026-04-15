import { z } from "zod/v4";

const HEX_COLOR_RE = /^#([0-9A-Fa-f]{6})$/;

export const TemplateIdSchema = z.object({
  template_id: z.string().uuid(),
});

export const TemplateSupplierIdSchema = z.object({
  supplier_id: z.string().uuid(),
});

export const CreateTemplateSchema = z.object({
  supplier_id: z.string().uuid(),
  name: z.string().trim().min(1, "Nome obbligatorio").max(120),
  logo_url: z.string().url().nullable().optional(),
  primary_color: z
    .string()
    .regex(HEX_COLOR_RE, "Colore non valido (usa #RRGGBB)")
    .optional()
    .default("#0EA5E9"),
  header_html: z.string().max(5000).nullable().optional(),
  footer_html: z.string().max(5000).nullable().optional(),
  conditions_text: z.string().max(5000).nullable().optional(),
  is_default: z.boolean().optional().default(false),
});

export const UpdateTemplateSchema = z.object({
  template_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  logo_url: z.string().url().nullable().optional(),
  primary_color: z
    .string()
    .regex(HEX_COLOR_RE, "Colore non valido (usa #RRGGBB)")
    .optional(),
  header_html: z.string().max(5000).nullable().optional(),
  footer_html: z.string().max(5000).nullable().optional(),
  conditions_text: z.string().max(5000).nullable().optional(),
  is_default: z.boolean().optional(),
});

export const SetDefaultTemplateSchema = z.object({
  supplier_id: z.string().uuid(),
  template_id: z.string().uuid(),
});

export const UploadLogoSchema = z.object({
  supplier_id: z.string().uuid(),
  file_name: z.string().min(1).max(200),
  mime_type: z.enum(["image/png", "image/jpeg", "image/jpg", "image/webp"]),
  bytes_base64: z.string().min(1),
});

export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof UpdateTemplateSchema>;
export type SetDefaultTemplateInput = z.infer<typeof SetDefaultTemplateSchema>;
export type UploadLogoInput = z.infer<typeof UploadLogoSchema>;
