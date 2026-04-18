"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Award,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Phone,
  Save,
  Shield,
  Snowflake,
  Star,
  Upload,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { updateSupplierProfile } from "@/lib/supplier/profile/actions";
import type { EditableSupplierProfile } from "@/lib/supplier/profile/actions";
import type { SupplierProfileInput } from "@/lib/supplier/profile/schemas";

const CERT_OPTIONS = [
  "BIO",
  "DOP",
  "IGP",
  "STG",
  "DOC",
  "DOCG",
  "IGT",
  "HALAL",
  "KOSHER",
  "MSC",
  "ASC",
  "FAIRTRADE",
];

const BUCKET = "supplier-branding";
const DESCRIPTION_MAX = 800;

type Props = {
  supplierId: string;
  initialProfile: EditableSupplierProfile;
};

type FormState = {
  company_name: string;
  description: string;
  logo_url: string | null;
  cover_url: string | null;
  website: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  zip_code: string;
  min_order_amount: string;
  payment_terms_days: string;
  cold_chain_available: boolean;
  certifications: string[];
};

function toForm(p: EditableSupplierProfile): FormState {
  return {
    company_name: p.company_name ?? "",
    description: p.description ?? "",
    logo_url: p.logo_url,
    cover_url: p.cover_url,
    website: p.website ?? "",
    email: p.email ?? "",
    phone: p.phone ?? "",
    address: p.address ?? "",
    city: p.city ?? "",
    province: p.province ?? "",
    zip_code: p.zip_code ?? "",
    min_order_amount:
      p.min_order_amount === null ? "" : String(p.min_order_amount),
    payment_terms_days: String(p.payment_terms_days ?? 30),
    cold_chain_available: !!p.cold_chain_available,
    certifications: p.certifications ?? [],
  };
}

