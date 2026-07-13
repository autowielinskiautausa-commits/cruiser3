import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { CarCarousel } from "@/components/car-carousel";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatPLN, formatMileage } from "@/lib/format";
import { LEGAL_DISCLAIMER, FUEL_OPTIONS, TRANSMISSION_OPTIONS } from "@/lib/listing";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useMemo, useEffect } from "react";
import heroBerny from "@/assets/hero-berny.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Auto-Wieliński — sprawdzone samochody używane" },
      { name: "description", content: "Auto-Wieliński — komis samochodowy. Sprawdzone auta w atrakcyjnych cenach. Naszą wizytówką są dwa berneńczyki." },
      { property: "og:title", content: "Auto-Wieliński" },
      { property: "og:image", content: heroBerny },
    ],
  }),
  component: Index,
});

const ALL_BRANDS = "__all_brands__";
const ALL_FUELS = "__all_fuels__";
const ALL_TRANSMISSIONS = "__all_transmissions__";
const CURRENT_YEAR = new Date().getFullYear();
const PER_PAGE_OPTIONS = [12, 24, 36, 48];
const DEFAULT_PER_PAGE = 24;

function Index() {
  const [brand, setBrand] = useState(ALL_BRANDS);
  const [fuel, setFuel] = useState(ALL_FUELS);
  const [transmission, setTransmission] = useState(ALL_TRANSMISSIONS);
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [priceFrom, setPriceFrom] = useState("");
  const [priceTo, setPriceTo] = useState("");
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
  const [page, setPage] = useState(1);

  const { data: cars = [], isLoading } = useQuery({
    queryKey: ["cars-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cars")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Group brands case-insensitively, keeping the first-seen display label.
  const brands = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of cars) {
      if (!c.brand) continue;
      const key = c.brand.trim().toLowerCase();
      if (!map.has(key)) map.set(key, c.brand.trim());
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "pl"));
  }, [cars]);

  const filtered = useMemo(() => {
    const from = yearFrom ? parseInt(yearFrom, 10) : null;
    const to = yearTo ? parseInt(yearTo, 10) : null;
    const pFrom = priceFrom ? parseFloat(priceFrom) : null;
    const pTo = priceTo ? parseFloat(priceTo) : null;
    const brandKey = brand.trim().toLowerCase();
    return cars.filter((c) => {
      if (brand !== ALL_BRANDS && (c.brand ?? "").trim().toLowerCase() !== brandKey) return false;
      if (fuel !== ALL_FUELS && (c.fuel ?? "") !== fuel) return false;
      if (transmission !== ALL_TRANSMISSIONS && (c.transmission ?? "") !== transmission) return false;
      if (from !== null && c.year < from) return false;
      if (to !== null && c.year > to) return false;
      if (pFrom !== null && c.price_pln < pFrom) return false;
      if (pTo !== null && c.price_pln > pTo) return false;
      return true;
    });
  }, [cars, brand, fuel, transmission, yearFrom, yearTo, priceFrom, priceTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * perPage, currentPage * perPage),
    [filtered, currentPage, perPage],
  );

  // Reset to the first page whenever filters or page size change.
  useEffect(() => {
    setPage(1);
  }, [brand, fuel, transmission, yearFrom, yearTo, priceFrom, priceTo, perPage]);

  const hasActiveFilters =
    brand !== ALL_BRANDS ||
    fuel !== ALL_FUELS ||
    transmission !== ALL_TRANSMISSIONS ||
    yearFrom !== "" ||
    yearTo !== "" ||
    priceFrom !== "" ||
    priceTo !== "";

  function clearFilters() {
    setBrand(ALL_BRANDS);
    setFuel(ALL_FUELS);
    setTransmission(ALL_TRANSMISSIONS);
    setYearFrom("");
    setYearTo("");
    setPriceFrom("");
    setPriceTo("");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <section className="relative bg-hero text-primary-foreground overflow-hidden">
        <img
          src={heroBerny}
          alt="Dwa berneńczyki przed bordowym samochodem — wizytówka Auto-Wieliński"
          width={1920}
          height={1080}
          className="absolute inset-0 w-full h-full object-cover opacity-30 md:opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.20_0.08_20)] via-[oklch(0.20_0.08_20)]/70 to-transparent" />
        <div className="container mx-auto px-4 py-20 md:py-28 relative">
          <div className="max-w-2xl">
            <Badge className="mb-4 bg-primary-foreground/10 text-primary-foreground border-0">
              Auto-Wieliński
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-4">
              Sprawdzone auta.<br />
              <span className="opacity-80">Pewny wybór.</span>
            </h1>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-12 flex-1">
        {/* Filter bar */}
        <div className="bg-card border border-border rounded-lg p-4 mb-8 shadow-card">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="min-w-0">
              <Label className="mb-1.5 block text-sm">Marka</Label>
              <Select value={brand} onValueChange={setBrand}>
                <SelectTrigger>
                  <SelectValue placeholder="Wszystkie marki" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_BRANDS}>Wszystkie marki</SelectItem>
                  {brands.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0">
              <Label className="mb-1.5 block text-sm">Rocznik</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1990}
                  max={CURRENT_YEAR}
                  placeholder="Od roku"
                  value={yearFrom}
                  onChange={(e) => setYearFrom(e.target.value)}
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="number"
                  min={1990}
                  max={CURRENT_YEAR}
                  placeholder="Do roku"
                  value={yearTo}
                  onChange={(e) => setYearTo(e.target.value)}
                />
              </div>
            </div>

            <div className="min-w-0">
              <Label className="mb-1.5 block text-sm">Cena (PLN)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  placeholder="Od"
                  value={priceFrom}
                  onChange={(e) => setPriceFrom(e.target.value)}
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="number"
                  min={0}
                  placeholder="Do"
                  value={priceTo}
                  onChange={(e) => setPriceTo(e.target.value)}
                />
              </div>
            </div>

            <div className="min-w-0">
              <Label className="mb-1.5 block text-sm">Paliwo</Label>
              <Select value={fuel} onValueChange={setFuel}>
                <SelectTrigger>
                  <SelectValue placeholder="Wszystkie rodzaje paliwa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FUELS}>Wszystkie rodzaje paliwa</SelectItem>
                  {FUEL_OPTIONS.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0">
              <Label className="mb-1.5 block text-sm">Skrzynia biegów</Label>
              <Select value={transmission} onValueChange={setTransmission}>
                <SelectTrigger>
                  <SelectValue placeholder="Wszystkie skrzynie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TRANSMISSIONS}>Wszystkie skrzynie</SelectItem>
                  {TRANSMISSION_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-3">
              <button
                onClick={clearFilters}
                className="text-sm text-primary hover:underline"
              >
                Wyczyść filtry
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h2 className="text-2xl md:text-3xl font-bold">Aktualne oferty</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? "auto" : "aut"}</span>
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Na stronę</Label>
              <Select value={String(perPage)} onValueChange={(val) => setPerPage(Number(val))}>
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PER_PAGE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-muted h-72 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : cars.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            Nie ma jeszcze ofert. Zajrzyj wkrótce.
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            Brak ogłoszeń spełniających wybrane kryteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginated.map((c) => (
              <Link
                key={c.id}
                to="/auto/$id"
                params={{ id: c.id }}
                className="group bg-card border border-border rounded-lg overflow-hidden shadow-card hover:shadow-elegant transition-all hover:-translate-y-1 flex flex-col"
              >
                <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                  <CarCarousel
                    images={c.images}
                    alt={`${c.brand} ${c.model}`}
                    stopNav
                    className="w-full h-full"
                    imgClassName="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {c.is_sold && (
                    <div className="absolute inset-0 bg-background/70 flex items-center justify-center pointer-events-none">
                      <Badge className="bg-destructive text-destructive-foreground text-base px-4 py-1">Sprzedane</Badge>
                    </div>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-display text-xl font-bold leading-tight mb-1">
                    {c.brand} {c.model}
                  </h3>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-3">
                    <span>{c.year}</span>
                    <span>•</span>
                    <span>{formatMileage(c.mileage_km, c.mileage_unit)}</span>
                    {c.fuel && <><span>•</span><span>{c.fuel}</span></>}
                  </div>
                  <div className="text-2xl font-bold text-primary">{formatPLN(c.price_pln)}</div>
                  <p className="text-xs text-gray-400 mt-4 leading-snug">{LEGAL_DISCLAIMER}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!isLoading && filtered.length > perPage && (
          <div className="flex items-center justify-center gap-3 mt-10">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              aria-label="Poprzednia strona"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Strona {currentPage} z {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Następna strona"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </main>


      <SiteFooter />
    </div>
  );
}
