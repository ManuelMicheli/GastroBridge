"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, UploadCloud } from "lucide-react";

type PodUploaded = { path: string };

type Props = {
  deliveryId: string;
  onUploaded: (data: PodUploaded) => void;
  uploaded: boolean;
  disabled?: boolean;
  /**
   * Callback per eseguire l'upload server-side. Riceve bytes base64 + mime.
   * Tipizzato come funzione `async`: il genitore passa una `server action`.
   */
  uploadAction: (args: {
    delivery_id: string;
    bytes_base64: string;
    mime_type: "image/png" | "image/jpeg" | "image/webp";
  }) => Promise<
    | { ok: true; data: { path: string } }
    | { ok: false; error: string }
  >;
};

const MIME_TO_SUPPORTED: Record<
  string,
  "image/png" | "image/jpeg" | "image/webp"
> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/webp": "image/webp",
};

async function fileToBase64(file: File): Promise<string> {
  const arrayBuf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(arrayBuf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  return btoa(binary);
}

/**
 * Input camera mobile: `accept="image/*" capture="environment"` apre la
 * fotocamera posteriore su iOS/Android. Preview locale via `URL.createObjectURL`,
 * upload via server action.
 */
export function PodPhotoCapture({
  deliveryId,
  onUploaded,
  uploaded,
  disabled,
  uploadAction,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPreviewUrl(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    setError(null);
    const mime = MIME_TO_SUPPORTED[file.type];
    if (!mime) {
      setError("Formato non supportato (PNG/JPEG/WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File troppo grande (max 5 MB)");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await uploadAction({
        delivery_id: deliveryId,
        bytes_base64: base64,
        mime_type: mime,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onUploaded({ path: res.data.path });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {!previewUrl ? (
        <Button
          type="button"
          variant="secondary"
          className="h-12 w-full"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
        >
          <Camera className="mr-2 h-5 w-5" />
          {uploaded ? "Sostituisci foto POD" : "Aggiungi foto POD"}
        </Button>
      ) : (
        <div className="space-y-2">
          <div className="relative aspect-video overflow-hidden rounded-lg border border-sage-muted/40 bg-sage-muted/20">
            {/* preview cliente: usiamo <img> classico per object URL */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Anteprima foto POD"
              className="h-full w-full object-cover"
            />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <UploadCloud className="h-6 w-6 animate-pulse text-forest" />
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-sage">
              {uploading
                ? "Caricamento in corso…"
                : uploaded
                  ? "Foto POD salvata."
                  : "Foto pronta."}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={uploading}
            >
              <RotateCcw className="mr-1 h-4 w-4" /> Cambia
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-terracotta">{error}</p>}
    </div>
  );
}
