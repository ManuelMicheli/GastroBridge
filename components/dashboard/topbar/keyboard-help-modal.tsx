"use client";

import { Modal } from "@/components/ui/modal";

type Props = { open: boolean; onClose: () => void };

const groups: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: "Navigazione",
    items: [
      { keys: ["⌘", "K"], label: "Apri command palette" },
      { keys: ["Ctrl", "B"], label: "Toggle sidebar" },
      { keys: ["G", "D"], label: "Vai a Dashboard" },
      { keys: ["G", "O"], label: "Vai a Ordini" },
      { keys: ["G", "C"], label: "Vai a Catalogo" },
      { keys: ["G", "K"], label: "Vai a Clienti" },
    ],
  },
  {
    title: "Azioni",
    items: [
      { keys: ["N"], label: "Nuovo (contestuale)" },
      { keys: ["Esc"], label: "Chiudi overlay" },
      { keys: ["?"], label: "Apri questa guida" },
    ],
  },
];

export function KeyboardHelpModal({ open, onClose }: Props) {
  return (
    <Modal isOpen={open} onClose={onClose} title="Scorciatoie da tastiera">
      <div className="space-y-6">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-secondary mb-2">
              {g.title}
            </div>
            <ul className="space-y-1.5">
              {g.items.map((it) => (
                <li key={it.label} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-text-primary">{it.label}</span>
                  <span className="flex items-center gap-1">
                    {it.keys.map((k) => (
                      <kbd
                        key={k}
                        className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border-default bg-surface-muted text-text-primary"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  );
}
