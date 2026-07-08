import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Nie znaleziono strony</h2>
        <p className="mt-2 text-sm text-muted-foreground">Ta strona nie istnieje lub została przeniesiona.</p>
        <a href="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Wróć na stronę główną</a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Coś poszło nie tak</h1>
        <p className="mt-2 text-sm text-muted-foreground">Spróbuj ponownie lub wróć na stronę główną.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90">Spróbuj ponownie</button>
          <a href="/" className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent">Strona główna</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Auto-Wieliński — sprawdzone samochody używane" },
      { name: "description", content: "Auto-Wieliński — komis samochodowy. Sprawdzone auta używane w atrakcyjnych cenach." },
      { property: "og:title", content: "Auto-Wieliński" },
      { property: "og:description", content: "Sprawdzone auta używane. Naszą wizytówką są dwa berneńczyki." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:wght@600;700;800&display=swap" },
    ],
    scripts: [
      { src: "https://www.googletagmanager.com/gtag/js?id=G-H9Y59ZP04Y", async: true },
      {
        children:
          "window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-H9Y59ZP04Y', { anonymize_ip: true, send_page_view: false });",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient, router]);

  // Track client-side navigation as separate GA4 page views.
  useEffect(() => {
    const send = (path: string) => {
      const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
      if (typeof gtag !== "function") return;
      gtag("event", "page_view", {
        page_path: path,
        page_location: window.location.href,
        page_title: document.title,
      });
    };
    // Initial load.
    send(router.state.location.href);
    const unsub = router.subscribe("onResolved", ({ toLocation }) => {
      send(toLocation.href);
    });
    return unsub;
  }, [router]);
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
