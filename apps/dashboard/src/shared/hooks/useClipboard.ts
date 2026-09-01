import { useState } from "react";

function fallbackCopy(value: string): void {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

type UseClipboardOptions = {
  onError?: (message: string) => void;
  resetAfterMs?: number;
};

export function useClipboard<Field extends string>(options: UseClipboardOptions = {}) {
  const [copiedField, setCopiedField] = useState<Field | null>(null);
  const resetAfterMs = options.resetAfterMs ?? 1600;

  async function copy(value: string, field: Field): Promise<void> {
    if (!value) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        fallbackCopy(value);
      }

      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), resetAfterMs);
    } catch {
      options.onError?.("Could not copy to clipboard. Select and copy the value manually.");
    }
  }

  return { copiedField, copy };
}
