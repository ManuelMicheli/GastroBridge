/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/supplier/context";
import type { Database } from "@/types/database";
import {
  CreateTemplateSchema,
  UpdateTemplateSchema,
  SetDefaultTemplateSchema,
  TemplateIdSchema,
  UploadLogoSchema,
  type CreateTemplateInput,
  type UpdateTemplateInput,
  type SetDefaultTemplateInput,
  type UploadLogoInput,
} from "./schemas";

type TemplateRow = Database["public"]["Tables"]["ddt_templates"]["Row"];

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

const LOGO_BUCKET = "ddt-assets";
const LOGO_MAX_BYTES = 500 * 1024; // 500 KB

export async function listTemplates(
  supplierId: string,
): Promise<Result<TemplateRow[]>> {
  try {
    await requirePermission(supplierId, "ddt.manage_templates");
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("ddt_templates")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as TemplateRow[] };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore caricamento template",
    };
  }
}

export async function getTemplate(
  templateId: string,
): Promise<Result<TemplateRow>> {
  try {
    const parsed = TemplateIdSchema.safeParse({ template_id: templateId });
    if (!parsed.success) return { ok: false, error: "ID template non valido" };

    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("ddt_templates")
      .select("*")
      .eq("id", templateId)
      .maybeSingle();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Template non trovato" };
    }
    const row = data as TemplateRow;
    await requirePermission(row.supplier_id, "ddt.manage_templates");
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore caricamento template",
    };
  }
}

export async function createTemplate(
  input: CreateTemplateInput,
): Promise<Result<TemplateRow>> {
  try {
    const parsed = CreateTemplateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati non validi",
      };
    }
    const v = parsed.data;

    await requirePermission(v.supplier_id, "ddt.manage_templates");

    const supabase = await createClient();

    // Se è richiesto come default, sposta prima tutti gli altri.
    if (v.is_default) {
      await (supabase as any)
        .from("ddt_templates")
        .update({ is_default: false })
        .eq("supplier_id", v.supplier_id)
        .eq("is_default", true);
    }

    const { data, error } = await (supabase as any)
      .from("ddt_templates")
      .insert({
        supplier_id: v.supplier_id,
        name: v.name,
        logo_url: v.logo_url ?? null,
        primary_color: v.primary_color ?? "#0EA5E9",
        header_html: v.header_html ?? null,
        footer_html: v.footer_html ?? null,
        conditions_text: v.conditions_text ?? null,
        is_default: v.is_default ?? false,
      })
      .select("*")
      .single();
    if (error || !data) {
      return {
        ok: false,
        error: error?.message ?? "Errore creazione template",
      };
    }

    revalidatePath("/supplier/ddt/templates");
    return { ok: true, data: data as TemplateRow };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore creazione template",
    };
  }
}

async function loadTemplateRow(
  templateId: string,
): Promise<TemplateRow | null> {
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from("ddt_templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle();
  return (data as TemplateRow | null) ?? null;
}

export async function updateTemplate(
  input: UpdateTemplateInput,
): Promise<Result<TemplateRow>> {
  try {
    const parsed = UpdateTemplateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati non validi",
      };
    }
    const { template_id, ...rest } = parsed.data;

    const current = await loadTemplateRow(template_id);
    if (!current) return { ok: false, error: "Template non trovato" };
    await requirePermission(current.supplier_id, "ddt.manage_templates");

    const supabase = await createClient();

    if (rest.is_default === true && !current.is_default) {
      await (supabase as any)
        .from("ddt_templates")
        .update({ is_default: false })
        .eq("supplier_id", current.supplier_id)
        .eq("is_default", true);
    }

    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(rest)) {
      if (typeof val !== "undefined") patch[k] = val;
    }

    const { data, error } = await (supabase as any)
      .from("ddt_templates")
      .update(patch)
      .eq("id", template_id)
      .select("*")
      .single();
    if (error || !data) {
      return {
        ok: false,
        error: error?.message ?? "Errore aggiornamento template",
      };
    }

    revalidatePath("/supplier/ddt/templates");
    revalidatePath(`/supplier/ddt/templates/${template_id}`);
    return { ok: true, data: data as TemplateRow };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore aggiornamento template",
    };
  }
}

export async function setDefaultTemplate(
  input: SetDefaultTemplateInput,
): Promise<Result<TemplateRow>> {
  try {
    const parsed = SetDefaultTemplateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Dati non validi" };
    }
    const { supplier_id, template_id } = parsed.data;

    await requirePermission(supplier_id, "ddt.manage_templates");

    const supabase = await createClient();

    // Azzera default su tutti gli altri template dello stesso supplier.
    await (supabase as any)
      .from("ddt_templates")
      .update({ is_default: false })
      .eq("supplier_id", supplier_id)
      .neq("id", template_id);

    const { data, error } = await (supabase as any)
      .from("ddt_templates")
      .update({ is_default: true })
      .eq("id", template_id)
      .eq("supplier_id", supplier_id)
      .select("*")
      .single();
    if (error || !data) {
      return {
        ok: false,
        error: error?.message ?? "Errore impostazione predefinito",
      };
    }

    revalidatePath("/supplier/ddt/templates");
    return { ok: true, data: data as TemplateRow };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Errore impostazione predefinito",
    };
  }
}

export async function deleteTemplate(
  templateId: string,
): Promise<Result<void>> {
  try {
    const parsed = TemplateIdSchema.safeParse({ template_id: templateId });
    if (!parsed.success) return { ok: false, error: "ID template non valido" };

    const current = await loadTemplateRow(templateId);
    if (!current) return { ok: false, error: "Template non trovato" };
    await requirePermission(current.supplier_id, "ddt.manage_templates");

    if (current.is_default) {
      return {
        ok: false,
        error:
          "Non puoi eliminare il template predefinito. Imposta prima un altro come predefinito.",
      };
    }

    const supabase = await createClient();
    const { error } = await (supabase as any)
      .from("ddt_templates")
      .delete()
      .eq("id", templateId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/supplier/ddt/templates");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore eliminazione template",
    };
  }
}

/**
 * Carica un logo su `ddt-assets`. Riceve bytes base64 dal client (max 500 KB) e
 * restituisce la public URL da salvare su `ddt_templates.logo_url`.
 */
export async function uploadTemplateLogo(
  input: UploadLogoInput,
): Promise<Result<{ logo_url: string; path: string }>> {
  try {
    const parsed = UploadLogoSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati logo non validi",
      };
    }
    const v = parsed.data;

    await requirePermission(v.supplier_id, "ddt.manage_templates");

    const buffer = Buffer.from(v.bytes_base64, "base64");
    if (buffer.byteLength === 0) {
      return { ok: false, error: "File vuoto" };
    }
    if (buffer.byteLength > LOGO_MAX_BYTES) {
      return { ok: false, error: "Logo troppo grande (max 500 KB)" };
    }

    const admin = createAdminClient();
    const ext = v.mime_type === "image/png"
      ? "png"
      : v.mime_type === "image/webp"
        ? "webp"
        : "jpg";
    const path = `${v.supplier_id}/logo-${Date.now()}.${ext}`;

    const { error: uploadErr } = await admin.storage
      .from(LOGO_BUCKET)
      .upload(path, buffer, {
        contentType: v.mime_type,
        upsert: true,
        cacheControl: "3600",
      });
    if (uploadErr) return { ok: false, error: uploadErr.message };

    const { data: pub } = admin.storage.from(LOGO_BUCKET).getPublicUrl(path);

    return { ok: true, data: { logo_url: pub.publicUrl, path } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore upload logo",
    };
  }
}
