"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Lock, Mail, User } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/components/AuthProvider";
import ThemeSelector from "@/components/ThemeSelector";

type Feedback = {
  message: string;
  tone: "error" | "success" | "info";
};

const GOOGLE_OAUTH_PENDING_KEY = "me-pague:google-oauth-pending";

function getGoogleOAuthPending() {
  try {
    return window.sessionStorage.getItem(GOOGLE_OAUTH_PENDING_KEY) === "true";
  } catch {
    return false;
  }
}

function setGoogleOAuthPending(enabled: boolean) {
  try {
    if (enabled) {
      window.sessionStorage.setItem(GOOGLE_OAUTH_PENDING_KEY, "true");
      return;
    }

    window.sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);
  } catch {
    // Storage can be unavailable in restricted browser contexts; OAuth still works without this hint.
  }
}

function getAuthFeedback(error: unknown, mode: "login" | "register"): Feedback {
  const message = error instanceof Error ? error.message : "";
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";

  if (mode === "register" && (code === "user_already_exists" || /already registered/i.test(message))) {
    return {
      message: "Esse email ja tem cadastro. Entre pela aba Entrar.",
      tone: "info",
    };
  }

  if (message.toLowerCase().includes("aguardando revisao")) {
    return { message, tone: "info" };
  }

  if (message) {
    return { message, tone: "error" };
  }

  return {
    message:
      mode === "register"
        ? "Nao foi possivel criar sua conta. Confira os dados e tente novamente."
        : "Nao foi possivel entrar. Confira os dados e tente novamente.",
    tone: "error",
  };
}

export default function LoginPage() {
  const { authNotice, clearAuthNotice, login, loginWithGoogle, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<{ message: string; tone: "error" | "success" | "info" }>({
    message: "",
    tone: "info",
  });
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const oauthError = params.get("error_description");

    if (oauthError) {
      setGoogleOAuthPending(false);
      setFeedback({ message: oauthError, tone: "error" });
      return;
    }

    if (getGoogleOAuthPending()) {
      setGoogleOAuthPending(false);
      setFeedback({ message: "Validando login do Google...", tone: "info" });
    }
  }, []);

  useEffect(() => {
    if (authNotice) {
      setFeedback(authNotice);
    }
  }, [authNotice]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    clearAuthNotice();
    setFeedback({ message: "", tone: "info" });

    try {
      if (mode === "register") {
        const result = await register(name.trim(), email.trim(), password);
        setName("");
        setPassword("");

        if (result.signedIn) {
          setFeedback({ message: "Conta criada. Entrando...", tone: "success" });
        } else {
          setMode("login");
          setFeedback({
            message: "Conta criada. Se receber um email de confirmacao, confirme antes de entrar.",
            tone: "success",
          });
        }
      } else {
        await login(email.trim(), password);
      }
    } catch (error) {
      setFeedback(getAuthFeedback(error, mode));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setGoogleSubmitting(true);
    clearAuthNotice();
    setFeedback({ message: "Abrindo login do Google...", tone: "info" });
    setGoogleOAuthPending(true);

    try {
      await loginWithGoogle();
    } catch (error) {
      setGoogleOAuthPending(false);
      setFeedback(getAuthFeedback(error, mode));
      setGoogleSubmitting(false);
    }
  }

  function selectMode(nextMode: "login" | "register") {
    setMode(nextMode);
    clearAuthNotice();
    setFeedback({ message: "", tone: "info" });
  }

  return (
    <div className="relative min-h-screen px-6 py-10 flex flex-col justify-center gap-12 bg-white">
      <div className="absolute right-6 top-6">
        <ThemeSelector />
      </div>

      <header className="flex flex-col items-center text-center">
        <Image src="/logo.png" alt="Me Pague Logo" width={96} height={96} className="rounded-3xl shadow-ios mb-6" />
        <div>
          <h1 className="text-[2rem] font-extrabold tracking-tight text-gray-950">Me Pague</h1>
          <p className="text-[15px] text-ios-gray mt-3 max-w-[300px] mx-auto leading-relaxed">
            Feito para pessoas comuns e pequenos negócios. Aposente o caderninho e receba de quem te deve sem estresse.
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-2xl">
          <button
            type="button"
            onClick={() => selectMode("login")}
            className={`py-3 rounded-xl text-sm font-semibold transition ${mode === "login" ? "bg-white shadow-ios text-gray-950" : "text-ios-gray"}`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => selectMode("register")}
            className={`py-3 rounded-xl text-sm font-semibold transition ${mode === "register" ? "bg-white shadow-ios text-gray-950" : "text-ios-gray"}`}
          >
            Criar conta
          </button>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={submitting || googleSubmitting}
          className="w-full p-4 bg-white border border-gray-100 text-gray-900 rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 shadow-ios"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-sm font-black leading-none text-[#4285F4] ring-1 ring-gray-200">
            G
          </span>
          {googleSubmitting
            ? "Abrindo Google..."
            : mode === "register"
              ? "Criar conta com Google"
              : "Entrar com Google"}
        </button>

        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-gray-100" />
          <span className="text-[11px] font-semibold uppercase text-ios-gray">ou</span>
          <span className="h-px flex-1 bg-gray-100" />
        </div>

        {mode === "register" && (
          <label className="block relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              placeholder="Seu nome"
              className="w-full pl-11 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-ios-blue/20"
            />
          </label>
        )}

        <label className="block relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="email@exemplo.com"
            className="w-full pl-11 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-ios-blue/20"
          />
        </label>

        <label className="block relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
            type="password"
            placeholder="Senha"
            className="w-full pl-11 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-ios-blue/20"
          />
        </label>

        {feedback.message && (
          <p
            className={`text-sm font-medium ${
              feedback.tone === "error" ? "text-red-500" : feedback.tone === "success" ? "text-green-600" : "text-gray-600"
            }`}
          >
            {feedback.message}
          </p>
        )}


        <button
          disabled={submitting}
          className="w-full p-4 bg-gray-900 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {submitting ? "Aguarde..." : mode === "register" ? "Comecar agora" : "Entrar"}
          {!submitting && <ArrowRight size={18} />}
        </button>
      </form>
    </div>
  );
}
