"use client";
import { useState } from "react";

export default function CopyButton({ text, label = "نسخ", copiedLabel = "تم النسخ", className = "btn btn-outline btn-sm" }: { text: string; label?: string; copiedLabel?: string; className?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  }
  return (
    <button type="button" onClick={copy} className={className} aria-live="polite">
      {done ? copiedLabel : label}
    </button>
  );
}
