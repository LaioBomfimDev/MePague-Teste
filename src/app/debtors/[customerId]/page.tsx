"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import {
  CalendarClock,
  Check,
  Copy,
  Edit3,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import ChargeMessageButton from "@/components/ChargeMessageButton";
import MobileHeader from "@/components/MobileHeader";
import Toast from "@/components/Toast";
import { useAppData } from "@/hooks/useAppData";
import { deleteDebt, markDebtAsOpen, recordChargeLog, recordPayment, updateCustomer, updateDebt } from "@/lib/database";
import {
  buildChargeMessage,
  formatCurrency,
  formatCurrencyInput,
  formatDate,
  formatDateTime,
  formatPhoneInput,
  getDebtTimingLabel,
  normalizePhone,
  parseCurrencyInput,
} from "@/lib/format";
import type { DebtWithCustomer, MessageTone } from "@/lib/types";

const toneOptions: Array<{ value: MessageTone; label: string }> = [
  { value: "friendly", label: "Amigavel" },
  { value: "firm", label: "Firme" },
  { value: "overdue", label: "Atraso" },
];

export default function DebtorDetailPage() {
  const params = useParams<{ customerId: string }>();
  const customerId = params.customerId;
  const { chargeLogs, customers, debts, loading, profile, user } = useAppData();
  const [tone, setTone] = useState<MessageTone>("friendly");
  const [copied, setCopied] = useState(false);
  const [busyDebtId, setBusyDebtId] = useState<string | null>(null);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [paymentDebt, setPaymentDebt] = useState<DebtWithCustomer | null>(null);
  const [toast, setToast] = useState("");

  const customer = customers.find((item) => item.id === customerId);
  const customerDebts = useMemo(
    () => debts.filter((debt) => debt.customerId === customerId),
    [customerId, debts],
  );
  const openDebts = customerDebts.filter((debt) => debt.status === "open");
  const paidDebts = customerDebts.filter((debt) => debt.status === "paid");
  const debtorName = customer?.name || customerDebts[0]?.customerName || "Devedor";
  const debtorPhone = customer?.phone || customerDebts[0]?.customerPhone || "";
  const totalOpen = openDebts.reduce((sum, debt) => sum + debt.outstandingAmount, 0);
  const totalOriginal = openDebts.reduce((sum, debt) => sum + debt.amount, 0);
  const totalPaid = customerDebts.reduce((sum, debt) => sum + debt.paidAmount, 0);
  const overdueCount = openDebts.filter((debt) => debt.isOverdue).length;
  const maxDaysOverdue = openDebts.reduce((max, debt) => Math.max(max, debt.daysOverdue), 0);
  const nextDebt = openDebts
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const message = buildChargeMessage({
    debtorName,
    amount: totalOpen,
    pixKey: profile?.pixKey,
    tone: overdueCount > 0 && tone === "friendly" ? "overdue" : tone,
    dueDate: nextDebt?.dueDate,
    daysOverdue: maxDaysOverdue,
    debtsCount: openDebts.length,
  });
  const installmentGroups = useMemo(() => buildInstallmentGroups(customerDebts), [customerDebts]);
  const lastCharge = chargeLogs
    .filter((log) => log.customerId === customerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  async function runDebtAction(debtId: string, action: () => Promise<void>) {
    setBusyDebtId(debtId);

    try {
      await action();
    } finally {
      setBusyDebtId(null);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(message);
    if (user && customerId) {
      void recordChargeLog(user.id, {
        action: "copied",
        customerId,
        customerName: debtorName,
        message,
        tone: overdueCount > 0 && tone === "friendly" ? "overdue" : tone,
      });
    }
    setCopied(true);
    setToast("Mensagem copiada.");
    window.setTimeout(() => setCopied(false), 1600);
    window.setTimeout(() => setToast(""), 2200);
  }

  async function handleMarkAllPaid() {
    if (!user) return;

    setBusyDebtId("all");

    try {
      await Promise.all(
        openDebts.map((debt) =>
          recordPayment(user.id, {
            debtId: debt.id,
            customerId: debt.customerId,
            amount: debt.outstandingAmount,
            outstandingAmount: debt.outstandingAmount,
            note: "Quitacao total",
          }),
        ),
      );
      setToast("Todas as cobrancas foram marcadas como pagas.");
      window.setTimeout(() => setToast(""), 2400);
    } finally {
      setBusyDebtId(null);
    }
  }

  if (loading) {
    return (
      <div className="p-5 pb-28 space-y-4 animate-pulse">
        <div className="h-10 w-36 bg-gray-100 rounded-xl" />
        <div className="h-44 bg-gray-50 rounded-2xl" />
        <div className="h-20 bg-gray-50 rounded-2xl" />
        <div className="h-20 bg-gray-50 rounded-2xl" />
      </div>
    );
  }

  if (customerDebts.length === 0) {
    return (
      <div className="p-5 pb-28 space-y-5 page-transition">
        <MobileHeader title="Devedor" fallbackHref="/debtors" />
        <div className="card rounded-[18px] p-6 text-center">
          <p className="font-semibold text-gray-900">Nada encontrado por aqui</p>
          <p className="text-sm text-gray-400 mt-1">Esse devedor nao possui cobrancas cadastradas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 pb-28 space-y-5 page-transition">
      <Toast message={toast} />
      <MobileHeader
        title={debtorName}
        subtitle={`${formatPhoneInput(debtorPhone) || "Sem telefone"}${lastCharge ? ` · cobrado em ${formatDateTime(lastCharge.createdAt)}` : ""}`}
        fallbackHref="/debtors"
        action={
          <button
            type="button"
            onClick={() => setEditingCustomer(true)}
            className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center btn-press"
            aria-label="Editar devedor"
          >
            <Edit3 size={16} />
          </button>
        }
      />

      {editingCustomer && user && (
        <CustomerEditForm
          customerId={customerId}
          initialName={debtorName}
          initialPhone={debtorPhone}
          userId={user.id}
          onCancel={() => setEditingCustomer(false)}
        />
      )}

      <section className="card rounded-[18px] p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Total em aberto</p>
            <p className="text-3xl font-semibold text-gray-950 mt-1">{formatCurrency(totalOpen)}</p>
            {totalOpen !== totalOriginal && (
              <p className="text-xs text-gray-400 mt-1">Original: {formatCurrency(totalOriginal)}</p>
            )}
            {totalPaid > 0 && <p className="text-xs text-green-500 mt-1">Ja recebido: {formatCurrency(totalPaid)}</p>}
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${overdueCount > 0 ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"}`}>
            {overdueCount > 0 ? `${overdueCount} atrasada${overdueCount === 1 ? "" : "s"}` : `${openDebts.length} aberta${openDebts.length === 1 ? "" : "s"}`}
          </div>
        </div>

        {openDebts.length > 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1 p-1 bg-gray-50 rounded-xl">
              {toneOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTone(option.value)}
                  className={`py-2 rounded-lg text-xs font-semibold transition ${tone === option.value ? "bg-white text-gray-950 shadow-ios" : "text-gray-400"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <p className="p-3 rounded-xl bg-gray-50 text-sm leading-relaxed text-gray-600">{message}</p>

            <div className="grid grid-cols-2 gap-2">
              <ChargeMessageButton
                amount={totalOpen}
                customerId={customerId}
                daysOverdue={maxDaysOverdue}
                debtorName={debtorName}
                debtsCount={openDebts.length}
                defaultTone={overdueCount > 0 && tone === "friendly" ? "overdue" : tone}
                dueDate={nextDebt?.dueDate}
                label="WhatsApp"
                phone={debtorPhone}
                pixKey={profile?.pixKey}
                userId={user?.id}
                className="p-3 bg-green-500 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 btn-press"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="p-3 bg-gray-900 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 btn-press"
              >
                <Copy size={17} />
                {copied ? "Copiada" : "Copiar"}
              </button>
            </div>

            <button
              type="button"
              onClick={handleMarkAllPaid}
              disabled={busyDebtId === "all"}
              className="w-full p-3 bg-blue-50 text-blue-600 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check size={17} />
              {busyDebtId === "all" ? "Baixando..." : "Marcar todas como pagas"}
            </button>
          </div>
        )}
      </section>

      {installmentGroups.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 px-1">Parcelas</h2>
          {installmentGroups.map((group) => (
            <div key={group.key} className="card rounded-[14px] p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm text-gray-900">{group.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {group.paid}/{group.total} parcelas pagas
                    {group.nextDebt ? ` · proxima ${formatDate(group.nextDebt.dueDate)}` : ""}
                  </p>
                </div>
                <p className="font-semibold text-sm text-gray-900">{formatCurrency(group.outstanding)}</p>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-green-500" style={{ width: `${(group.paid / group.total) * 100}%` }} />
              </div>
              {group.openDebts.length > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!user) return;
                    setBusyDebtId(group.key);
                    try {
                      await Promise.all(
                        group.openDebts.map((debt) =>
                          recordPayment(user.id, {
                            debtId: debt.id,
                            customerId: debt.customerId,
                            amount: debt.outstandingAmount,
                            outstandingAmount: debt.outstandingAmount,
                            note: "Quitacao de parcelas",
                          }),
                        ),
                      );
                    } finally {
                      setBusyDebtId(null);
                    }
                  }}
                  disabled={busyDebtId === group.key}
                  className="w-full p-3 rounded-xl bg-green-50 text-green-600 font-semibold text-sm disabled:opacity-50"
                >
                  {busyDebtId === group.key ? "Quitando..." : "Quitar todas"}
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      <DebtSection
        title="Em aberto"
        debts={openDebts}
        empty="Nenhuma cobranca em aberto."
        busyDebtId={busyDebtId}
        editingDebtId={editingDebtId}
        onEdit={setEditingDebtId}
        onAction={runDebtAction}
        onPay={setPaymentDebt}
        pixKey={profile?.pixKey}
        userId={user?.id}
      />

      <DebtSection
        title="Historico de pagamentos"
        debts={paidDebts}
        empty="Os pagamentos confirmados aparecem aqui."
        busyDebtId={busyDebtId}
        editingDebtId={editingDebtId}
        onEdit={setEditingDebtId}
        onAction={runDebtAction}
        onPay={setPaymentDebt}
        pixKey={profile?.pixKey}
        userId={user?.id}
      />

      {paymentDebt && user && (
        <PaymentModal
          debt={paymentDebt}
          userId={user.id}
          onClose={() => setPaymentDebt(null)}
          onSaved={() => {
            setToast("Pagamento registrado.");
            window.setTimeout(() => setToast(""), 2400);
          }}
        />
      )}
    </div>
  );
}

function DebtSection({
  title,
  debts,
  empty,
  busyDebtId,
  editingDebtId,
  onEdit,
  onAction,
  onPay,
  pixKey,
  userId,
}: {
  title: string;
  debts: DebtWithCustomer[];
  empty: string;
  busyDebtId: string | null;
  editingDebtId: string | null;
  onEdit: (debtId: string | null) => void;
  onAction: (debtId: string, action: () => Promise<void>) => Promise<void>;
  onPay: (debt: DebtWithCustomer) => void;
  pixKey?: string;
  userId?: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-900 px-1">{title}</h2>

      {debts.length === 0 ? (
        <div className="card rounded-[14px] p-4 text-sm text-gray-400 text-center">{empty}</div>
      ) : (
        <div className="space-y-2">
          {debts.map((debt) =>
            editingDebtId === debt.id ? (
              <EditDebtForm key={debt.id} debt={debt} userId={userId} onCancel={() => onEdit(null)} />
            ) : (
              <DebtCard
                key={debt.id}
                debt={debt}
                busy={busyDebtId === debt.id}
                onEdit={() => onEdit(debt.id)}
                onMarkPaid={() => onPay(debt)}
                onReopen={() => userId && onAction(debt.id, () => markDebtAsOpen(userId, debt.id))}
                onDelete={() => {
                  if (!userId || !window.confirm("Excluir esta cobranca?")) return;
                  void onAction(debt.id, () => deleteDebt(userId, debt.id));
                }}
                pixKey={pixKey}
                userId={userId}
              />
            ),
          )}
        </div>
      )}
    </section>
  );
}

function DebtCard({
  debt,
  busy,
  onDelete,
  onEdit,
  onMarkPaid,
  onReopen,
  pixKey,
  userId,
}: {
  debt: DebtWithCustomer;
  busy: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onMarkPaid: () => void;
  onReopen: () => void;
  pixKey?: string;
  userId?: string;
}) {
  const isPaid = debt.status === "paid";
  const displayAmount = isPaid ? debt.paidAmount || debt.amount : debt.outstandingAmount;

  return (
    <div className="card rounded-[14px] p-4 space-y-3">
      <div className="flex justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-gray-900 truncate">{debt.description || "Cobranca sem descricao"}</p>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <CalendarClock size={13} />
            {formatDate(debt.dueDate)} · {getDebtTimingLabel(debt)}
          </p>
          {debt.paidAt && <p className="text-xs text-green-500 mt-1">Pago em {formatDate(debt.paidAt.slice(0, 10))}</p>}
        </div>
        <div className="text-right">
          <p className="font-semibold text-sm text-gray-900">{formatCurrency(displayAmount)}</p>
          {debt.paidAmount > 0 && <p className="text-[11px] text-green-500">Pago {formatCurrency(debt.paidAmount)}</p>}
          {debt.amountWithInterest !== debt.amount && debt.status !== "paid" && (
            <p className="text-[11px] text-gray-400">Base {formatCurrency(debt.amount)}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <button
          type="button"
          onClick={isPaid ? onReopen : onMarkPaid}
          disabled={busy}
          className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 ${isPaid ? "bg-gray-50 text-gray-500" : "bg-green-50 text-green-600"}`}
        >
          {isPaid ? <RotateCcw size={14} /> : <Check size={14} />}
          {isPaid ? "Reabrir" : "Pagar"}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="p-2.5 rounded-xl bg-gray-50 text-gray-500 text-xs font-semibold flex items-center justify-center gap-1.5"
        >
          <Edit3 size={14} />
          Editar
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="p-2.5 rounded-xl bg-red-50 text-red-500 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <Trash2 size={14} />
          Excluir
        </button>
        <ChargeMessageButton
          amount={debt.outstandingAmount}
          customerId={debt.customerId}
          daysOverdue={debt.daysOverdue}
          debtId={debt.id}
          debtorName={debt.customerName}
          defaultTone={debt.isOverdue ? "overdue" : "friendly"}
          description={debt.description}
          dueDate={debt.dueDate}
          iconSize={14}
          label="Cobrar"
          phone={debt.customerPhone}
          pixKey={pixKey}
          userId={userId}
          className="p-2.5 rounded-xl bg-green-50 text-green-600 text-xs font-semibold flex items-center justify-center gap-1.5"
        />
      </div>
    </div>
  );
}

function PaymentModal({
  debt,
  onClose,
  onSaved,
  userId,
}: {
  debt: DebtWithCustomer;
  onClose: () => void;
  onSaved?: () => void;
  userId: string;
}) {
  const [mode, setMode] = useState<"total" | "partial">("total");
  const [amount, setAmount] = useState(formatCurrencyInput(String(Math.round(debt.outstandingAmount * 100))));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const parsedAmount = mode === "total" ? debt.outstandingAmount : parseCurrencyInput(amount);

  async function handleSubmit() {
    if (!parsedAmount || parsedAmount <= 0 || parsedAmount > debt.outstandingAmount) {
      setError("Informe um valor valido para este pagamento.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await recordPayment(userId, {
        debtId: debt.id,
        customerId: debt.customerId,
        amount: parsedAmount,
        outstandingAmount: debt.outstandingAmount,
        note: note.trim() || (mode === "total" ? "Pagamento total" : "Pagamento parcial"),
      });
      onSaved?.();
      onClose();
    } catch {
      setError("Nao foi possivel registrar o pagamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[95] bg-black/30 flex items-end justify-center px-4 pb-4 pt-12">
      <button type="button" aria-label="Fechar pagamento" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-[1.4rem] p-5 shadow-2xl space-y-4 page-transition">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Registrar pagamento</p>
            <h2 className="text-lg font-semibold text-gray-950 mt-0.5">{formatCurrency(debt.outstandingAmount)}</h2>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-gray-50 rounded-xl">
          <button
            type="button"
            onClick={() => setMode("total")}
            className={`py-2 rounded-lg text-xs font-semibold ${mode === "total" ? "bg-white text-gray-950 shadow-ios" : "text-gray-400"}`}
          >
            Valor total
          </button>
          <button
            type="button"
            onClick={() => setMode("partial")}
            className={`py-2 rounded-lg text-xs font-semibold ${mode === "partial" ? "bg-white text-gray-950 shadow-ios" : "text-gray-400"}`}
          >
            Parcial
          </button>
        </div>

        {mode === "partial" && (
          <label className="block space-y-1">
            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Valor recebido</span>
            <input
              value={amount}
              onChange={(event) => setAmount(formatCurrencyInput(event.target.value))}
              inputMode="decimal"
              className="w-full p-4 bg-gray-50 rounded-xl text-xl font-semibold"
            />
          </label>
        )}

        <label className="block space-y-1">
          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Observacao</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ex: Pix recebido, dinheiro, sinal..."
            className="w-full p-3 bg-gray-50 rounded-xl text-sm"
          />
        </label>

        {error && <p className="text-sm font-medium text-red-500">{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="w-full p-4 bg-green-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50"
        >
          {saving ? "Registrando..." : mode === "total" ? "Confirmar pagamento total" : "Confirmar parcial"}
        </button>
      </div>
    </div>
  );
}

function CustomerEditForm({
  customerId,
  initialName,
  initialPhone,
  onCancel,
  userId,
}: {
  customerId: string;
  initialName: string;
  initialPhone: string;
  onCancel: () => void;
  userId: string;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(formatPhoneInput(initialPhone));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim() || normalizePhone(phone).length < 10) {
      setError("Informe nome e telefone validos.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await updateCustomer(userId, customerId, {
        name: name.trim(),
        phone,
      });
      onCancel();
    } catch {
      setError("Nao foi possivel atualizar o devedor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card rounded-[14px] p-4 space-y-3">
      <div className="grid grid-cols-1 gap-3">
        <input value={name} onChange={(event) => setName(event.target.value)} className="w-full p-3 bg-gray-50 rounded-xl text-sm" />
        <input
          value={phone}
          onChange={(event) => setPhone(formatPhoneInput(event.target.value))}
          inputMode="tel"
          className="w-full p-3 bg-gray-50 rounded-xl text-sm"
        />
      </div>
      {error && <p className="text-sm font-medium text-red-500">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className="p-3 rounded-xl bg-gray-50 text-gray-500 font-semibold text-sm">
          Cancelar
        </button>
        <button disabled={saving} className="p-3 rounded-xl bg-gray-900 text-white font-semibold text-sm disabled:opacity-50">
          {saving ? "Salvando..." : "Salvar devedor"}
        </button>
      </div>
    </form>
  );
}

function buildInstallmentGroups(debts: DebtWithCustomer[]) {
  const grouped = new Map<
    string,
    {
      description: string;
      debts: DebtWithCustomer[];
      key: string;
    }
  >();

  debts
    .filter((debt) => debt.installmentTotal && debt.installmentTotal > 1)
    .forEach((debt) => {
      const key = debt.installmentGroupKey || `${debt.baseDescription}-${debt.installmentTotal}`;
      const current = grouped.get(key) || {
        description: debt.baseDescription,
        debts: [],
        key,
      };
      current.debts.push(debt);
      grouped.set(key, current);
    });

  return Array.from(grouped.values()).map((group) => {
    const sortedDebts = group.debts.slice().sort((a, b) => (a.installmentIndex || 0) - (b.installmentIndex || 0));
    const openDebts = sortedDebts.filter((debt) => debt.status === "open");
    const nextDebt = openDebts.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    const total = Math.max(...sortedDebts.map((debt) => debt.installmentTotal || sortedDebts.length));

    return {
      ...group,
      debts: sortedDebts,
      nextDebt,
      openDebts,
      paid: sortedDebts.filter((debt) => debt.status === "paid").length,
      outstanding: openDebts.reduce((sum, debt) => sum + debt.outstandingAmount, 0),
      total,
    };
  });
}

function EditDebtForm({
  debt,
  onCancel,
  userId,
}: {
  debt: DebtWithCustomer;
  onCancel: () => void;
  userId?: string;
}) {
  const [amount, setAmount] = useState(String(debt.amount).replace(".", ","));
  const [dueDate, setDueDate] = useState(debt.dueDate);
  const [dailyInterest, setDailyInterest] = useState(String(debt.dailyInterest).replace(".", ","));
  const [description, setDescription] = useState(debt.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) return;

    const parsedAmount = Number(amount.replace(",", "."));
    const parsedInterest = Number(dailyInterest.replace(",", "."));

    if (!parsedAmount || parsedAmount <= 0 || Number.isNaN(parsedInterest) || !dueDate) {
      setError("Confira valor, juros e vencimento.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await updateDebt(userId, debt.id, {
        amount: parsedAmount,
        dueDate,
        dailyInterest: parsedInterest,
        description,
      });
      onCancel();
    } catch {
      setError("Nao foi possivel salvar a edicao.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card rounded-[14px] p-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Valor</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            className="w-full p-3 bg-gray-50 rounded-xl text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Juros dia</span>
          <input
            value={dailyInterest}
            onChange={(event) => setDailyInterest(event.target.value)}
            inputMode="decimal"
            className="w-full p-3 bg-gray-50 rounded-xl text-sm"
          />
        </label>
      </div>
      <label className="space-y-1 block">
        <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Vencimento</span>
        <input
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          type="date"
          className="w-full p-3 bg-gray-50 rounded-xl text-sm"
        />
      </label>
      <label className="space-y-1 block">
        <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Descricao</span>
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="w-full p-3 bg-gray-50 rounded-xl text-sm"
        />
      </label>

      {error && <p className="text-sm font-medium text-red-500">{error}</p>}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="p-3 rounded-xl bg-gray-50 text-gray-500 font-semibold text-sm flex items-center justify-center gap-2"
        >
          <X size={16} />
          Cancelar
        </button>
        <button
          disabled={saving}
          className="p-3 rounded-xl bg-gray-900 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
