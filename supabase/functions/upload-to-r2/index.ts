import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3";

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

function uploadErrorMessage(error: unknown) {
  const err = error as { name?: string; Code?: string; message?: string };
  if (err.name === "NoSuchBucket" || err.Code === "NoSuchBucket") {
    return "Nie udało się znaleźć bucketu R2. Sprawdź nazwę bucketu, konto R2 oraz czy bucket nie jest utworzony w jurysdykcji wymagającej osobnego endpointu.";
  }
  if (err.name === "AccessDenied" || err.Code === "AccessDenied") {
    return "R2 odmówiło dostępu. Sprawdź, czy token ma uprawnienia Object Read & Write do tego bucketu i czy endpoint odpowiada jurysdykcji bucketu.";
  }
  return err.message ?? "Błąd uploadu";
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB


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

    // --- Parse upload ---
    const form = await req.formData();
    const file = form.get("file");
    const filename = (form.get("filename") as string | null) ?? "";
    if (!(file instanceof File)) return json({ error: "Brak pliku" }, 400);

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return json({ error: "Plik jest zbyt duży (max 10MB). Zmniejsz zdjęcie i spróbuj ponownie." }, 400);
    }

    // The frontend always converts images to JPEG before upload. Force the
    // stored object to be a proper JPEG regardless of the incoming content-type
    // so R2 (and the app) can always preview it.
    const FORCED_CONTENT_TYPE = "image/jpeg";

    const safeName = (filename || file.name || "plik")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/\.[^/.]+$/, "") // strip any extension
      .slice(-100);
    const key = `${Date.now()}-${safeName}.jpg`; // always store as .jpg

    const accountId = requiredEnv("R2_ACCOUNT_ID");
    const bucket = requiredEnv("R2_BUCKET_NAME");
    const publicUrl = requiredEnv("R2_PUBLIC_URL").replace(/\/+$/, "");
    const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
    const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");

    // Safe diagnostics — no secret values
    console.log("r2 config", {
      accountIdLen: accountId.length,
      bucketNameLen: bucket.length,
      accessKeyIdLen: accessKeyId.length,
    });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentType: FORCED_CONTENT_TYPE,
    });


    const endpointCandidates = [
      { label: "default", url: `https://${accountId}.r2.cloudflarestorage.com` },
      { label: "eu", url: `https://${accountId}.eu.r2.cloudflarestorage.com` },
      { label: "fedramp", url: `https://${accountId}.fedramp.r2.cloudflarestorage.com` },
    ];

    let lastUploadError: unknown;
    for (const endpoint of endpointCandidates) {
      try {
        console.log("r2 upload attempt", { endpoint: endpoint.label });
        await createR2Client(endpoint.url, accessKeyId, secretAccessKey).send(command);
        lastUploadError = undefined;
        break;
      } catch (uploadError) {
        lastUploadError = uploadError;
        console.warn("r2 upload endpoint failed", {
          endpoint: endpoint.label,
          name: (uploadError as { name?: string }).name,
          code: (uploadError as { Code?: string }).Code,
        });
        if (!isRetryableR2EndpointError(uploadError)) break;
      }
    }


    if (lastUploadError) throw lastUploadError;

    return json({ url: `${publicUrl}/${key}` });
  } catch (e) {
    console.error("upload-to-r2 error", e);
    return json({ error: uploadErrorMessage(e) }, 500);
  }
});
