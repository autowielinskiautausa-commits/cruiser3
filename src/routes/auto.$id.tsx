import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { CarImage } from "@/components/car-image";
import { getSignedUrl } from "@/lib/storage";
import { formatPLN, formatMileage } from "@/lib/format";
import { LEGAL_DISCLAIMER, resolveVideo } from "@/lib/listing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, ArrowLeft, Calendar, Gauge, Fuel, Cog, Zap, Palette, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/auto/$id")({
  component: CarDetail,
});

function CarDetail() {
  const { id } = Route.useParams();
  const [active, setActive] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string>("");

  const { data: car, isLoading } = useQuery({
    queryKey: ["car", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  useEffect(() => {
    if (car?.video_url) {
      if (car.video_url.startsWith("http")) setVideoUrl(car.video_url);
      else getSignedUrl(car.video_url, 7200).then(setVideoUrl);
    }
  }, [car?.video_url]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Ładowanie...</div>;
  if (!car) return null;

  const video = videoUrl ? resolveVideo(videoUrl) : null;

  const specs = [
    { icon: Calendar, label: "Rok", value: car.year },
    { icon: Gauge, label: "Przebieg", value: formatMileage(car.mileage_km, car.mileage_unit) },
    car.fuel && { icon: Fuel, label: "Paliwo", value: car.fuel },
    car.transmission && { icon: Cog, label: "Skrzynia", value: car.transmission },
    car.power_hp && { icon: Zap, label: "Moc", value: `${car.power_hp} KM` },
    car.engine_capacity_cm3 && { icon: Cog, label: "Pojemność", value: `${car.engine_capacity_cm3} cm³` },
  ].filter(Boolean) as { icon: typeof Calendar; label: string; value: string | number }[];

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="container mx-auto px-4 py-8 flex-1">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Wróć do ofert
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden shadow-card">
              <CarImage path={car.images?.[active]} alt={`${car.brand} ${car.model}`} className="w-full h-full object-cover" />
              {car.images?.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Poprzednie zdjęcie"
                    onClick={() => setActive((i) => (i - 1 + car.images.length) % car.images.length)}
                    className="absolute top-1/2 left-3 -translate-y-1/2 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-background/70 text-foreground backdrop-blur-sm shadow-md hover:bg-background/90 active:bg-background touch-manipulation"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    type="button"
                    aria-label="Następne zdjęcie"
                    onClick={() => setActive((i) => (i + 1) % car.images.length)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-background/70 text-foreground backdrop-blur-sm shadow-md hover:bg-background/90 active:bg-background touch-manipulation"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
              {car.is_sold && (
                <div className="absolute top-4 left-4 z-10">
                  <Badge className="bg-destructive text-destructive-foreground text-base px-4 py-1">Sprzedane</Badge>
                </div>
              )}
            </div>
            {car.images?.length > 1 && (
              <div className="grid grid-cols-5 gap-2">
                {car.images.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    className={`aspect-square rounded-md overflow-hidden border-2 transition-all ${
                      i === active ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <CarImage path={p} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {video && (
              <div className="rounded-lg overflow-hidden shadow-card">
                <h3 className="text-lg font-semibold mb-3 mt-6">Wideo prezentacja</h3>
                {video.kind === "youtube" ? (
                  <iframe
                    src={video.src}
                    className="w-full aspect-video"
                    allowFullScreen
                  />
                ) : (
                  <video src={video.src} controls className="w-full aspect-video bg-black" />
                )}
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight">
                {car.brand} {car.model}
              </h1>
              <p className="text-muted-foreground mt-1">{car.year} • {formatMileage(car.mileage_km, car.mileage_unit)}</p>
            </div>

            <div className="text-4xl font-bold text-primary">{formatPLN(car.price_pln)}</div>

            {car.phone && !car.is_sold && (
              <a href={`tel:${car.phone}`}>
                <Button size="lg" className="w-full h-14 text-base">
                  <Phone className="w-5 h-5 mr-2" /> {car.phone}
                </Button>
              </a>
            )}

            <div className="grid grid-cols-2 gap-3 bg-card border border-border rounded-lg p-4">
              {specs.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <s.icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                    <div className="text-sm font-medium truncate">{s.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {car.description && (
              <div>
                <h3 className="font-semibold mb-2">Opis</h3>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">{car.description}</p>
              </div>
            )}

            <p className="text-xs text-gray-400 leading-snug border-t border-border pt-4">{LEGAL_DISCLAIMER}</p>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
