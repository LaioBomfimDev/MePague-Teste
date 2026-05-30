"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Lock, Mail, User } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<{ message: string; tone: "error" | "success" | "info" }>({
    message: "",
    tone: "info",
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback({ message: "", tone: "info" });

    try {
      if (mode === "register") {
        await register(name.trim(), email.trim(), password);
        setMode("login");
        setName("");
        setPassword("");
        setFeedback({
          message: "Cadastro recebido. Aguarde a aprovacao do superadm para entrar.",
          tone: "success",
        });
      } else {
        await login(email.trim(), password);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel entrar. Confira os dados e tente novamente.";

      setFeedback({
        message,
        tone: message.includes("Aguarde a aprovacao") ? "info" : "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen px-6 py-10 flex flex-col justify-center gap-12 bg-white">
      <header className="flex flex-col items-center text-center">
        <Image src="/logo.jpeg" alt="Me Pague Logo" width={96} height={96} className="rounded-3xl shadow-ios mb-6" />
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
            onClick={() => setMode("login")}
            className={`py-3 rounded-xl text-sm font-semibold transition ${mode === "login" ? "bg-white shadow-ios text-gray-950" : "text-ios-gray"}`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`py-3 rounded-xl text-sm font-semibold transition ${mode === "register" ? "bg-white shadow-ios text-gray-950" : "text-ios-gray"}`}
          >
            Criar conta
          </button>
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
            type={mode === "register" ? "email" : "text"}
            autoCapitalize="none"
            autoCorrect="off"
            placeholder={mode === "register" ? "email@exemplo.com" : "email ou superadm"}
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
