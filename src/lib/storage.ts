import { supabase } from "@/integrations/supabase/client";

const BUCKET = "car-media";

const cache = new Map<string, { url: string; exp: number }>();

// Uploads an image to Cloudflare R2 via the "upload-to-r2" edge function.
// Returns the public R2 URL, which is stored directly in the database and used
// as an <img src> across the site (no Supabase Storage / signed URLs needed).
export async function uploadCarImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("filename", file.name);
  const { data, error } = await supabase.functions.invoke<{ url: string }>("upload-to-r2", {
    body: form,
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Brak adresu URL w odpowiedzi serwera");
  return data.url;
}

export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const now = Date.now();
  const hit = cache.get(path);
  if (hit && hit.exp > now + 60_000) return hit.url;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data) return "";
  cache.set(path, { url: data.signedUrl, exp: now + expiresIn * 1000 });
  return data.signedUrl;
}

export async function getSignedUrls(paths: string[]): Promise<string[]> {
  return Promise.all(paths.map((p) => getSignedUrl(p)));
}

export async function uploadCarMedia(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

export async function removeCarMedia(path: string) {
  if (!path || path.startsWith("http")) return;
  await supabase.storage.from(BUCKET).remove([path]);
}
