import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ManagedRole = "admin" | "editor" | "none";

export interface ManagedUser {
  id: string;
  email: string | null;
  role: ManagedRole;
  createdAt: string;
}

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error("Nie udało się zweryfikować uprawnień.");
  if (!data) throw new Error("Brak uprawnień administratora.");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedUser[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (usersError) throw new Error("Nie udało się pobrać listy kont.");

    const { data: rolesData, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rolesError) throw new Error("Nie udało się pobrać ról.");

    const roleByUser = new Map<string, ManagedRole>();
    for (const r of rolesData ?? []) {
      const current = roleByUser.get(r.user_id);
      // admin wins over editor for display
      if (r.role === "admin" || current !== "admin") {
        roleByUser.set(r.user_id, r.role as ManagedRole);
      }
    }

    return usersData.users
      .map((u) => ({
        id: u.id,
        email: u.email ?? null,
        role: roleByUser.get(u.id) ?? ("none" as ManagedRole),
        createdAt: u.created_at,
      }))
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; password: string; role: ManagedRole }) =>
    z
      .object({
        email: z.string().trim().email("Nieprawidłowy adres e-mail").max(255),
        password: z.string().min(8, "Hasło musi mieć min. 8 znaków").max(72),
        role: z.enum(["admin", "editor", "none"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (createError || !created.user) {
      throw new Error(createError?.message ?? "Nie udało się utworzyć konta.");
    }

    if (data.role !== "none") {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: created.user.id, role: data.role });
      if (roleError) {
        // Roll back the auth user so we don't leave a roleless orphan unexpectedly.
        await supabaseAdmin.auth.admin.deleteUser(created.user.id);
        throw new Error("Konto utworzone, ale nie udało się nadać roli.");
      }
    }

    return { ok: true, id: created.user.id };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; role: ManagedRole }) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "editor", "none"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    if (data.userId === context.userId && data.role !== "admin") {
      throw new Error("Nie możesz odebrać sobie roli administratora.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Replace any existing roles with the selected one.
    const { error: deleteError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (deleteError) throw new Error("Nie udało się zaktualizować roli.");

    if (data.role !== "none") {
      const { error: insertError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      if (insertError) throw new Error("Nie udało się zaktualizować roli.");
    }

    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    if (data.userId === context.userId) {
      throw new Error("Nie możesz usunąć własnego konta.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error("Nie udało się usunąć konta.");

    return { ok: true };
  });
