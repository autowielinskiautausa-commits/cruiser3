import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo-berny.png";

export function SiteHeader() {
  const { user, isEditor } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const inPanel = location.pathname.startsWith("/dashboard");


  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-40">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="Auto-Wieliński — logo z dwoma berneńczykami" width={48} height={48} className="w-12 h-12 object-contain" />
          <div className="leading-tight">
            <div className="font-display text-xl md:text-2xl font-bold tracking-tight">Auto-Wieliński</div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Sprawdzone auta</div>
          </div>
        </Link>
        <nav className="flex items-center gap-3">
          {isEditor && (
            <Link to="/dashboard" className="text-sm hover:text-primary transition-colors">Panel</Link>
          )}
          {isEditor && inPanel && (
            <Link to="/" className="text-sm hover:text-primary transition-colors">Oferty</Link>
          )}
          {user && (
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Wyloguj
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border mt-20">
      <div className="container mx-auto px-4 py-8 text-sm text-muted-foreground flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" width={32} height={32} className="w-8 h-8 object-contain opacity-80" />
          <span>© {new Date().getFullYear()} Auto-Wieliński</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground/80">Kontakt:</span>
          <a href="tel:+48511106626" className="hover:text-primary transition-colors flex items-center gap-1">
            <span>Wiktor:</span> <span className="font-medium text-foreground">511 106 626</span>
          </a>
          <a href="tel:+48691962888" className="hover:text-primary transition-colors flex items-center gap-1">
            <span>Bogumił:</span> <span className="font-medium text-foreground">691 962 888</span>
          </a>
          <a href="tel:+48784404243" className="hover:text-primary transition-colors flex items-center gap-1">
            <span>Patryk:</span> <span className="font-medium text-foreground">784 404 243</span>
          </a>
        </div>
      </div>
      <div className="container mx-auto px-4 pb-8">
        <details className="text-xs text-muted-foreground/70">
          <summary className="cursor-pointer select-none hover:text-muted-foreground transition-colors">
            Informacja o przetwarzaniu danych (RODO) i plikach cookie
          </summary>
          <div className="mt-3 space-y-2 leading-relaxed max-w-3xl">
            <p>
              Zgodnie z art. 13 rozporządzenia Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia
              27 kwietnia 2016 r. (RODO) informujemy, że administratorem Państwa danych osobowych jest
              Auto-Wieliński. Kontakt w sprawach dotyczących danych osobowych możliwy jest pod numerami
              telefonów podanymi powyżej.
            </p>
            <p>
              Niniejsza strona korzysta z narzędzia Google Analytics 4 w celu tworzenia anonimowych
              statystyk odwiedzin, które pomagają nam ulepszać serwis. Dane zbierane są w formie
              zanonimizowanej — adres IP jest anonimizowany (anonymize_ip), a informacje nie pozwalają
              na bezpośrednią identyfikację użytkownika. Podstawą przetwarzania jest nasz prawnie
              uzasadniony interes (art. 6 ust. 1 lit. f RODO) polegający na analizie ruchu w serwisie.
            </p>
            <p>
              Google Analytics wykorzystuje pliki cookie. Mogą Państwo w każdej chwili zablokować lub
              usunąć pliki cookie w ustawieniach swojej przeglądarki, a także zainstalować dodatek
              blokujący Google Analytics (
              <a
                href="https://tools.google.com/dlpage/gaoptout"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-primary"
              >
                tools.google.com/dlpage/gaoptout
              </a>
              ). Przysługuje Państwu prawo dostępu do danych, ich sprostowania, usunięcia lub
              ograniczenia przetwarzania oraz prawo wniesienia sprzeciwu, a także skargi do Prezesa
              Urzędu Ochrony Danych Osobowych.
            </p>
          </div>
        </details>
      </div>
    </footer>
  );
}
