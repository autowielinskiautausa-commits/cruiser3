import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "editor";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setAuthLoading(false);
      if (s?.user) {
        setRolesLoading(true);
        setTimeout(() => loadRoles(s.user.id), 0);
      } else {
        setRoles([]);
        setRolesLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
      if (data.session?.user) {
        loadRoles(data.session.user.id);
      } else {
        setRolesLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadRoles(uid: string) {
    setRolesLoading(true);
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    if (error) {
      // Keep previous roles on transient errors instead of silently dropping access.
      console.error("Nie udało się pobrać ról użytkownika", error);
      setRolesLoading(false);
      return;
    }
    setRoles((data ?? []).map((r) => r.role as Role));
    setRolesLoading(false);
  }

  const isAdmin = roles.includes("admin");
  const isEditor = isAdmin || roles.includes("editor");
  // `loading` is true until both the session AND the roles are resolved.
  const loading = authLoading || (!!user && rolesLoading);

  return { user, session, roles, isAdmin, isEditor, loading, authLoading, rolesLoading };
}
