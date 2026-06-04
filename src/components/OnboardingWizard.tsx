"use client";

import { useState, useMemo, type FormEvent } from "react";
import { ArrowRight, Bell, Check, Key, DollarSign, ArrowLeft, AlertCircle, Download, Share } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { updateUserProfile, createDebtWithCustomer } from "@/lib/database";
import { formatPhoneInput, formatCurrencyInput, parseCurrencyInput } from "@/lib/format";

type OnboardingWizardProps = {
  userName?: string;
  onComplete: () => void;
};

export default function OnboardingWizard({ userName, onComplete }: OnboardingWizardProps) {
  const { user } = useAuth();
  const notifications = usePushNotifications();
  const pwa = usePwaInstall();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Dados Etapa 2: Chave Pix (Essencial)
  const [pixKey, setPixKey] = useState("");

  // Dados Etapa 3: Dívida Opcional
  const [wantsDebt, setWantsDebt] = useState<boolean | null>(null);
  const [debtName, setDebtName] = useState("");
  const [debtPhone, setDebtPhone] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtDueDate, setDebtDueDate] = useState("");

  const stepsArray = useMemo(() => {
    const list = [1, 2, 3, 4];
    if (pwa.supported) {
      list.push(5);
    }
    list.push(6);
    return list;
  }, [pwa.supported]);

  const handleNextStep = () => {
    setError("");
    if (step === 4) {
      if (pwa.supported) {
        setStep(5);
      } else {
        setStep(6);
      }
    } else {
      setStep((prev) => prev + 1);
    }
  };

  const handlePrevStep = () => {
    setError("");
    if (step === 6) {
      if (pwa.supported) {
        setStep(5);
      } else {
        setStep(4);
      }
    } else {
      setStep((prev) => Math.max(1, prev - 1));
    }
  };

  // Salvar Chave Pix (Etapa 2)
  async function handleSavePix(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!pixKey.trim() || pixKey.trim().length < 3) {
      setError("Por favor, insira uma chave Pix válida.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await updateUserProfile(user.id, {
        name: userName || "Meu Perfil",
        pixKey: pixKey.trim(),
      });
      handleNextStep();
    } catch {
      setError("Não foi possível salvar a sua chave Pix no momento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  // Salvar Primeira Dívida (Etapa 3)
  async function handleSaveDebt(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (!debtName.trim()) {
      setError("Por favor, insira o nome de quem deve.");
      return;
    }
    if (!debtPhone.trim()) {
      setError("Por favor, insira o WhatsApp do devedor.");
      return;
    }
    
    const parsedAmount = parseCurrencyInput(debtAmount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Por favor, insira um valor válido acima de R$ 0,00.");
      return;
    }
    if (!debtDueDate) {
      setError("Por favor, informe a data de vencimento.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await createDebtWithCustomer(user.id, {
        name: debtName.trim(),
        phone: debtPhone.trim(),
        amount: parsedAmount,
        dueDate: debtDueDate,
        dailyInterest: 1.5, // Padrão
        description: "Cobrança inicial",
        installments: 1,
      });
      handleNextStep();
    } catch {
      setError("Não foi possível cadastrar a dívida. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  // Ativar Notificações (Etapa 4)
  async function handleEnableNotifications() {
    setLoading(true);
    setError("");
    try {
      await notifications.enable();
      handleNextStep();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ativar notificações.");
      // Mesmo com erro de permissão do navegador, permite avançar para não prender o usuário
      setTimeout(() => {
        handleNextStep();
      }, 1500);
    } finally {
      setLoading(false);
    }
  }

  // Pular Notificações (Etapa 4)
  const handleSkipNotifications = () => {
    notifications.dismissPrompt();
    handleNextStep();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeInModal">
      <div className="relative w-full max-w-md bg-white rounded-[2rem] shadow-ios-lg overflow-hidden flex flex-col max-h-[90vh] animate-modalRise">
        
        {/* Indicador de Etapas */}
        <div className="px-6 pt-6 pb-2 flex gap-1.5 shrink-0">
          {stepsArray.map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                s <= step ? "bg-gray-900" : "bg-gray-100"
              }`}
            />
          ))}
        </div>

        {/* Botão de Voltar (se aplicável) */}
        {step > 1 && step < 6 && (
          <button
            onClick={handlePrevStep}
            disabled={loading}
            className="absolute left-6 top-10 w-9 h-9 bg-gray-50 text-gray-500 rounded-xl flex items-center justify-center btn-press hover:bg-gray-100 transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
        )}

        {/* Conteúdo das Etapas */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          
          {/* Passo 1: Boas-vindas */}
          {step === 1 && (
            <div className="space-y-6 text-center py-6 page-slide-left">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Logo Me Pague" className="h-full w-full object-cover" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
                  Bem-vindo ao Me Pague!
                </h2>
                <p className="text-sm text-gray-500 max-w-[280px] mx-auto leading-relaxed">
                  Para começar a cobrar e organizar seus recebimentos, vamos fazer um rápido tutorial de configuração inicial.
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl text-left text-xs text-gray-600 space-y-2 border border-gray-100">
                <p className="font-semibold text-gray-800">Neste fluxo vamos configurar:</p>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  <span>Sua chave Pix <strong>(essencial para cobrança)</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  <span>Sua primeira dívida a receber (opcional)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  <span>Notificações automáticas no seu aparelho (opcional)</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleNextStep}
                className="w-full min-h-12 bg-gray-900 text-white rounded-xl font-semibold flex items-center justify-center gap-2 btn-press shadow-md"
              >
                Começar Tutorial
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Passo 2: Chave Pix */}
          {step === 2 && (
            <form onSubmit={handleSavePix} className="space-y-6 py-6 page-slide-left">
              <div className="text-center space-y-2">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm">
                  <Key size={30} />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Sua Chave Pix</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Ela é <strong>essencial</strong> para que seus clientes paguem diretamente a você. Sem ela, você não conseguirá gerar cobranças.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide ml-0.5">
                  Chave Pix (CPF, Celular, E-mail ou Aleatória)
                </label>
                <input
                  type="text"
                  required
                  disabled={loading}
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="Ex: seu-email@exemplo.com ou CPF"
                  className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-xl text-sm placeholder:text-gray-300 focus:bg-white transition-all outline-none focus:ring-2 focus:ring-gray-200"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 text-xs text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !pixKey.trim()}
                className="w-full min-h-12 bg-gray-900 text-white rounded-xl font-semibold flex items-center justify-center gap-2 btn-press shadow-md disabled:opacity-50"
              >
                {loading ? "Salvando..." : "Salvar e Continuar"}
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* Passo 3: Primeira Dívida Opcional */}
          {step === 3 && (
            <div className="space-y-6 py-4 page-slide-left">
              {wantsDebt === null ? (
                <div className="space-y-6 py-6 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 text-green-600 shadow-sm">
                    <DollarSign size={30} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-gray-900">Cadastrar primeira cobrança?</h2>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      Deseja cadastrar sua primeira dívida a receber agora? O processo é rápido e você já começa a usar de imediato.
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setWantsDebt(true)}
                      className="w-full min-h-12 bg-gray-900 text-white rounded-xl font-semibold flex items-center justify-center btn-press shadow-md"
                    >
                      Sim, cadastrar cobrança
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWantsDebt(false);
                        handleNextStep();
                      }}
                      className="w-full min-h-12 bg-gray-50 text-gray-600 rounded-xl font-semibold flex items-center justify-center btn-press hover:bg-gray-100 transition-colors"
                    >
                      Pular esta etapa
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveDebt} className="space-y-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Nova Cobrança</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Preencha os dados do cliente e o valor.</p>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide ml-0.5">Nome do Cliente</label>
                      <input
                        type="text"
                        required
                        disabled={loading}
                        value={debtName}
                        onChange={(e) => setDebtName(e.target.value)}
                        placeholder="Ex: João da Silva"
                        className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm placeholder:text-gray-300 focus:bg-white transition-all outline-none focus:ring-2 focus:ring-gray-200"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide ml-0.5">WhatsApp / Telefone</label>
                      <input
                        type="tel"
                        required
                        disabled={loading}
                        value={debtPhone}
                        onChange={(e) => setDebtPhone(formatPhoneInput(e.target.value))}
                        placeholder="(00) 00000-0000"
                        className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm placeholder:text-gray-300 focus:bg-white transition-all outline-none focus:ring-2 focus:ring-gray-200"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide ml-0.5">Valor Total (R$)</label>
                        <input
                          type="text"
                          required
                          disabled={loading}
                          inputMode="decimal"
                          value={debtAmount}
                          onChange={(e) => setDebtAmount(formatCurrencyInput(e.target.value))}
                          placeholder="0,00"
                          className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm placeholder:text-gray-300 focus:bg-white transition-all outline-none focus:ring-2 focus:ring-gray-200"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide ml-0.5">Vencimento</label>
                        <input
                          type="date"
                          required
                          disabled={loading}
                          value={debtDueDate}
                          onChange={(e) => setDebtDueDate(e.target.value)}
                          className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-600 focus:bg-white transition-all outline-none focus:ring-2 focus:ring-gray-200"
                        />
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 text-xs text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="pt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setWantsDebt(null)}
                      disabled={loading}
                      className="min-h-12 bg-gray-50 text-gray-600 rounded-xl font-semibold flex items-center justify-center btn-press hover:bg-gray-100 transition-colors"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="min-h-12 bg-gray-900 text-white rounded-xl font-semibold flex items-center justify-center btn-press shadow-md"
                    >
                      {loading ? "Salvando..." : "Salvar e Avançar"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Passo 4: Notificações */}
          {step === 4 && (
            <div className="space-y-6 py-6 text-center page-slide-left">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 shadow-sm animate-bounce">
                <Bell size={30} />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">Receber avisos diários?</h2>
                <p className="text-sm text-gray-500 leading-relaxed max-w-[280px] mx-auto">
                  Ative as notificações para receber avisos sobre recebimentos de amanhã e pendências diariamente às 8h.
                </p>
              </div>

              {error && (
                <div className="text-xs text-red-500 bg-red-50 p-3 rounded-xl border border-red-100 max-w-xs mx-auto">
                  {error}
                </div>
              )}

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleEnableNotifications}
                  disabled={loading}
                  className="w-full min-h-12 bg-gray-900 text-white rounded-xl font-semibold flex items-center justify-center gap-2 btn-press shadow-md"
                >
                  <Bell size={16} />
                  {loading ? "Ativando..." : "Ativar Notificações"}
                </button>
                <button
                  type="button"
                  onClick={handleSkipNotifications}
                  disabled={loading}
                  className="w-full min-h-12 bg-gray-50 text-gray-600 rounded-xl font-semibold flex items-center justify-center btn-press hover:bg-gray-100 transition-colors"
                >
                  Agora não
                </button>
              </div>
            </div>
          )}

          {/* Passo 5: Atalho na Tela Inicial (PWA) */}
          {step === 5 && (
            <div className="space-y-6 py-6 text-center page-slide-left">
              <div className="mx-auto h-16 w-16 overflow-hidden rounded-2xl bg-white shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Logo Me Pague" className="h-full w-full object-cover" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">Ter o aplicativo no seu celular?</h2>
                <p className="text-sm text-gray-500 leading-relaxed max-w-[320px] mx-auto">
                  Para acessar o <strong>Me Pague</strong> rapidamente com apenas um toque, adicione um atalho na sua tela inicial. Ele funciona igual a um aplicativo comum, mas é levinho e não ocupa a memória do seu aparelho!
                </p>
              </div>

              {pwa.isIOS && (
                <div className="bg-gray-50 p-4 rounded-2xl text-left text-xs text-gray-600 space-y-3 border border-gray-100 max-w-xs mx-auto">
                  <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                    <Share size={14} className="text-blue-500" />
                    Como adicionar no iPhone:
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-gray-500">
                    <li>
                      Toque no botão de <strong>Compartilhar</strong> (ícone de quadrado com seta para cima no Safari).
                    </li>
                    <li>
                      Role a lista de opções para baixo e selecione <strong>Adicionar à Tela de Início</strong>.
                    </li>
                  </ol>
                </div>
              )}

              <div className="space-y-3 pt-2">
                {!pwa.isIOS && (
                  <button
                    type="button"
                    onClick={async () => {
                      setLoading(true);
                      const installed = await pwa.install();
                      setLoading(false);
                      if (installed) {
                        handleNextStep();
                      }
                    }}
                    disabled={loading}
                    className="w-full min-h-12 bg-gray-900 text-white rounded-xl font-semibold flex items-center justify-center gap-2 btn-press shadow-md"
                  >
                    <Download size={16} />
                    {loading ? "Adicionando..." : "Adicionar à Tela Inicial"}
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={loading}
                  className="w-full min-h-12 bg-gray-50 text-gray-600 rounded-xl font-semibold flex items-center justify-center btn-press hover:bg-gray-100 transition-colors"
                >
                  {pwa.isIOS ? "Concluir e Acessar" : "Agora não"}
                </button>
              </div>
            </div>
          )}

          {/* Passo 6: Conclusão */}
          {step === 6 && (
            <div className="space-y-6 py-6 text-center page-slide-left">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 text-green-600 shadow-sm">
                <Check size={30} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900">Tudo Pronto!</h2>
                <p className="text-sm text-gray-500 leading-relaxed max-w-[280px] mx-auto">
                  Você completou a configuração inicial do Me Pague e cadastrou seus dados essenciais. O aplicativo está pronto para ser usado por completo!
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl text-left text-xs text-gray-600 space-y-1.5 border border-gray-100 max-w-xs mx-auto">
                <p className="font-semibold text-gray-800">Dica rápida:</p>
                <p>Toque no botão &quot;+&quot; no canto inferior direito para adicionar novas cobranças a qualquer momento.</p>
              </div>

              <button
                type="button"
                onClick={onComplete}
                className="w-full min-h-12 bg-green-500 text-white rounded-xl font-semibold flex items-center justify-center btn-press shadow-md hover:bg-green-600 transition-colors"
              >
                Acessar Dashboard
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
