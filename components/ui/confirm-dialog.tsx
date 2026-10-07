"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Modal, ModalActions } from "./modal";

export type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" paints the confirm pill red (destructive actions). */
  tone?: "default" | "danger";
};

/**
 * Promise-based replacement for `window.confirm()` rendered as a Fernly
 * modal. Usage:
 *
 *   const { confirm, dialog } = useConfirm();
 *   if (!(await confirm({ title: "Eliminare?", tone: "danger" }))) return;
 *   …
 *   return <>{…}{dialog}</>;
 */
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    resolver.current?.(false);
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  }, []);

  const dialog = (
    <Modal
      isOpen={opts !== null}
      onClose={() => settle(false)}
      title={opts?.title}
      description={opts?.description}
      size="sm"
    >
      <ModalActions className="mt-1">
        <button type="button" className="f-btn f-btn-outline" onClick={() => settle(false)}>
          {opts?.cancelLabel ?? "Annulla"}
        </button>
        <button
          type="button"
          data-autofocus
          className={opts?.tone === "danger" ? "f-btn f-btn-danger" : "f-btn f-btn-primary"}
          onClick={() => settle(true)}
        >
          {opts?.confirmLabel ?? "Conferma"}
        </button>
      </ModalActions>
    </Modal>
  );

  return { confirm, dialog };
}
