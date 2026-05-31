"use client";

import { useRef } from "react";
import { Trash2 } from "lucide-react";

type EditableMessageBoxProps = {
  ariaLabel?: string;
  className?: string;
  onChange: (value: string) => void;
  rows?: number;
  value: string;
};

export default function EditableMessageBox({
  ariaLabel = "Mensagem de cobranca",
  className,
  onChange,
  rows = 6,
  value,
}: EditableMessageBoxProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function focusMessage() {
    textareaRef.current?.focus();
  }

  function handleClear() {
    onChange("");
    window.requestAnimationFrame(focusMessage);
  }

  return (
    <div
      className={[
        "relative w-full cursor-text overflow-hidden rounded-xl border border-gray-100 bg-gray-50 text-left transition focus-within:ring-2 focus-within:ring-ios-blue/20",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={focusMessage}
    >
      <textarea
        ref={textareaRef}
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Digite sua mensagem de cobranca"
        rows={rows}
        className="block w-full resize-none bg-transparent p-3 pr-11 text-sm leading-relaxed text-gray-700 outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            handleClear();
          }}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-gray-400 shadow-ios transition-colors hover:text-red-500"
          aria-label="Apagar mensagem"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}
