"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Lock, Mail, User } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (mode === "register") {
        await register(name.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
    } catch {
      setError("Nao foi possivel entrar. Confira os dados e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen px-6 py-10 flex flex-col justify-between bg-white">
      <header className="space-y-3 pt-8">
        <div className="w-14 h-14 rounded-2xl bg-gray-900 text-white flex items-center justify-center font-bold text-xl">
          MP
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-950">Me Pague</h1>
          <p className="text-sm text-ios-gray mt-1">
            Controle e cobre dividas pelo WhatsApp sem perder o fio da meada.
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
            placeholder={mode === "register" ? "email@exemplo.com" : "email@exemplo.com"}
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

        {error && <p className="text-sm font-medium text-red-500">{error}</p>}


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
