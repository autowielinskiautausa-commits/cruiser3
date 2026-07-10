import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

type ManagedRole = "admin" | "editor" | "none";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Brak autoryzacji" }, 401);

    // Caller client (uses the user's JWT, RLS applies).
    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Nieautoryzowany" }, 401);
    const callerId = userData.user.id;

    const { data: isAdmin, error: roleErr } = await caller.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) return json({ error: "Brak uprawnień administratora" }, 403);

    // Admin client (service role, bypasses RLS) for privileged operations.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === "list") {
      const { data: usersData, error: e1 } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (e1) return json({ error: "Nie udało się pobrać listy kont." }, 500);

      const { data: rolesData, error: e2 } = await admin
        .from("user_roles")
        .select("user_id, role");
      if (e2) return json({ error: "Nie udało się pobrać ról." }, 500);

      const roleByUser = new Map<string, ManagedRole>();
      for (const r of rolesData ?? []) {
        const current = roleByUser.get(r.user_id);
        if (r.role === "admin" || current !== "admin") {
          roleByUser.set(r.user_id, r.role as ManagedRole);
        }
      }

      const users = usersData.users
        .map((u) => ({
          id: u.id,
          email: u.email ?? null,
          role: roleByUser.get(u.id) ?? ("none" as ManagedRole),
          createdAt: u.created_at,
        }))
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

      return json({ users });
    }

    if (action === "create") {
      const email = String(body.email ?? "").trim();
      const password = String(body.password ?? "");
      const role = (body.role ?? "none") as ManagedRole;
      if (!email || password.length < 8) return json({ error: "Nieprawidłowe dane." }, 400);

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError || !created.user) {
        return json({ error: createError?.message ?? "Nie udało się utworzyć konta." }, 400);
      }

      if (role !== "none") {
        const { error: roleError } = await admin
          .from("user_roles")
          .insert({ user_id: created.user.id, role });
        if (roleError) {
          await admin.auth.admin.deleteUser(created.user.id);
          return json({ error: "Konto utworzone, ale nie udało się nadać roli." }, 500);
        }
      }

      return json({ ok: true, id: created.user.id });
    }

    if (action === "setRole") {
      const userId = String(body.userId ?? "");
      const role = (body.role ?? "none") as ManagedRole;
      if (!userId) return json({ error: "Brak userId." }, 400);
      if (userId === callerId && role !== "admin") {
        return json({ error: "Nie możesz odebrać sobie roli administratora." }, 400);
      }

      const { error: deleteError } = await admin
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      if (deleteError) return json({ error: "Nie udało się zaktualizować roli." }, 500);

      if (role !== "none") {
        const { error: insertError } = await admin
          .from("user_roles")
          .insert({ user_id: userId, role });
        if (insertError) return json({ error: "Nie udało się zaktualizować roli." }, 500);
      }

      return json({ ok: true });
    }

    if (action === "delete") {
      const userId = String(body.userId ?? "");
      if (!userId) return json({ error: "Brak userId." }, 400);
      if (userId === callerId) return json({ error: "Nie możesz usunąć własnego konta." }, 400);

      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: "Nie udało się usunąć konta." }, 500);

      return json({ ok: true });
    }

    return json({ error: "Nieznana akcja." }, 400);
  } catch (e) {
    console.error("manage-users error", e);
    return json({ error: (e as Error).message ?? "Błąd serwera" }, 500);
  }
});
