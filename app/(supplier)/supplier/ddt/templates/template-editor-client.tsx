"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Upload, Trash2, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createTemplate,
  updateTemplate,
  uploadTemplateLogo,
} from "@/lib/supplier/ddt/templates-actions";
import type { Database } from "@/types/database";

type TemplateRow = Database["public"]["Tables"]["ddt_templates"]["Row"];

type Props =
  | {
      supplierId: string;
      supplierName: string;
      mode: "create";
      initial?: never;
    }
  | {
      supplierId: string;
      supplierName: string;
      mode: "edit";
      initial: TemplateRow;
    };

const MAX_BYTES = 500 * 1024;
const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
] as const;

type MimeType = (typeof ACCEPTED_TYPES)[number];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Sanificatore HTML minimale lato client (preview). Il PDF server-side
 * dovrà effettuare il suo stesso passaggio di sanitizzazione prima del render.
 */
function sanitizeHtml(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/on[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/on[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

export function TemplateEditorClient(props: Props) {
  const { supplierId, supplierName, mode } = props;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialValues = useMemo(() => {
    if (mode === "edit") {
      return {
        name: props.initial.name,
        primary_color: props.initial.primary_color ?? "#0EA5E9",
        header_html: props.initial.header_html ?? "",
        footer_html: props.initial.footer_html ?? "",
        conditions_text: props.initial.conditions_text ?? "",
        is_default: props.initial.is_default,
        logo_url: props.initial.logo_url,
      };
    }
    return {
      name: "",
      primary_color: "#0EA5E9",
      header_html: "",
      footer_html: "",
      conditions_text: "",
      is_default: false,
      logo_url: null as string | null,
    };
  }, [mode, props]);

  const [name, setName] = useState(initialValues.name);
  const [primaryColor, setPrimaryColor] = useState(initialValues.primary_color);
  const [headerHtml, setHeaderHtml] = useState(initialValues.header_html);
  const [footerHtml, setFooterHtml] = useState(initialValues.footer_html);
  const [conditions, setConditions] = useState(initialValues.conditions_text);
  const [isDefault, setIsDefault] = useState(initialValues.is_default);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialValues.logo_url);
  const [uploading, setUploading] = useState(false);

  const onPickLogo = () => fileInputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type as MimeType)) {
      toast.error("Formato non supportato. Usa PNG, JPG o WEBP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Logo troppo grande (max 500 KB).");
      return;
    }

    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await uploadTemplateLogo({
        supplier_id: supplierId,
        file_name: file.name,
        mime_type: file.type as MimeType,
        bytes_base64: base64,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setLogoUrl(res.data.logo_url);
      toast.success("Logo caricato");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore upload");
    } finally {
      setUploading(false);
    }
  };

  const onRemoveLogo = () => setLogoUrl(null);

  const onSave = () => {
    if (!name.trim()) {
      toast.error("Il nome è obbligatorio");
      return;
    }
    startTransition(async () => {
      if (mode === "create") {
        const res = await createTemplate({
          supplier_id: supplierId,
          name: name.trim(),
          logo_url: logoUrl,
          primary_color: primaryColor,
          header_html: headerHtml || null,
          footer_html: footerHtml || null,
          conditions_text: conditions || null,
          is_default: isDefault,
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Template creato");
        router.push(`/supplier/ddt/templates/${res.data.id}`);
        router.refresh();
      } else {
        const res = await updateTemplate({
          template_id: props.initial.id,
          name: name.trim(),
          logo_url: logoUrl,
          primary_color: primaryColor,
          header_html: headerHtml || null,
          footer_html: footerHtml || null,
          conditions_text: conditions || null,
          is_default: isDefault,
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Template aggiornato");
        router.refresh();
      }
    });
  };

  const safeHeader = sanitizeHtml(headerHtml);
  const safeFooter = sanitizeHtml(footerHtml);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/supplier/ddt/templates"
            className="p-2 rounded-lg hover:bg-sage-muted/40 text-sage"
            aria-label="Torna alla lista"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-charcoal">
              {mode === "create" ? "Nuovo template DDT" : "Modifica template"}
            </h1>
            <p className="text-sm text-sage mt-1">
              Configura logo, colore e blocchi HTML mostrati nel PDF.
            </p>
          </div>
        </div>
        <Button
          onClick={onSave}
          isLoading={pending}
          disabled={pending || uploading}
          size="sm"
        >
          {mode === "create" ? "Crea template" : "Salva modifiche"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COLONNA SINISTRA — FORM */}
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4">
            <Input
              label="Nome template"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Es. Salumeria Rossi — standard"
              maxLength={120}
            />

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-charcoal">
                Logo (max 500 KB, PNG/JPG/WEBP)
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="h-20 w-28 rounded-lg border-2 border-dashed border-sage-muted flex items-center justify-center bg-sage-muted/10 overflow-hidden">
                  {logoUrl ? (
                    <Image
                      src={logoUrl}
                      alt="Logo"
                      width={112}
                      height={80}
                      className="object-contain max-h-full"
                      unoptimized
                    />
                  ) : (
                    <span className="text-[10px] text-sage">Nessun logo</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={onPickLogo}
                    isLoading={uploading}
                    disabled={uploading || pending}
                  >
                    <Upload className="h-4 w-4" />
                    {logoUrl ? "Sostituisci" : "Carica"}
                  </Button>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={onRemoveLogo}
                      disabled={pending || uploading}
                      className="inline-flex items-center gap-1.5 text-sm text-sage hover:text-red-600 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Rimuovi
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  onChange={onFileChange}
                  className="hidden"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="primary-color"
                className="text-sm font-semibold text-charcoal"
              >
                Colore primario
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="primary-color"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value.toUpperCase())}
                  className="h-10 w-16 rounded-lg border-2 border-sage-muted cursor-pointer"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    if (/^#?[0-9A-Fa-f]{0,6}$/.test(v)) {
                      setPrimaryColor(
                        v.startsWith("#") ? v.toUpperCase() : `#${v.toUpperCase()}`,
                      );
                    }
                  }}
                  placeholder="#0EA5E9"
                  maxLength={7}
                  className="w-32 border-2 border-sage-muted rounded-xl py-2 px-3 font-mono text-sm text-charcoal focus:border-forest focus:outline-none"
                />
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-charcoal">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 rounded border-sage-muted accent-forest"
              />
              Imposta come predefinito
            </label>
          </Card>

          <Card className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="header-html"
                className="text-sm font-semibold text-charcoal"
              >
                Intestazione (HTML consentito)
              </label>
              <textarea
                id="header-html"
                value={headerHtml}
                onChange={(e) => setHeaderHtml(e.target.value)}
                placeholder="<strong>Salumeria Rossi S.r.l.</strong><br/>Via Roma 12, Milano"
                rows={4}
                maxLength={5000}
                className="w-full border-2 border-sage-muted rounded-xl py-3 px-4 font-mono text-sm text-charcoal placeholder:text-sage focus:border-forest focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="footer-html"
                className="text-sm font-semibold text-charcoal"
              >
                Piè di pagina (HTML consentito)
              </label>
              <textarea
                id="footer-html"
                value={footerHtml}
                onChange={(e) => setFooterHtml(e.target.value)}
                placeholder="Merce viaggia per conto e rischio del destinatario."
                rows={3}
                maxLength={5000}
                className="w-full border-2 border-sage-muted rounded-xl py-3 px-4 font-mono text-sm text-charcoal placeholder:text-sage focus:border-forest focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="conditions"
                className="text-sm font-semibold text-charcoal"
              >
                Condizioni di trasporto / vendita
              </label>
              <textarea
                id="conditions"
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                placeholder="Reclami entro 8 giorni. Foro competente Milano."
                rows={4}
                maxLength={5000}
                className="w-full border-2 border-sage-muted rounded-xl py-3 px-4 text-sm text-charcoal placeholder:text-sage focus:border-forest focus:outline-none"
              />
              <p className="text-xs text-sage">
                Testo semplice. Verrà stampato in fondo al DDT.
              </p>
            </div>
          </Card>
        </div>

        {/* COLONNA DESTRA — PREVIEW */}
        <div className="lg:sticky lg:top-4 self-start">
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-sage-muted/50 bg-sage-muted/20">
              <Eye className="h-4 w-4 text-sage" />
              <span className="text-xs font-semibold text-sage uppercase tracking-wider">
                Anteprima
              </span>
            </div>
            <div
              className="bg-white p-6 min-h-[560px] text-[13px] leading-relaxed text-charcoal"
              style={{
                borderTop: `4px solid ${primaryColor}`,
              }}
            >
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex-1 min-w-0">
                  {logoUrl ? (
                    <Image
                      src={logoUrl}
                      alt="Logo"
                      width={140}
                      height={60}
                      className="object-contain max-h-16"
                      unoptimized
                    />
                  ) : (
                    <div className="text-xs text-sage italic">(logo)</div>
                  )}
                  {safeHeader ? (
                    <div
                      className="mt-3 text-xs text-charcoal"
                      dangerouslySetInnerHTML={{ __html: safeHeader }}
                    />
                  ) : (
                    <div className="mt-3 text-xs text-sage italic">
                      {supplierName}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div
                    className="inline-block px-3 py-1 rounded text-xs font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: primaryColor,
                      color: "#fff",
                    }}
                  >
                    DDT
                  </div>
                  <div className="text-[11px] text-sage mt-2">
                    N. 2026/00001 · 15/04/2026
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
                <div>
                  <div className="font-semibold uppercase tracking-wider text-[10px] text-sage mb-1">
                    Mittente
                  </div>
                  <div>{supplierName}</div>
                </div>
                <div>
                  <div className="font-semibold uppercase tracking-wider text-[10px] text-sage mb-1">
                    Destinatario
                  </div>
                  <div>Ristorante Demo</div>
                  <div className="text-sage">Via Esempio 1, Roma</div>
                </div>
              </div>

              <table className="w-full text-xs border-collapse mb-6">
                <thead>
                  <tr
                    style={{
                      backgroundColor: `${primaryColor}20`,
                      color: primaryColor,
                    }}
                  >
                    <th className="text-left p-2 font-semibold">Descrizione</th>
                    <th className="text-right p-2 font-semibold w-16">Q.tà</th>
                    <th className="text-right p-2 font-semibold w-20">UM</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-sage-muted/40">
                    <td className="p-2">Prosciutto crudo 24 mesi</td>
                    <td className="p-2 text-right">2</td>
                    <td className="p-2 text-right">kg</td>
                  </tr>
                  <tr className="border-b border-sage-muted/40">
                    <td className="p-2">Mozzarella di bufala DOP</td>
                    <td className="p-2 text-right">6</td>
                    <td className="p-2 text-right">pz</td>
                  </tr>
                </tbody>
              </table>

              {conditions && (
                <div className="mb-4 p-3 rounded bg-sage-muted/10 text-[11px] text-charcoal whitespace-pre-wrap">
                  <div className="font-semibold uppercase tracking-wider text-[10px] text-sage mb-1">
                    Condizioni
                  </div>
                  {conditions}
                </div>
              )}

              {safeFooter ? (
                <div
                  className="text-[11px] text-sage border-t border-sage-muted/40 pt-3"
                  dangerouslySetInnerHTML={{ __html: safeFooter }}
                />
              ) : (
                <div className="text-[11px] text-sage italic border-t border-sage-muted/40 pt-3">
                  (piè di pagina)
                </div>
              )}
            </div>
          </Card>
          <p className="text-xs text-sage mt-2">
            Anteprima approssimativa. Il PDF finale può differire in impaginazione.
          </p>
        </div>
      </div>
    </div>
  );
}