export function ProfileClient({ supplierId, initialProfile }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toForm(initialProfile));
  const [pending, startTransition] = useTransition();
  const [logoUploading, setLogoUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const completeness = useMemo(() => {
    const checks: boolean[] = [
      form.company_name.trim().length >= 2,
      form.description.trim().length >= 60,
      !!form.logo_url,
      !!form.cover_url,
      form.website.trim().length > 0,
      form.phone.trim().length > 0 || form.email.trim().length > 0,
      form.address.trim().length > 0 && form.city.trim().length > 0,
      form.certifications.length > 0,
    ];
    const done = checks.filter(Boolean).length;
    return { done, total: checks.length, pct: Math.round((done / checks.length) * 100) };
  }, [form]);

  async function uploadImage(
    file: File,
    kind: "logo" | "cover",
  ): Promise<string | null> {
    const supabase = createBrowserClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${supplierId}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type || undefined,
      });
    if (error) {
      toast.error(`Upload fallito: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl ?? null;
  }

  function handleFile(kind: "logo" | "cover") {
    return async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File troppo grande (max 5MB)");
        return;
      }
      if (!file.type.startsWith("image/")) {
        toast.error("Solo immagini");
        return;
      }
      kind === "logo" ? setLogoUploading(true) : setCoverUploading(true);
      const url = await uploadImage(file, kind);
      kind === "logo" ? setLogoUploading(false) : setCoverUploading(false);
      if (url) {
        set(kind === "logo" ? "logo_url" : "cover_url", url);
        toast.success(`${kind === "logo" ? "Logo" : "Copertina"} caricata`);
      }
      e.target.value = "";
    };
  }

  function toggleCert(c: string) {
    set(
      "certifications",
      form.certifications.includes(c)
        ? form.certifications.filter((x) => x !== c)
        : [...form.certifications, c],
    );
  }

  function submit() {
    const payload: SupplierProfileInput = {
      company_name: form.company_name.trim(),
      description: form.description,
      logo_url: form.logo_url ?? "",
      cover_url: form.cover_url ?? "",
      website: form.website,
      email: form.email,
      phone: form.phone,
      address: form.address,
      city: form.city,
      province: form.province,
      zip_code: form.zip_code,
      min_order_amount:
        form.min_order_amount.trim() === ""
          ? null
          : Number(form.min_order_amount),
      payment_terms_days:
        form.payment_terms_days.trim() === ""
          ? 30
          : Number(form.payment_terms_days),
      cold_chain_available: form.cold_chain_available,
      certifications: form.certifications,
    };

    startTransition(async () => {
      const res = await updateSupplierProfile(supplierId, payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Profilo aggiornato");
      router.refresh();
    });
  }

  const descCount = form.description.length;
  const descOver = descCount > DESCRIPTION_MAX;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,420px)] gap-6">
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-charcoal">Profilo pubblico</h1>
          <p className="text-sm text-sage mt-1">
            Cura come ti vedono i ristoratori. Logo, copertina, descrizione e
            certificazioni aumentano la fiducia e gli ordini.
          </p>

          <Card className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-charcoal">
                Completezza profilo
              </span>
              <span className="text-sm font-mono text-sage">
                {completeness.done}/{completeness.total} · {completeness.pct}%
              </span>
            </div>
            <div className="h-2 bg-sage-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-green transition-all"
                style={{ width: `${completeness.pct}%` }}
              />
            </div>
            {completeness.pct < 100 && (
              <p className="text-xs text-sage mt-2">
                Profili al 100% ricevono in media più richieste di contatto.
              </p>
            )}
          </Card>
        </header>

        {/* Aspetto */}
        <Card>
          <h2 className="text-lg font-semibold text-charcoal mb-1">Aspetto</h2>
          <p className="text-sm text-sage mb-4">
            Logo quadrato (consigliato 512×512) e copertina larga (1600×400).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-5 items-start">
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-sage">
                Logo
              </span>
              <div className="relative w-[120px] h-[120px] rounded-2xl bg-sage-muted/20 border border-border-subtle overflow-hidden flex items-center justify-center">
                {form.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.logo_url}
                    alt="Logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-8 w-8 text-sage" />
                )}
                {logoUploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="text-xs px-2 py-1 rounded-md hover:bg-sage-muted/20 text-charcoal flex items-center gap-1"
                  disabled={logoUploading}
                >
                  <Upload className="h-3 w-3" /> Carica
                </button>
                {form.logo_url && (
                  <button
                    type="button"
                    onClick={() => set("logo_url", null)}
                    className="text-xs px-2 py-1 rounded-md hover:bg-red-50 text-red-600 flex items-center gap-1"
                  >
                    <X className="h-3 w-3" /> Rimuovi
                  </button>
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile("logo")}
              />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-sage">
                Copertina
              </span>
              <div className="relative w-full aspect-[4/1] rounded-2xl bg-sage-muted/20 border border-border-subtle overflow-hidden flex items-center justify-center">
                {form.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.cover_url}
                    alt="Copertina"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-10 w-10 text-sage" />
                )}
                {coverUploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="text-xs px-2 py-1 rounded-md hover:bg-sage-muted/20 text-charcoal flex items-center gap-1"
                  disabled={coverUploading}
                >
                  <Upload className="h-3 w-3" /> Carica
                </button>
                {form.cover_url && (
                  <button
                    type="button"
                    onClick={() => set("cover_url", null)}
                    className="text-xs px-2 py-1 rounded-md hover:bg-red-50 text-red-600 flex items-center gap-1"
                  >
                    <X className="h-3 w-3" /> Rimuovi
                  </button>
                )}
              </div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile("cover")}
              />
            </div>
          </div>
        </Card>

        {/* Identità */}
        <Card>
          <h2 className="text-lg font-semibold text-charcoal mb-1">Identità</h2>
          <p className="text-sm text-sage mb-4">
            Nome ditta, descrizione e link che mostriamo in cima al tuo profilo.
          </p>

          <div className="space-y-4">
            <Field label="Nome ditta *">
              <input
                type="text"
                value={form.company_name}
                maxLength={120}
                onChange={(e) => set("company_name", e.target.value)}
                className="w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
                placeholder="Es. Caseificio Manuel s.r.l."
              />
            </Field>

            <div>
              <label className="block">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-text-secondary">
                    Descrizione
                  </span>
                  <span
                    className={`text-xs font-mono ${descOver ? "text-red-600" : "text-sage"}`}
                  >
                    {descCount}/{DESCRIPTION_MAX}
                  </span>
                </div>
                <textarea
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  rows={5}
                  className="w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary resize-y"
                  placeholder="Racconta cosa ti distingue: storia, prodotti chiave, filiera, clienti tipo. 2-3 frasi bastano."
                />
              </label>
              <p className="text-xs text-sage mt-1">
                Suggerimento: cita filiera, anni di attività e tipologie di
                clientela. I ristoratori cercano affidabilità.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Sito web">
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => set("website", e.target.value)}
                  className="w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
                  placeholder="https://"
                />
              </Field>
              <Field label="Email contatto">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  className="w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
                  placeholder="ordini@..."
                />
              </Field>
              <Field label="Telefono">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  className="w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
                  placeholder="+39 ..."
                />
              </Field>
            </div>
          </div>
        </Card>

        {/* Sede */}
        <Card>
          <h2 className="text-lg font-semibold text-charcoal mb-1">
            Sede principale
          </h2>
          <p className="text-sm text-sage mb-4">
            Mostrata ai ristoratori per valutare distanza e zona di consegna.
          </p>

          <div className="space-y-3">
            <Field label="Indirizzo">
              <input
                type="text"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                className="w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
                placeholder="Via Roma 10"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px] gap-3">
              <Field label="Città">
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  className="w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
                />
              </Field>
              <Field label="Prov.">
                <input
                  type="text"
                  value={form.province}
                  maxLength={4}
                  onChange={(e) => set("province", e.target.value.toUpperCase())}
                  className="w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
                  placeholder="MI"
                />
              </Field>
              <Field label="CAP">
                <input
                  type="text"
                  value={form.zip_code}
                  maxLength={10}
                  onChange={(e) => set("zip_code", e.target.value)}
                  className="w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
                  placeholder="20100"
                />
              </Field>
            </div>
          </div>
        </Card>

        {/* Operatività */}
        <Card>
          <h2 className="text-lg font-semibold text-charcoal mb-1">
            Operatività commerciale
          </h2>
          <p className="text-sm text-sage mb-4">
            Soglie e termini visibili nella pagina pubblica.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Ordine minimo (€)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.min_order_amount}
                onChange={(e) => set("min_order_amount", e.target.value)}
                className="w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary font-mono"
                placeholder="0.00"
              />
            </Field>
            <Field label="Termini pagamento (giorni)">
              <input
                type="number"
                min="0"
                max="365"
                value={form.payment_terms_days}
                onChange={(e) => set("payment_terms_days", e.target.value)}
                className="w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary font-mono"
              />
            </Field>
          </div>

          <label className="mt-4 flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.cold_chain_available}
              onChange={(e) => set("cold_chain_available", e.target.checked)}
              className="h-4 w-4"
            />
            <Snowflake className="h-4 w-4 text-sage" />
            <span className="text-sm text-text-secondary">
              Catena del freddo disponibile
            </span>
          </label>
        </Card>

        {/* Certificazioni */}
        <Card>
          <h2 className="text-lg font-semibold text-charcoal mb-1">
            Certificazioni
          </h2>
          <p className="text-sm text-sage mb-4">
            Selezionando le tue certificazioni appari nei filtri di ricerca dei
            ristoratori.
          </p>
          <div className="flex flex-wrap gap-2">
            {CERT_OPTIONS.map((c) => {
              const active = form.certifications.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCert(c)}
                  className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                    active
                      ? "bg-accent-green text-white border-accent-green"
                      : "bg-surface-base text-charcoal border-border-subtle hover:border-accent-green"
                  }`}
                >
                  {active && <CheckCircle2 className="h-3 w-3 inline mr-1" />}
                  {c}
                </button>
              );
            })}
          </div>
        </Card>

        <div className="flex justify-end gap-2 sticky bottom-2">
          <Button
            onClick={() => setForm(toForm(initialProfile))}
            variant="ghost"
            disabled={pending}
          >
            Annulla
          </Button>
          <Button onClick={submit} disabled={pending || descOver}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {pending ? "Salvo..." : "Salva profilo"}
          </Button>
        </div>
      </div>

      {/* Live preview */}
      <aside className="lg:sticky lg:top-4 self-start">
        <p className="text-xs font-semibold uppercase tracking-wide text-sage mb-2">
          Anteprima · come ti vedono i ristoratori
        </p>
        <Card className="overflow-hidden p-0">
          <div className="relative">
            <div className="w-full aspect-[4/1] bg-sage-muted/20">
              {form.cover_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.cover_url}
                  alt="Copertina"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="absolute -bottom-8 left-4 w-16 h-16 rounded-2xl bg-sage-muted/30 border-4 border-surface-card overflow-hidden flex items-center justify-center">
              {form.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.logo_url}
                  alt="Logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl font-bold text-sage">
                  {(form.company_name || "?").charAt(0)}
                </span>
              )}
            </div>
          </div>
          <div className="px-4 pb-4 pt-10">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-charcoal truncate">
                {form.company_name || "Nome ditta"}
              </h3>
              {initialProfile.is_verified && (
                <Badge variant="success">
                  <Shield className="h-3 w-3 mr-1" /> Verificato
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-sage">
              <Star className="h-3.5 w-3.5 fill-terracotta text-terracotta" />
              <span className="font-bold text-charcoal">
                {initialProfile.rating_avg.toFixed(1)}
              </span>
              <span>({initialProfile.rating_count})</span>
            </div>

            {form.description && (
              <p className="text-sm text-sage mt-2 line-clamp-4">
                {form.description}
              </p>
            )}

            <div className="flex flex-wrap gap-3 mt-3 text-xs text-sage">
              {(form.city || form.province) && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {form.city}
                  {form.province ? ` (${form.province})` : ""}
                </span>
              )}
              {form.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {form.phone}
                </span>
              )}
            </div>

            {form.certifications.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {form.certifications.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/30"
                  >
                    <Award className="h-2.5 w-2.5" /> {c}
                  </span>
                ))}
              </div>
            )}

            {(form.min_order_amount || form.cold_chain_available) && (
              <div className="flex flex-wrap gap-3 mt-3 text-xs text-sage">
                {form.min_order_amount && Number(form.min_order_amount) > 0 && (
                  <span>
                    Ordine min:{" "}
                    <span className="font-mono text-charcoal">
                      €{Number(form.min_order_amount).toFixed(2)}
                    </span>
                  </span>
                )}
                {form.cold_chain_available && (
                  <span className="flex items-center gap-1">
                    <Snowflake className="h-3.5 w-3.5" /> Catena del freddo
                  </span>
                )}
              </div>
            )}
          </div>
        </Card>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-text-secondary">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
