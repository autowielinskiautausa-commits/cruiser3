import { supabase } from "@/integrations/supabase/client";

const BUCKET = "car-media";

const cache = new Map<string, { url: string; exp: number }>();

const MAX_DIMENSION = 1920; // max width/height in px
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB hard limit

// Always converts an image to JPEG (and resizes to max 1920px) in the browser
// using the Canvas API. This normalizes every format — HEIC/HEIF, PNG, WebP,
// or JPEG with a wrong/missing MIME type — into a proper image/jpeg File so R2
// stores a previewable file. Falls back to the original file only if the
// browser genuinely cannot decode it.
async function convertToJpeg(file: File): Promise<File> {
  const jpegName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";

  // Try Canvas via createImageBitmap first (fast, no DOM), then <img> fallback.
  const drawToJpeg = (source: CanvasImageSource, srcW: number, srcH: number): Promise<File | null> => {
    let w = srcW;
    let h = srcH;
    if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    ctx.drawImage(source, 0, 0, w, h);
    return new Promise((resolve) =>
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], jpegName, { type: "image/jpeg" }) : null),
        "image/jpeg",
        0.85,
      ),
    );
  };

  // Attempt 1: createImageBitmap
  try {
    const bitmap = await createImageBitmap(file);
    const out = await drawToJpeg(bitmap, bitmap.width, bitmap.height);
    bitmap.close();
    if (out) return out;
  } catch {
    // fall through to <img> approach
  }

  // Attempt 2: <img> element (handles some formats createImageBitmap won't)
  try {
    const out = await new Promise<File | null>((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = async () => {
        const result = await drawToJpeg(img, img.naturalWidth, img.naturalHeight);
        URL.revokeObjectURL(url);
        resolve(result);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
    if (out) return out;
  } catch {
    // fall through
  }

  // Browser can't decode this format (e.g. some HEIC on non-Safari) — send as-is.
  return file;
}

// Uploads an image to Cloudflare R2 via the "upload-to-r2" edge function.
// Returns the public R2 URL, which is stored directly in the database and used
// as an <img src> across the site (no Supabase Storage / signed URLs needed).
export async function uploadCarImage(file: File): Promise<string> {
  const prepared = await convertToJpeg(file);
  if (prepared.size > MAX_UPLOAD_SIZE) {
    throw new Error("Plik jest zbyt duży (max 10MB) nawet po kompresji.");
  }
  const form = new FormData();
  form.append("file", prepared);
  form.append("filename", prepared.name);
  const { data, error } = await supabase.functions.invoke<{ url: string }>("upload-to-r2", {
    body: form,
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Brak adresu URL w odpowiedzi serwera");
  return data.url;
}

// Deletes one or more images from Cloudflare R2 via the "delete-from-r2" edge
// function. Accepts full public R2 URLs (as stored in the DB). Only R2 (http)
// URLs are sent; legacy Supabase Storage paths are ignored here.
export async function deleteCarImages(urls: (string | null | undefined)[]): Promise<void> {
  const r2Urls = urls.filter((u): u is string => !!u && u.startsWith("http"));
  if (r2Urls.length === 0) return;
  const { error } = await supabase.functions.invoke("delete-from-r2", {
    body: { urls: r2Urls },
  });
  if (error) throw error;
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
