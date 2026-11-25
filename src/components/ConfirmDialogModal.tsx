import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmDialogModal: React.FC<ConfirmDialogModalProps> = ({
  open,
  title,
  description,
  confirmLabel,
  busy = false,
  onCancel,
  onConfirm,
}) => {
  if (!open) return null;

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-md shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <h2 id="confirm-dialog-title" className="text-sm font-semibold text-slate-900">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close confirmation dialog"
            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 text-xs text-slate-700 leading-relaxed">{description}</div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md whitespace-nowrap cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            {busy ? 'Uploading…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
