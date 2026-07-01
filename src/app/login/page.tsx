"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") || "/";

  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Falha ao entrar.");
        return;
      }
      // Navega para a rota original protegida.
      router.replace(from.startsWith("/") ? from : "/");
      router.refresh();
    } catch {
      setError("Falha de conexão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
      <h1 className="mb-1 text-center text-3xl font-bold tracking-tight">
        Cyfra<span className="text-accent">.</span>
      </h1>
      <p className="mb-8 text-center text-sm text-muted">
        Entre para continuar.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          autoFocus
          autoComplete="username"
          placeholder="Usuário"
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none placeholder:text-muted focus:border-accent"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
          placeholder="Senha"
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none placeholder:text-muted focus:border-accent"
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading || !user || !password}
          className="mt-2 rounded-xl bg-accent px-4 py-3 font-semibold text-black transition active:opacity-80 disabled:opacity-40"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
