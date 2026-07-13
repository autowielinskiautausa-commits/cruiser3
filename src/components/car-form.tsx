import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CarImage } from "@/components/car-image";
import { uploadCarMedia, removeCarMedia, uploadCarImage } from "@/lib/storage";
import { toast } from "sonner";
import { X, Upload, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FUEL_OPTIONS, TRANSMISSION_OPTIONS, isAllowedVideoInput } from "@/lib/listing";

export type CarFormValues = {
  brand: string;
  model: string;
  year: number | null;
  mileage_km: number | null;
  price_pln: number | null;
  fuel: string;
  transmission: string;
  power_hp: number | null;
  engine_capacity_cm3: number | null;
  body_type: string;
  color: string;
  phone: string;
  description: string;
  images: string[];
  video_url: string;
  is_sold: boolean;
  mileage_unit: string;
};

const empty: CarFormValues = {
  brand: "", model: "", year: null, mileage_km: null, price_pln: null,
  fuel: "", transmission: "", power_hp: null, engine_capacity_cm3: null,
  body_type: "", color: "", phone: "", description: "",
  images: [], video_url: "", is_sold: false, mileage_unit: "km",
};



export function CarForm({ id, initial }: { id?: string; initial?: Partial<CarFormValues> }) {
  const [v, setV] = useState<CarFormValues>({ ...empty, ...initial });
  const [mileageUnit, setMileageUnit] = useState<"km" | "mi">((initial?.mileage_unit as "km" | "mi") || "km");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (initial) {
      setV({ ...empty, ...initial });
      setMileageUnit((initial.mileage_unit as "km" | "mi") || "km");
    }
  }, [initial]);

  const set = <K extends keyof CarFormValues>(k: K, val: CarFormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const paths: string[] = [];
      for (const f of Array.from(files)) {
        if (f.size > 20 * 1024 * 1024) {
          toast.error(`${f.name} jest zbyt duży (max 20MB)`);
          continue;
        }
        paths.push(await uploadCarImage(f));
      }
      set("images", [...v.images, ...paths]);
    } catch (e) {
      toast.error("Błąd wgrywania", { description: (e as Error).message });
    } finally { setUploading(false); }
  }

  async function removeImg(i: number) {
    const path = v.images[i];
    set("images", v.images.filter((_, idx) => idx !== i));
    removeCarMedia(path);
  }

  async function handleVideo(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) return toast.error("Wideo zbyt duże (max 100MB)");
    setUploading(true);
    try {
      const path = await uploadCarMedia(file);
      if (v.video_url && !v.video_url.startsWith("http")) await removeCarMedia(v.video_url);
      set("video_url", path);
    } catch (e) { toast.error((e as Error).message); }
    finally { setUploading(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.brand || !v.model || !v.price_pln || !v.year || v.mileage_km == null) {
      return toast.error("Wypełnij wymagane pola: marka, model, rok, przebieg, cena");
    }
    if (v.video_url && v.video_url.startsWith("http") && !isAllowedVideoInput(v.video_url)) {
      return toast.error("Nieprawidłowy link do wideo. Dozwolone są tylko linki YouTube.");
    }
    setSaving(true);
    const payload = {
      ...v,
      year: v.year,
      mileage_km: v.mileage_km,
      price_pln: v.price_pln,
      power_hp: v.power_hp || null,
      engine_capacity_cm3: v.engine_capacity_cm3 || null,
      fuel: v.fuel || null,
      transmission: v.transmission || null,
      body_type: v.body_type || null,
      color: v.color || null,
      phone: v.phone || null,
      description: v.description || null,
      video_url: v.video_url || null,
      mileage_unit: mileageUnit,
    };
    const { error } = id
      ? await supabase.from("cars").update(payload).eq("id", id)
      : await supabase.from("cars").insert(payload);
    setSaving(false);
    if (error) return toast.error("Błąd zapisu", { description: error.message });
    toast.success(id ? "Zaktualizowano" : "Dodano ogłoszenie");
    qc.invalidateQueries({ queryKey: ["admin-cars"] });
    qc.invalidateQueries({ queryKey: ["cars-public"] });
    navigate({ to: "/dashboard" });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
      <h1 className="font-display text-3xl font-bold">{id ? "Edytuj ogłoszenie" : "Nowe ogłoszenie"}</h1>

      <section className="bg-card border border-border rounded-lg p-6 space-y-4">
        <h2 className="font-semibold">Zdjęcia</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {v.images.map((p, i) => (
            <div key={p} className="relative aspect-square rounded-md overflow-hidden bg-muted group">
              <CarImage path={p} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => removeImg(i)}
                className="absolute top-1 right-1 bg-background/90 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="w-4 h-4" />
              </button>
              {i === 0 && <div className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">Główne</div>}
            </div>
          ))}
          <label className="aspect-square border-2 border-dashed border-border rounded-md flex flex-col items-center justify-center cursor-pointer hover:bg-accent transition-colors">
            {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6 text-muted-foreground" />}
            <span className="text-xs text-muted-foreground mt-2">Dodaj</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          </label>
        </div>
      </section>

      <section className="bg-card border border-border rounded-lg p-6 grid sm:grid-cols-2 gap-4">
        <Field label="Marka *"><Input value={v.brand} onChange={(e) => set("brand", e.target.value)} required /></Field>
        <Field label="Model *"><Input value={v.model} onChange={(e) => set("model", e.target.value)} required /></Field>
        <Field label="Rok *"><Input type="number" value={v.year ?? ""} onChange={(e) => set("year", e.target.value ? +e.target.value : null)} required /></Field>
        <Field label={`Przebieg (${mileageUnit}) *`}>
          <div className="flex gap-2">
            <Input
              type="number"
              className="flex-1"
              value={v.mileage_km ?? ""}
              onChange={(e) => set("mileage_km", e.target.value ? +e.target.value : null)}
              required
            />
            <Select value={mileageUnit} onValueChange={(val) => setMileageUnit(val as "km" | "mi")}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="km">km</SelectItem>
                <SelectItem value="mi">mile</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Field>
        <Field label="Cena (PLN) *"><Input type="number" step="0.01" value={v.price_pln ?? ""} onChange={(e) => set("price_pln", e.target.value ? +e.target.value : null)} required /></Field>
        <Field label="Telefon kontaktowy"><Input value={v.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+48 ..." /></Field>
        <Field label="Paliwo">
          <Select value={v.fuel || ""} onValueChange={(val) => set("fuel", val)}>
            <SelectTrigger><SelectValue placeholder="Wybierz paliwo" /></SelectTrigger>
            <SelectContent>
              {FUEL_OPTIONS.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Skrzynia biegów">
          <Select value={v.transmission || ""} onValueChange={(val) => set("transmission", val)}>
            <SelectTrigger><SelectValue placeholder="Wybierz skrzynię" /></SelectTrigger>
            <SelectContent>
              {TRANSMISSION_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Moc (KM)"><Input type="number" value={v.power_hp ?? ""} onChange={(e) => set("power_hp", e.target.value ? +e.target.value : null)} /></Field>
        <Field label="Pojemność (cm³)"><Input type="number" value={v.engine_capacity_cm3 ?? ""} onChange={(e) => set("engine_capacity_cm3", e.target.value ? +e.target.value : null)} /></Field>
      </section>

      <section className="bg-card border border-border rounded-lg p-6 space-y-4">
        <Field label="Opis">
          <Textarea rows={6} value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="Stan techniczny, wyposażenie, historia..." />
        </Field>
        <div>
          <Label>Wideo (URL YouTube lub plik)</Label>
          <div className="flex gap-2 mt-2">
            <Input value={v.video_url} onChange={(e) => set("video_url", e.target.value)} placeholder="https://youtube.com/... lub wgraj plik" />
            <label className="inline-flex">
              <Button type="button" variant="outline" asChild>
                <span><Upload className="w-4 h-4 mr-2" /> Plik</span>
              </Button>
              <input type="file" accept="video/*" className="hidden" onChange={(e) => handleVideo(e.target.files)} />
            </label>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Switch checked={v.is_sold} onCheckedChange={(c) => set("is_sold", c)} id="sold" />
          <Label htmlFor="sold" className="cursor-pointer">Oznacz jako sprzedane</Label>
        </div>
      </section>

      <div className="flex gap-3">
        <Button type="submit" size="lg" disabled={saving || uploading}>
          {saving ? "Zapisywanie..." : id ? "Zapisz zmiany" : "Dodaj ogłoszenie"}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => navigate({ to: "/dashboard" })}>Anuluj</Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}
