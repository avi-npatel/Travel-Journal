"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A modal "are you sure?" for actions that cannot be undone. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      // Fires for Escape as well as for close(), so one handler covers both.
      onClose={onCancel}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded border border-ink bg-raised p-6 text-ink backdrop:bg-black/60"
    >
      <h2 className="display text-3xl">{title}</h2>
      <div className="mt-3 text-soft">{children}</div>
      <div className="mt-6 flex justify-end gap-3">
        {/* Cancel comes first so it, not the destructive button, gets focus. */}
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
