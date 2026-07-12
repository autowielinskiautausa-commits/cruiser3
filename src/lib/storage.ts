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
  if (!path) return;
  if (path.startsWith("http")) {
    // R2-hosted images are deleted via the delete-from-r2 edge function.
    await deleteR2Images([path]);
    return;
  }
  await supabase.storage.from(BUCKET).remove([path]);
}

// Deletes one or more images from Cloudflare R2 via the "delete-from-r2" edge function.
// Only http(s) URLs (R2 public URLs) are sent; non-URL paths are ignored here.
export async function deleteR2Images(urls: string[]): Promise<void> {
  const r2Urls = (urls ?? []).filter((u) => u && u.startsWith("http"));
  if (r2Urls.length === 0) return;
  const { error } = await supabase.functions.invoke("delete-from-r2", {
    body: { urls: r2Urls },
  });
  if (error) throw error;
}
