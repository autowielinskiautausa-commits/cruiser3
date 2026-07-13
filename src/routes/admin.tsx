import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: AdminLogin,
});

type Mode = "signin" | "forgot" | "register";

function AdminLogin() {
  const navigate = useNavigate();

  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  // null = unknown/loading, true/false once checked
  const [adminExists, setAdminExists] = useState<boolean | null>(null);

  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
    // Check whether an admin account already exists (portable DB function).
    supabase.rpc("admin_exists").then(({ data, error }) => {
      if (error) {
        console.error("Nie udało się sprawdzić istnienia administratora", error);
        // Fail safe: assume an admin exists so we don't expose registration.
        setAdminExists(true);
        return;
      }
      setAdminExists(Boolean(data));
    });
  }, [navigate]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setLoading(false);
    if (error) return toast.error("Błąd rejestracji", { description: error.message });
    if (data.session) {
      toast.success("Konto administratora utworzone");
      navigate({ to: "/dashboard" });
    } else {
      toast.success("Konto utworzone", {
        description: "Potwierdź adres e-mail, a następnie zaloguj się.",
      });
      setAdminExists(true);
      setMode("signin");
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error("Błąd logowania", { description: error.message });
    navigate({ to: "/dashboard" });
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error("Błąd", { description: error.message });
    toast.success("Wysłano link do resetu hasła", {
      description: "Sprawdź swoją skrzynkę e-mail.",
    });
    setMode("signin");
  }

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 px-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-lg shadow-card p-8">
        {mode === "signin" && (
          <>
            <h1 className="text-xl font-semibold mb-6 text-center">Panel administratora</h1>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div>
                <Label htmlFor="password">Hasło</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Logowanie..." : "Zaloguj się"}
              </Button>
            </form>
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              Nie pamiętasz hasła?
            </button>
            {adminExists === false && (
              <button
                type="button"
                onClick={() => setMode("register")}
                className="mt-2 w-full text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
              >
                Brak konta administratora — utwórz pierwsze konto
              </button>
            )}
          </>
        )}

        {mode === "register" && (
          <>
            <h1 className="text-xl font-semibold mb-2 text-center">Utwórz konto administratora</h1>
            <p className="text-sm text-muted-foreground mb-6 text-center">
              To jednorazowa rejestracja pierwszego administratora. Po jej utworzeniu opcja zniknie.
            </p>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div>
                <Label htmlFor="password">Hasło</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Tworzenie..." : "Utwórz konto"}
              </Button>
            </form>
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              Wróć do logowania
            </button>
          </>
        )}

        {mode === "forgot" && (
          <>
            <h1 className="text-xl font-semibold mb-2 text-center">Reset hasła</h1>
            <p className="text-sm text-muted-foreground mb-6 text-center">
              Podaj e-mail, a wyślemy link do zmiany hasła.
            </p>
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Wysyłanie..." : "Wyślij link"}
              </Button>
            </form>
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              Wróć do logowania
            </button>
          </>
        )}
      </div>
    </div>
  );
}
