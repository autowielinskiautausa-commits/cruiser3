import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { S3Client, DeleteObjectCommand } from "npm:@aws-sdk/client-s3@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim().replace(/^['"]|['"]$/g, "");
  if (!value) throw new Error(`Brak konfiguracji: ${name}`);
  return value;
}

function isRetryableR2EndpointError(error: unknown) {
  const err = error as { name?: string; Code?: string };
  return err.name === "NoSuchBucket" || err.Code === "NoSuchBucket" || err.name === "AccessDenied" || err.Code === "AccessDenied";
}

function createR2Client(endpoint: string, accessKeyId: string, secretAccessKey: string) {
  return new S3Client({
    region: "auto",
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
}

// Extract the object key (path after the public URL host) from a stored R2 URL.
function extractKey(url: string, publicUrl: string): string | null {
  if (typeof url !== "string" || !url) return null;
  const trimmed = url.trim();
  // Preferred: strip the configured public base URL.
  if (trimmed.startsWith(publicUrl)) {
    return decodeURIComponent(trimmed.slice(publicUrl.length).replace(/^\/+/, ""));
  }
  // Fallback: any absolute URL — use its pathname.
  try {
    const u = new URL(trimmed);
    return decodeURIComponent(u.pathname.replace(/^\/+/, "")) || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // --- Auth: require a signed-in admin user ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Brak autoryzacji" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Nieautoryzowany" }, 401);

    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr || !isAdmin) return json({ error: "Brak uprawnień administratora" }, 403);

    // --- Parse body ---
    const body = await req.json().catch(() => null);
    const urls = (body as { urls?: unknown } | null)?.urls;
    if (!Array.isArray(urls)) return json({ error: "Brak listy adresów URL" }, 400);

    const publicUrl = requiredEnv("R2_PUBLIC_URL").replace(/\/+$/, "");
    const accountId = requiredEnv("R2_ACCOUNT_ID");
    const bucket = requiredEnv("R2_BUCKET_NAME");
    const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
    const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");

    const keys = urls
      .map((u) => extractKey(String(u), publicUrl))
      .filter((k): k is string => !!k);

    const endpointCandidates = [
      { label: "default", url: `https://${accountId}.r2.cloudflarestorage.com` },
      { label: "eu", url: `https://${accountId}.eu.r2.cloudflarestorage.com` },
      { label: "fedramp", url: `https://${accountId}.fedramp.r2.cloudflarestorage.com` },
    ];

    const deleted: string[] = [];
    const failed: string[] = [];

    for (const key of keys) {
      const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
      let lastError: unknown;
      for (const endpoint of endpointCandidates) {
        try {
          await createR2Client(endpoint.url, accessKeyId, secretAccessKey).send(command);
          lastError = undefined;
          break;
        } catch (err) {
          lastError = err;
          if (!isRetryableR2EndpointError(err)) break;
        }
      }
      if (lastError) {
        console.warn("r2 delete failed", { key, name: (lastError as { name?: string }).name });
        failed.push(key);
      } else {
        deleted.push(key);
      }
    }

    return json({ deleted, failed });
  } catch (e) {
    console.error("delete-from-r2 error", e);
    return json({ error: (e as Error).message ?? "Błąd usuwania" }, 500);
  }
});
