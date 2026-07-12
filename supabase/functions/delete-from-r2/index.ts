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
    const body = (await req.json().catch(() => null)) as { urls?: unknown } | null;
    const urls = Array.isArray(body?.urls)
      ? (body!.urls as unknown[]).filter((u): u is string => typeof u === "string" && u.length > 0)
      : [];
    if (urls.length === 0) return json({ deleted: [], failed: [] });

    const accountId = requiredEnv("R2_ACCOUNT_ID");
    const bucket = requiredEnv("R2_BUCKET_NAME");
    const publicUrl = requiredEnv("R2_PUBLIC_URL").replace(/\/+$/, "");
    const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
    const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");

    const endpointCandidates = [
      { label: "default", url: `https://${accountId}.r2.cloudflarestorage.com` },
      { label: "eu", url: `https://${accountId}.eu.r2.cloudflarestorage.com` },
    ];

    const deleted: string[] = [];
    const failed: string[] = [];

    for (const url of urls) {
      // Extract object key by removing the public URL prefix.
      let key = url;
      if (url.startsWith(publicUrl)) {
        key = url.slice(publicUrl.length);
      } else {
        // Fallback: strip any scheme+host, keep the path.
        try {
          key = new URL(url).pathname;
        } catch {
          key = url;
        }
      }
      key = key.replace(/^\/+/, "");
      if (!key) {
        failed.push(url);
        continue;
      }

      const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });

      let lastError: unknown;
      let ok = false;
      for (const endpoint of endpointCandidates) {
        try {
          await createR2Client(endpoint.url, accessKeyId, secretAccessKey).send(command);
          ok = true;
          lastError = undefined;
          break;
        } catch (deleteError) {
          lastError = deleteError;
          console.warn("r2 delete endpoint failed", {
            endpoint: endpoint.label,
            name: (deleteError as { name?: string }).name,
            code: (deleteError as { Code?: string }).Code,
          });
          if (!isRetryableR2EndpointError(deleteError)) break;
        }
      }

      if (ok) {
        deleted.push(url);
      } else {
        console.error("delete-from-r2 failed for url", { url, error: lastError });
        failed.push(url);
      }
    }

    return json({ deleted, failed });
  } catch (e) {
    console.error("delete-from-r2 error", e);
    return json({ error: (e as Error).message ?? "Błąd usuwania" }, 500);
  }
});
