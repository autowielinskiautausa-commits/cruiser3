import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/hooks/use-auth";
import { Car, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const { isEditor, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Ładowanie...</div>;
  if (!isEditor) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold mb-2">Brak dostępu</h1>
            <p className="text-muted-foreground">Twoje konto nie ma uprawnień do panelu. Skontaktuj się z administratorem.</p>
          </div>
        </main>
      </div>
    );
  }

  const tabs = [
    { to: "/dashboard", label: "Auta", icon: Car, exact: true },
    { to: "/dashboard/new", label: "Dodaj auto", icon: Plus },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-secondary/30">
      <SiteHeader />
      <div className="border-b border-border bg-background">
        <div className="container mx-auto px-4 flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const active = t.exact ? location.pathname === t.to : location.pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors whitespace-nowrap ${
                  active ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="w-4 h-4" /> {t.label}
              </Link>
            );
          })}
        </div>
      </div>
      <main className="container mx-auto px-4 py-8 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
