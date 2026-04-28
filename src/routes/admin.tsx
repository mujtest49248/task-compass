import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, KeyRound } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Administration — Task Manager" }] }),
  component: AdminPage,
});

interface AdminUser {
  id: string;
  email: string | null;
  createdAt: string;
  isAdmin: boolean;
  canManageTasks: boolean;
}

async function authedFetch(input: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(input, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pwOpenFor, setPwOpenFor] = useState<AdminUser | null>(null);
  const [deleteFor, setDeleteFor] = useState<AdminUser | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login" });
    else if (!isAdmin) navigate({ to: "/" });
  }, [user, isAdmin, loading, navigate]);

  const load = async () => {
    setBusy(true);
    try {
      const res = await authedFetch("/api/admin/users");
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { users: AdminUser[] };
      setUsers(json.users);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const togglePerm = async (
    u: AdminUser,
    field: "isAdmin" | "canManageTasks",
    value: boolean,
  ) => {
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, [field]: value } : x)));
    const res = await authedFetch("/api/admin/users", {
      method: "PATCH",
      body: JSON.stringify({ userId: u.id, [field]: value }),
    });
    if (!res.ok) {
      toast.error(await res.text());
      load();
    } else {
      toast.success("Updated");
    }
  };

  if (loading || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <Toaster />
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold">User administration</h1>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New user
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create user</DialogTitle>
              </DialogHeader>
              <CreateUserForm
                onCreated={() => {
                  setCreateOpen(false);
                  load();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Users ({users.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Manage tasks</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {busy && users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No users
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        {u.email ?? "—"}
                        {u.id === user?.id && (
                          <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={u.isAdmin}
                          disabled={u.id === user?.id && u.isAdmin}
                          onCheckedChange={(v) => togglePerm(u, "isAdmin", v)}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={u.canManageTasks}
                          onCheckedChange={(v) => togglePerm(u, "canManageTasks", v)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setPwOpenFor(u)}>
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={u.id === user?.id}
                          onClick={() => setDeleteFor(u)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!pwOpenFor} onOpenChange={(o) => !o && setPwOpenFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password — {pwOpenFor?.email}</DialogTitle>
          </DialogHeader>
          {pwOpenFor && (
            <ResetPasswordForm
              userId={pwOpenFor.id}
              onDone={() => setPwOpenFor(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteFor} onOpenChange={(o) => !o && setDeleteFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes {deleteFor?.email}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteFor) return;
                const res = await authedFetch(
                  `/api/admin/users?userId=${encodeURIComponent(deleteFor.id)}`,
                  { method: "DELETE" },
                );
                if (!res.ok) toast.error(await res.text());
                else toast.success("User deleted");
                setDeleteFor(null);
                load();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [canManageTasks, setCanManageTasks] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await authedFetch("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ email, password, isAdmin, canManageTasks }),
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    toast.success("User created");
    onCreated();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="new-email">Email</Label>
        <Input
          id="new-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-password">Password (min 8 chars)</Label>
        <Input
          id="new-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">Administrator</p>
          <p className="text-xs text-muted-foreground">Full access including user management.</p>
        </div>
        <Switch checked={isAdmin} onCheckedChange={setIsAdmin} />
      </div>
      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">Can manage tasks</p>
          <p className="text-xs text-muted-foreground">Create, edit, and delete tasks.</p>
        </div>
        <Switch checked={canManageTasks} onCheckedChange={setCanManageTasks} />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Creating…" : "Create user"}
      </Button>
    </form>
  );
}

function ResetPasswordForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await authedFetch("/api/admin/users", {
      method: "PATCH",
      body: JSON.stringify({ userId, password }),
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    toast.success("Password updated");
    onDone();
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="reset-pw">New password</Label>
        <Input
          id="reset-pw"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
