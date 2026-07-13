import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CarImage } from "@/components/car-image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPLN, formatMileage } from "@/lib/format";
import { Pencil, Trash2, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { removeCarMedia } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: AdminList,
});

function AdminList() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const { data: cars = [], isLoading } = useQuery({
    queryKey: ["admin-cars"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function handleDelete(id: string, images: string[]) {
    if (!confirm("Na pewno usunąć to ogłoszenie?")) return;
    const { error } = await supabase.from("cars").delete().eq("id", id);
    if (error) return toast.error("Nie udało się usunąć", { description: error.message });
    await Promise.all((images ?? []).map((p) => removeCarMedia(p)));
    toast.success("Usunięto ogłoszenie");
    qc.invalidateQueries({ queryKey: ["admin-cars"] });
    qc.invalidateQueries({ queryKey: ["cars-public"] });
  }

  async function toggleSold(id: string, current: boolean) {
    const { error } = await supabase.from("cars").update({ is_sold: !current }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-cars"] });
    qc.invalidateQueries({ queryKey: ["cars-public"] });
  }

  if (isLoading) return <div>Ładowanie...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display text-3xl font-bold">Ogłoszenia ({cars.length})</h1>
        <Link to="/dashboard/new"><Button>Dodaj auto</Button></Link>
      </div>

      {cars.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center text-muted-foreground">
          Nie masz jeszcze żadnych ogłoszeń.{" "}
          <Link to="/dashboard/new" className="text-primary underline">Dodaj pierwsze</Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {cars.map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-lg p-3 flex gap-4 items-center shadow-card">
              <div className="w-24 h-20 rounded-md overflow-hidden bg-muted shrink-0">
                <CarImage path={c.images?.[0]} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold truncate">{c.brand} {c.model}</h3>
                  {c.is_sold && <Badge variant="destructive">Sprzedane</Badge>}
                </div>
                <div className="text-sm text-muted-foreground">
                  {c.year} • {formatMileage(c.mileage_km, c.mileage_unit)} • <span className="text-primary font-semibold">{formatPLN(c.price_pln)}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => toggleSold(c.id, c.is_sold)}>
                  {c.is_sold ? "Wznów" : "Sprzedane"}
                </Button>
                <Link to="/auto/$id" params={{ id: c.id }}>
                  <Button variant="ghost" size="icon"><ExternalLink className="w-4 h-4" /></Button>
                </Link>
                <Link to="/dashboard/edit/$id" params={{ id: c.id }}>
                  <Button variant="ghost" size="icon"><Pencil className="w-4 h-4" /></Button>
                </Link>
                {isAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id, c.images)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
