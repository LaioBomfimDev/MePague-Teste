"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, MessageCircle, Send, X } from "lucide-react";
import EditableMessageBox from "@/components/EditableMessageBox";
import { usePersonalizedChargeMessage } from "@/hooks/usePersonalizedChargeMessage";
import { saveLearnedChargeMessageTemplate } from "@/lib/chargeMessageTemplates";
import { recordChargeLog } from "@/lib/database";
import { buildWhatsappUrl, type ChargeMessageInput } from "@/lib/format";
import type { MessageTone } from "@/lib/types";

const toneOptions: Array<{ value: MessageTone; label: string }> = [
  { value: "friendly", label: "Amigavel" },
  { value: "firm", label: "Firme" },
  { value: "overdue", label: "Atraso" },
];

type ChargeMessageButtonProps = {
  amount: number;
  className?: string;
  customerId?: string;
  daysOverdue?: number;
  debtId?: string;
  debtorName: string;
  debtsCount?: number;
  defaultTone?: MessageTone;
  description?: string;
  dueDate?: string;
  iconSize?: number;
  label?: string;
  messageOverride?: string;
  phone: string;
  pixKey?: string;
  userId?: string;
};

export default function ChargeMessageButton({
  amount,
  className,
  customerId,
  daysOverdue,
  debtId,
  debtorName,
  debtsCount,
  defaultTone = "friendly",
  description,
  dueDate,
  iconSize = 18,
  label,
  messageOverride,
  phone,
  pixKey,
  userId,
}: ChargeMessageButtonProps) {
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState<MessageTone>(defaultTone);
  const [messageText, setMessageText] = useState("");
  const [copied, setCopied] = useState(false);
  const messageInput = useMemo<ChargeMessageInput>(
    () => ({
      amount,
      daysOverdue,
      debtorName,
      debtsCount,
      description,
      dueDate,
      pixKey,
      tone,
    }),
    [amount, daysOverdue, debtorName, debtsCount, description, dueDate, pixKey, tone],
  );
  const generatedMessage = usePersonalizedChargeMessage(userId, messageInput);
  const preparedMessage = messageOverride !== undefined && tone === defaultTone ? messageOverride : generatedMessage;
  const canUseMessage = messageText.trim().length > 0;

  useEffect(() => {
    if (open) {
      setMessageText(preparedMessage);
      setCopied(false);
    }
  }, [open, preparedMessage]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  async function logCharge(action: "copied" | "sent") {
    if (!userId || !customerId) return;

    try {
      await recordChargeLog(userId, {
        action,
        customerId,
        customerName: debtorName,
        debtId,
        message: messageText,
        tone,
      });
    } catch {
      // A cobranca ainda pode seguir mesmo que o historico falhe.
    }
  }

  function handleOpen() {
    setTone(defaultTone);
    setOpen(true);
  }

  function handleMessageChange(value: string) {
    setMessageText(value);
    saveLearnedChargeMessageTemplate(userId, tone, value, messageInput);
  }

  async function handleCopy() {
    if (!canUseMessage) return;

    await navigator.clipboard.writeText(messageText);
    await logCharge("copied");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function handleSend() {
    if (!canUseMessage) return;

    window.open(buildWhatsappUrl(phone, messageText), "_blank", "noopener,noreferrer");
    void logCharge("sent");
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={
          className ||
          "w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center btn-press"
        }
        aria-label={`Preparar mensagem para ${debtorName}`}
      >
        <MessageCircle size={iconSize} />
        {label && <span>{label}</span>}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div className="app-modal z-[100]">
          <button
            type="button"
            aria-label="Fechar previa"
            className="app-modal__backdrop"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Previa da mensagem"
            className="app-modal__panel relative w-full max-w-lg bg-white rounded-[1.4rem] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Previa da cobranca</p>
                <h2 className="text-lg font-semibold text-gray-950 mt-0.5">{debtorName}</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-9 h-9 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1 p-1 bg-gray-50 rounded-xl">
              {toneOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTone(option.value)}
                  className={`py-2 rounded-lg text-xs font-semibold transition ${
                    tone === option.value ? "bg-white text-gray-950 shadow-ios" : "text-gray-400"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <EditableMessageBox
              value={messageText}
              onChange={handleMessageChange}
              rows={7}
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!canUseMessage}
                className="p-3 rounded-xl bg-gray-900 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Copy size={16} />
                {copied ? "Copiada" : "Copiar"}
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={!canUseMessage}
                className="p-3 rounded-xl bg-green-500 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send size={16} />
                WhatsApp
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
