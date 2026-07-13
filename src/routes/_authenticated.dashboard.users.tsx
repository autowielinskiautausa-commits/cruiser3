import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  listUsers,
  createUser,
  setUserRole,
  deleteUser,
  type ManagedRole,
} from "@/lib/users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/users")({
  component: UsersPage,
});

const roleLabel: Record<ManagedRole, string> = {
  admin: "Administrator",
  editor: "Edytor",
  none: "Brak roli",
};

function UsersPage() {
  const { user, isAdmin, loading } = useAuth();
  const queryClient = useQueryClient();

  const listUsersFn = useServerFn(listUsers);
  const createUserFn = useServerFn(createUser);
  const setUserRoleFn = useServerFn(setUserRole);
  const deleteUserFn = useServerFn(deleteUser);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newRole, setNewRole] = useState<ManagedRole>("editor");

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listUsersFn(),
    enabled: isAdmin,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-users"] });

  const createMutation = useMutation({
    mutationFn: () => createUserFn({ data: { email, password, role: newRole } }),
    onSuccess: () => {
      toast.success("Konto utworzone");
      setEmail("");
      setPassword("");
      setNewRole("editor");
      invalidate();
    },
    onError: (e: Error) => toast.error("Błąd", { description: e.message }),
  });

  const roleMutation = useMutation({
    mutationFn: (vars: { userId: string; role: ManagedRole }) => setUserRoleFn({ data: vars }),
    onSuccess: () => {
      toast.success("Rola zaktualizowana");
      invalidate();
    },
    onError: (e: Error) => toast.error("Błąd", { description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteUserFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("Konto usunięte");
      invalidate();
    },
    onError: (e: Error) => toast.error("Błąd", { description: e.message }),
  });

  if (loading) return null;

  if (!isAdmin) {
    return (
      <div className="text-center max-w-md mx-auto py-12">
        <h1 className="text-2xl font-bold mb-2">Brak dostępu</h1>
        <p className="text-muted-foreground">
          Zarządzanie użytkownikami jest dostępne tylko dla administratorów.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Utwórz konto</h2>
        <form
          className="grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div>
            <Label htmlFor="new-email">Email</Label>
            <Input
              id="new-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <div>
            <Label htmlFor="new-password">Hasło</Label>
            <Input
              id="new-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label>Rola</Label>
            <Select value={newRole} onValueChange={(v) => setNewRole(v as ManagedRole)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrator</SelectItem>
                <SelectItem value="editor">Edytor</SelectItem>
                <SelectItem value="none">Brak roli</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Tworzenie..." : "Utwórz"}
          </Button>
        </form>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Użytkownicy</h2>
        {usersQuery.isLoading ? (
          <p className="text-muted-foreground">Ładowanie...</p>
        ) : usersQuery.isError ? (
          <p className="text-destructive">Nie udało się pobrać użytkowników.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Rola</TableHead>
                <TableHead>Utworzono</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersQuery.data?.map((u) => {
                const isSelf = u.id === user?.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.email ?? "—"}
                      {isSelf && <span className="ml-2 text-xs text-muted-foreground">(Ty)</span>}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        onValueChange={(v) =>
                          roleMutation.mutate({ userId: u.id, role: v as ManagedRole })
                        }
                        disabled={isSelf || roleMutation.isPending}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue>{roleLabel[u.role]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrator</SelectItem>
                          <SelectItem value="editor">Edytor</SelectItem>
                          <SelectItem value="none">Brak roli</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(u.createdAt).toLocaleDateString("pl-PL")}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isSelf && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Usunąć konto?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Konto {u.email} zostanie trwale usunięte. Tej operacji nie można
                                cofnąć.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Anuluj</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(u.id)}>
                                Usuń
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
