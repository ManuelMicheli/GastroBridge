"use client";

import Link from "next/link";
import Image from "next/image";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Star, Pencil, Trash2 } from "lucide-react";
import {
  setDefaultTemplate,
  deleteTemplate,
} from "@/lib/supplier/ddt/templates-actions";
import type { Database } from "@/types/database";

type TemplateRow = Database["public"]["Tables"]["ddt_templates"]["Row"];

type Props = {
  supplierId: string;
  initialTemplates: TemplateRow[];
};

export function TemplatesListClient({ supplierId, initialTemplates }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onSetDefault = (t: TemplateRow) => {
    startTransition(async () => {
      const res = await setDefaultTemplate({
        supplier_id: supplierId,
        template_id: t.id,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`"${t.name}" impostato come predefinito`);
      router.refresh();
    });
  };

  const onDelete = (t: TemplateRow) => {
    if (!confirm(`Eliminare il template "${t.name}"?`)) return;
    startTransition(async () => {
      const res = await deleteTemplate(t.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Template eliminato");
      router.refresh();
    });
  };

  if (initialTemplates.length === 0) {
    return (
      <Card className="text-center py-16">
        <FileText className="h-12 w-12 text-sage-muted mx-auto mb-4" />
        <p className="text-sage mb-4">Nessun template ancora.</p>
        <p className="text-xs text-sage-muted">
          Crea il primo template per personalizzare i tuoi DDT.
        </p>
      </Card>
    );
  }

  return (
    <div
      className="cq-section grid gap-4"
      style={{
        gridTemplateColumns:
          "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
      }}
    >
      {initialTemplates.map((t) => (
        <Card key={t.id} className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-charcoal truncate">{t.name}</h3>
                {t.is_default && (
                  <Badge variant="success" className="text-[10px]">
                    <Star className="h-3 w-3 mr-1" /> Predefinito
                  </Badge>
                )}
              </div>
              <p className="text-xs text-sage mt-1">
                Creato il{" "}
                {new Date(t.created_at).toLocaleDateString("it-IT")}
              </p>
            </div>
            <div
              className="h-8 w-8 rounded-lg border border-sage-muted"
              style={{ backgroundColor: t.primary_color ?? "#0EA5E9" }}
              title={t.primary_color ?? "#0EA5E9"}
              aria-label="Colore primario"
            />
          </div>

          <div className="h-24 bg-sage-muted/20 rounded-lg flex items-center justify-center overflow-hidden">
            {t.logo_url ? (
              <Image
                src={t.logo_url}
                alt={`Logo ${t.name}`}
                width={120}
                height={80}
                className="object-contain max-h-full"
                unoptimized
              />
            ) : (
              <span className="text-xs text-sage">Nessun logo</span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap mt-auto">
            <Link
              href={`/supplier/ddt/templates/${t.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest hover:underline"
            >
              <Pencil className="h-3.5 w-3.5" /> Modifica
            </Link>
            {!t.is_default && (
              <button
                onClick={() => onSetDefault(t)}
                disabled={pending}
                className="inline-flex items-center gap-1.5 text-sm text-sage hover:text-forest disabled:opacity-40"
              >
                <Star className="h-3.5 w-3.5" /> Imposta predefinito
              </button>
            )}
            {!t.is_default && (
              <button
                onClick={() => onDelete(t)}
                disabled={pending}
                className="inline-flex items-center gap-1.5 text-sm text-sage hover:text-red-600 disabled:opacity-40 ml-auto"
                aria-label="Elimina template"
                title="Elimina template"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
