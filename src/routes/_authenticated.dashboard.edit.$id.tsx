import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CarForm } from "@/components/car-form";

export const Route = createFileRoute("/_authenticated/dashboard/edit/$id")({
  component: EditCar,
});

function EditCar() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["car-edit", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (isLoading) return <div>Ładowanie...</div>;
  if (!data) return <div>Nie znaleziono</div>;
  return <CarForm id={id} initial={{
    ...data,
    fuel: data.fuel ?? "",
    transmission: data.transmission ?? "",
    body_type: data.body_type ?? "",
    color: data.color ?? "",
    phone: data.phone ?? "",
    description: data.description ?? "",
    video_url: data.video_url ?? "",
    price_pln: Number(data.price_pln),
  }} />;
}
