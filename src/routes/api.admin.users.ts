import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

async function requireAdmin(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return { error: new Response("Unauthorized", { status: 401 }) };
  }
  const token = auth.slice("Bearer ".length);
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const userClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) {
    return { error: new Response("Unauthorized", { status: 401 }) };
  }
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);
  if (!roles?.some((r) => r.role === "admin")) {
    return { error: new Response("Forbidden", { status: 403 }) };
  }
  return { userId: data.user.id };
}

export const Route = createFileRoute("/api/admin/users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const guard = await requireAdmin(request);
        if (guard.error) return guard.error;

        const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        });
        if (error) return new Response(error.message, { status: 500 });

        const ids = list.users.map((u) => u.id);
        const [{ data: roles }, { data: perms }] = await Promise.all([
          supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
          supabaseAdmin
            .from("user_permissions")
            .select("user_id, can_manage_tasks")
            .in("user_id", ids),
        ]);

        const users = list.users.map((u) => ({
          id: u.id,
          email: u.email,
          createdAt: u.created_at,
          isAdmin: !!roles?.some((r) => r.user_id === u.id && r.role === "admin"),
          canManageTasks: !!perms?.find((p) => p.user_id === u.id)?.can_manage_tasks,
        }));
        return Response.json({ users });
      },

      POST: async ({ request }) => {
        const guard = await requireAdmin(request);
        if (guard.error) return guard.error;

        const body = await request.json();
        const email = String(body.email ?? "").trim();
        const password = String(body.password ?? "");
        const isAdmin = !!body.isAdmin;
        const canManageTasks = !!body.canManageTasks;

        if (!email || password.length < 8) {
          return new Response("Email and password (min 8 chars) are required", { status: 400 });
        }

        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (error || !data.user) {
          return new Response(error?.message ?? "Failed to create user", { status: 400 });
        }

        if (isAdmin) {
          await supabaseAdmin.from("user_roles").insert({ user_id: data.user.id, role: "admin" });
        }
        await supabaseAdmin
          .from("user_permissions")
          .upsert(
            { user_id: data.user.id, can_manage_tasks: canManageTasks },
            { onConflict: "user_id" },
          );

        return Response.json({ id: data.user.id });
      },

      PATCH: async ({ request }) => {
        const guard = await requireAdmin(request);
        if (guard.error) return guard.error;

        const body = await request.json();
        const userId = String(body.userId ?? "");
        if (!userId) return new Response("userId required", { status: 400 });

        if (typeof body.isAdmin === "boolean") {
          if (body.isAdmin) {
            await supabaseAdmin
              .from("user_roles")
              .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
          } else {
            if (userId === guard.userId) {
              return new Response("You cannot remove your own admin role", { status: 400 });
            }
            await supabaseAdmin
              .from("user_roles")
              .delete()
              .eq("user_id", userId)
              .eq("role", "admin");
          }
        }
        if (typeof body.canManageTasks === "boolean") {
          await supabaseAdmin
            .from("user_permissions")
            .upsert(
              { user_id: userId, can_manage_tasks: body.canManageTasks },
              { onConflict: "user_id" },
            );
        }
        if (typeof body.password === "string" && body.password.length >= 8) {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: body.password,
          });
          if (error) return new Response(error.message, { status: 400 });
        }
        return Response.json({ ok: true });
      },

      DELETE: async ({ request }) => {
        const guard = await requireAdmin(request);
        if (guard.error) return guard.error;

        const url = new URL(request.url);
        const userId = url.searchParams.get("userId");
        if (!userId) return new Response("userId required", { status: 400 });
        if (userId === guard.userId) {
          return new Response("You cannot delete your own account", { status: 400 });
        }

        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) return new Response(error.message, { status: 400 });
        return Response.json({ ok: true });
      },
    },
  },
});
