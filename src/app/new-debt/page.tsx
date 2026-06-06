"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Camera, ContactRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useAppData } from "@/hooks/useAppData";
import { createDebtWithCustomer } from "@/lib/database";
import {
  addMonthsToDateString,
  addWeeksToDateString,
  formatCurrency,
  formatCurrencyInput,
  formatDate,
  formatPhoneInput,
  normalizePhone,
  parseCurrencyInput,
} from "@/lib/format";

type ContactPickerContact = {
  name?: string[];
  tel?: string[];
};

type ContactPickerNavigator = Navigator & {
  contacts?: {
    select?: (
      properties: Array<"name" | "tel">,
      options?: {
        multiple?: boolean;
      },
    ) => Promise<ContactPickerContact[]>;
  };
};

export default function NewDebtPage() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dailyInterest, setDailyInterest] = useState(1.5);
  const [installments, setInstallments] = useState(1);
  const [frequency, setFrequency] = useState<"monthly" | "weekly">("monthly");
  const [description, setDescription] = useState("");
  const [photoNotice, setPhotoNotice] = useState("");
  const [contactNotice, setContactNotice] = useState("");
  const [importingContact, setImportingContact] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const { customers } = useAppData();

  const existingCustomer = useMemo(() => {
    const normalized = normalizePhone(phone);

    if (!normalized) return null;

    return customers.find((customer) => normalizePhone(customer.phone) === normalized) || null;
  }, [customers, phone]);

  const customerSuggestions = useMemo(() => {
    const query = `${name} ${phone}`.toLowerCase();
    const normalizedPhone = normalizePhone(phone);

    if (!name.trim() && normalizedPhone.length < 3) return [];

    return customers
      .filter((customer) => {
        const customerPhone = normalizePhone(customer.phone);
        return (
          customer.name.toLowerCase().includes(query.trim()) ||
          (normalizedPhone.length >= 3 && customerPhone.includes(normalizedPhone))
        );
      })
      .slice(0, 3);
  }, [customers, name, phone]);

  const parsedAmount = parseCurrencyInput(amount);
  const installmentPreview = useMemo(() => {
    if (!dueDate || !parsedAmount || parsedAmount <= 0) return [];

    const cents = Math.round(parsedAmount * 100);
    const base = Math.floor(cents / installments);
    const remainder = cents % installments;

    return Array.from({ length: installments }, (_, index) => ({
      date: frequency === "weekly" ? addWeeksToDateString(dueDate, index) : addMonthsToDateString(dueDate, index),
      amount: (base + (index < remainder ? 1 : 0)) / 100,
    }));
  }, [dueDate, installments, parsedAmount, frequency]);

  const handleNext = () => {
    if (!name.trim() || !phone.trim()) {
      setError("Informe nome e telefone para continuar.");
      return;
    }

    setError("");
    setStep(2);
  };

  const handleBack = () => (step > 1 ? setStep(step - 1) : router.back());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) return;

    if (!parsedAmount || parsedAmount <= 0 || !dueDate) {
      setError("Informe valor e vencimento validos.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await createDebtWithCustomer(user.id, {
        name: name.trim(),
        phone: phone.trim(),
        amount: parsedAmount,
        dueDate,
        dailyInterest,
        description: description.trim(),
        installments,
        frequency,
      });
      router.push("/");
    } catch {
      setError("Nao foi possivel salvar a divida agora.");
    } finally {
      setSubmitting(false);
    }
  }

  function applyCustomer(customer: { name: string; phone: string }) {
    setName(customer.name);
    setPhone(formatPhoneInput(customer.phone));
  }

  async function importFromContacts() {
    setContactNotice("");
    setError("");

    if (typeof navigator === "undefined") {
      setContactNotice("A agenda esta disponivel em navegadores moveis compativeis.");
      return;
    }

    const contacts = (navigator as ContactPickerNavigator).contacts;

    if (!contacts?.select) {
      setContactNotice("A agenda esta disponivel em navegadores moveis compativeis.");
      return;
    }

    try {
      setImportingContact(true);
      const selectedContacts = await contacts.select(["name", "tel"], { multiple: false });
      const selectedContact = selectedContacts[0];

      if (!selectedContact) return;

      const importedName = selectedContact.name?.find((value) => value.trim())?.trim() || "";
      const importedPhone = selectedContact.tel?.find((value) => normalizePhone(value)) || "";

      if (importedName) setName(importedName);
      if (importedPhone) setPhone(formatPhoneInput(importedPhone));

      if (!importedName && !importedPhone) {
        setContactNotice("Este contato nao tem nome ou telefone para importar.");
        return;
      }

      setContactNotice(
        importedName && importedPhone
          ? "Contato importado. Revise os dados antes de continuar."
          : "Contato importado parcialmente. Complete o que faltar.",
      );
    } catch (importError) {
      if (importError instanceof DOMException && importError.name === "AbortError") return;

      setContactNotice("Nao foi possivel acessar a agenda neste dispositivo.");
    } finally {
      setImportingContact(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="min-h-[100dvh] bg-white flex flex-col page-transition">
      <header className="p-5 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={handleBack}
          className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center btn-press hover:bg-gray-200 transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft size={22} strokeWidth={1.8} />
        </button>
        <h1 className="font-semibold text-base text-gray-900">Nova Divida</h1>
        <div className="w-8" />
      </header>

      <div className="px-6 flex gap-2 shrink-0">
        <div className={`h-1 flex-1 rounded-full transition-colors duration-300 ${step >= 1 ? "bg-gray-900" : "bg-gray-100"}`} />
        <div className={`h-1 flex-1 rounded-full transition-colors duration-300 ${step >= 2 ? "bg-gray-900" : "bg-gray-100"}`} />
      </div>

      <div className="flex-1 p-6 pb-4 overflow-y-auto">
        {step === 1 && (
          <div className="space-y-6 page-slide-right">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Quem deve?</h2>
              <p className="text-gray-400 text-sm mt-1">Cadastre o cliente para gerar a cobranca.</p>
            </div>

            <div className="flex flex-col items-center gap-4 py-4">
              <button
                type="button"
                onClick={() => setPhotoNotice("Foto do cliente vai entrar em uma proxima versao.")}
                className="w-20 h-20 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-300 gap-1 btn-press cursor-pointer hover:border-gray-300 transition-colors"
              >
                <Camera size={22} strokeWidth={1.5} />
                <span className="text-[9px] font-medium uppercase tracking-wider">Foto</span>
              </button>
              {photoNotice && <p className="text-xs text-gray-400 font-medium text-center">{photoNotice}</p>}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={importFromContacts}
                  disabled={importingContact}
                  className="w-full min-h-14 px-3 py-3 rounded-xl bg-gray-50 border border-gray-100 text-gray-700 flex items-center justify-between gap-3 btn-press hover:bg-gray-100 transition-colors disabled:opacity-60"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-lg bg-white text-gray-500 flex items-center justify-center shadow-ios shrink-0">
                      <ContactRound size={18} strokeWidth={1.8} />
                    </span>
                    <span className="text-left min-w-0">
                      <span className="block text-sm font-semibold text-gray-900">
                        {importingContact ? "Abrindo agenda..." : "Importar da agenda"}
                      </span>
                      <span className="block text-xs text-gray-400 mt-0.5">Nome e telefone</span>
                    </span>
                  </span>
                  <ArrowRight size={16} strokeWidth={2} className="text-gray-300 shrink-0" />
                </button>
                {contactNotice && <p className="text-xs text-gray-400 font-medium ml-0.5">{contactNotice}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide ml-0.5">Nome Completo</label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  type="text"
                  placeholder="Ex: Joao da Silva"
                  className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-xl text-sm placeholder:text-gray-300 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide ml-0.5">WhatsApp / Telefone</label>
                <input
                  value={phone}
                  onChange={(event) => {
                    const nextPhone = formatPhoneInput(event.target.value);
                    setPhone(nextPhone);
                    const normalized = normalizePhone(event.target.value);
                    const matched = customers.find((customer) => normalizePhone(customer.phone) === normalized);

                    if (matched) {
                      setName(matched.name);
                    }
                  }}
                  type="tel"
                  placeholder="(00) 00000-0000"
                  className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-xl text-sm placeholder:text-gray-300 transition-all"
                />
                {existingCustomer && (
                  <p className="text-xs text-green-500 font-medium ml-0.5">
                    Vamos adicionar esta cobranca ao cadastro de {existingCustomer.name}.
                  </p>
                )}
              </div>
              {customerSuggestions.length > 0 && (
                <div className="rounded-xl bg-gray-50 border border-gray-100 divide-y divide-gray-100 overflow-hidden">
                  {customerSuggestions.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => applyCustomer(customer)}
                      className="w-full px-3 py-3 text-left flex items-center justify-between gap-3"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-gray-900">{customer.name}</span>
                        <span className="block text-xs text-gray-400 mt-0.5">{formatPhoneInput(customer.phone)}</span>
                      </span>
                      <span className="text-xs font-semibold text-ios-blue">Usar</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 page-slide-left">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Quanto deve?</h2>
              <p className="text-gray-400 text-sm mt-1">Detalhes do valor e prazo de pagamento.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide ml-0.5">Valor Total (R$)</label>
                <input
                  value={amount}
                  onChange={(event) => setAmount(formatCurrencyInput(event.target.value))}
                  inputMode="decimal"
                  placeholder="0,00"
                  className="w-full p-5 text-3xl font-semibold bg-gray-50 border border-gray-100 rounded-xl placeholder:text-gray-200 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide ml-0.5">Data de Vencimento</label>
                <input
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  type="date"
                  className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-600 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide ml-0.5">Descricao</label>
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Ex: venda parcelada, servico, aluguel..."
                  className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-xl text-sm placeholder:text-gray-300 transition-all"
                />
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-1 p-1 bg-gray-50 rounded-xl mb-4">
                  <button
                    type="button"
                    onClick={() => setFrequency("monthly")}
                    className={`py-2 rounded-lg text-xs font-semibold transition ${
                      frequency === "monthly" ? "bg-white text-gray-950 shadow-ios" : "text-gray-400"
                    }`}
                  >
                    Mensal
                  </button>
                  <button
                    type="button"
                    onClick={() => setFrequency("weekly")}
                    className={`py-2 rounded-lg text-xs font-semibold transition ${
                      frequency === "weekly" ? "bg-white text-gray-950 shadow-ios" : "text-gray-400"
                    }`}
                  >
                    Semanal
                  </button>
                </div>

                <div className="flex justify-between items-center px-0.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                    {frequency === "monthly" ? "Parcelas mensais" : "Parcelas semanais"}
                  </label>
                  <span className="text-gray-900 font-semibold text-sm">{installments}x</span>
                </div>
                <input
                  value={installments}
                  onChange={(event) => setInstallments(Number(event.target.value))}
                  type="range"
                  min="1"
                  max="12"
                  step="1"
                  className="w-full accent-gray-900"
                />

                {installmentPreview.length > 1 && (
                  <div className="rounded-xl bg-gray-50 border border-gray-100 divide-y divide-gray-100 overflow-hidden">
                    {installmentPreview.slice(0, 4).map((installment, index) => (
                      <div key={installment.date} className="flex justify-between items-center px-3 py-2 text-xs">
                        <span className="text-gray-500">Parcela {index + 1}</span>
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(installment.amount)} · {formatDate(installment.date)}
                        </span>
                      </div>
                    ))}
                    {installmentPreview.length > 4 && (
                      <div className="px-3 py-2 text-xs font-medium text-gray-400">
                        + {installmentPreview.length - 4} parcela{installmentPreview.length - 4 === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex justify-between items-center px-0.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Juros por dia de atraso</label>
                  <span className="text-gray-900 font-semibold text-sm">{dailyInterest}%</span>
                </div>
                <input
                  value={dailyInterest}
                  onChange={(event) => setDailyInterest(Number(event.target.value))}
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  className="w-full accent-gray-900"
                />
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-sm font-medium text-red-500 mt-5">{error}</p>}
      </div>

      <footer className="sticky bottom-0 z-10 bg-white/95 px-6 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-gray-100/80 backdrop-blur shrink-0">
        {step === 2 ? (
          <button
            disabled={submitting}
            className="w-full min-h-14 px-4 py-3 bg-gray-900 text-white rounded-xl font-medium flex items-center justify-center gap-2 btn-press disabled:opacity-50"
            style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}
          >
            <Check size={18} strokeWidth={2} />
            {submitting ? "Salvando..." : "Salvar Divida"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="w-full min-h-14 px-4 py-3 bg-gray-900 text-white rounded-xl font-medium flex items-center justify-center gap-2 btn-press"
            style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}
          >
            Proximo
            <ArrowRight size={18} strokeWidth={2} />
          </button>
        )}
      </footer>
    </form>
  );
}
