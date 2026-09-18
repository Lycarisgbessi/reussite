'use client';

// ═══════════════════════════════════════════════════════════════
// USERS ADMIN — Gestion de l'équipe : création, édition (rôle,
// bio, réseaux, réinitialisation MDP), activation, suppression.
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { useMagazineStore, navigate } from '@/lib/store';
import { adminApi } from '@/lib/api';
import type { AdminRole, AdminUser } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { DataTable, type Column } from '../ui/DataTable';
import { Field } from '../ui/Field';
import { ROLE_LABELS, formatDate, initials, isAuthError } from '../ui/helpers';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Loader2, KeyRound, FileText } from 'lucide-react';

const ROLES: AdminRole[] = ['ADMIN', 'EDITOR_IN_CHIEF', 'WRITER', 'COMMUNITY_MANAGER', 'AD_MANAGER'];

const ROLE_BADGE: Record<AdminRole, string> = {
  ADMIN: 'bg-primary/15 text-primary border-primary/30',
  EDITOR_IN_CHIEF: 'bg-violet-500/10 text-violet-700 border-violet-300 dark:text-violet-300 dark:border-violet-800',
  WRITER: 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-800',
  COMMUNITY_MANAGER: 'bg-orange-500/10 text-orange-700 border-orange-300 dark:text-orange-300 dark:border-orange-800',
  AD_MANAGER: 'bg-teal-500/10 text-teal-700 border-teal-300 dark:text-teal-300 dark:border-teal-800',
};

export function UsersAdmin() {
  const { toast } = useToast();
  const adminUser = useMagazineStore((s) => s.adminUser);
  const clearAdminSession = useMagazineStore((s) => s.clearAdminSession);

  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  // Dialog création
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({ name: '', email: '', password: '', role: 'WRITER' as AdminRole, bio: '' });

  // Dialog édition
  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AdminUser | null>(null);
  const [editForm, setEditForm] = React.useState({ name: '', role: 'WRITER' as AdminRole, bio: '', twitter: '', linkedin: '', password: '', active: true });

  const [deleteTarget, setDeleteTarget] = React.useState<AdminUser | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.users();
      setUsers(r.users);
    } catch (e) {
      if (isAuthError(e)) { clearAdminSession(); navigate('/'); return; }
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Chargement impossible.' });
    } finally {
      setLoading(false);
    }
  }, [toast, clearAdminSession]);

  React.useEffect(() => { load(); }, [load]);

  const submitCreate = async () => {
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password) {
      toast({ variant: 'destructive', title: 'Champs requis', description: 'Renseignez le nom, l’e-mail et le mot de passe.' });
      return;
    }
    if (createForm.password.length < 6) {
      toast({ variant: 'destructive', title: 'Mot de passe trop court', description: '6 caractères minimum.' });
      return;
    }
    setBusy(true);
    try {
      await adminApi.createUser({
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        role: createForm.role,
        bio: createForm.bio,
      });
      toast({ title: 'Utilisateur créé', description: `${createForm.name} peut se connecter au CMS.` });
      setCreateOpen(false);
      setCreateForm({ name: '', email: '', password: '', role: 'WRITER', bio: '' });
      load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Création impossible', description: e instanceof Error ? e.message : 'Erreur inconnue.' });
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (u: AdminUser) => {
    setEditing(u);
    setEditForm({ name: u.name, role: u.role, bio: u.bio, twitter: u.twitter, linkedin: u.linkedin, password: '', active: u.active });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editing) return;
    if (!editForm.name.trim()) {
      toast({ variant: 'destructive', title: 'Nom requis', description: 'Le nom ne peut pas être vide.' });
      return;
    }
    if (editForm.password && editForm.password.length < 6) {
      toast({ variant: 'destructive', title: 'Mot de passe trop court', description: '6 caractères minimum.' });
      return;
    }
    setBusy(true);
    try {
      await adminApi.updateUser(editing.id, {
        name: editForm.name.trim(),
        role: editForm.role,
        bio: editForm.bio,
        twitter: editForm.twitter,
        linkedin: editForm.linkedin,
        active: editForm.active,
        ...(editForm.password ? { password: editForm.password } : {}),
      });
      toast({ title: 'Utilisateur mis à jour', description: `${editForm.name} a été modifié.` });
      setEditOpen(false);
      setEditing(null);
      load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Mise à jour impossible.' });
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (u: AdminUser, active: boolean) => {
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, active } : x)));
    try {
      await adminApi.updateUser(u.id, { active });
      toast({ title: active ? 'Compte réactivé' : 'Compte désactivé', description: u.name });
    } catch (e) {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, active: !active } : x)));
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Mise à jour impossible.' });
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await adminApi.deleteUser(deleteTarget.id);
      toast({ title: 'Utilisateur supprimé', description: `Le compte de ${deleteTarget.name} a été supprimé.` });
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Suppression impossible', description: e instanceof Error ? e.message : 'Le dernier administrateur ne peut pas être supprimé.' });
      setDeleteTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<AdminUser>[] = [
    {
      key: 'user',
      header: 'Utilisateur',
      render: (u) => (
        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">{initials(u.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {u.name}
              {adminUser?.id === u.id ? <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(vous)</span> : null}
            </p>
            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rôle',
      render: (u) => <Badge variant="outline" className={ROLE_BADGE[u.role]}>{ROLE_LABELS[u.role]}</Badge>,
    },
    {
      key: 'articles',
      header: 'Articles',
      className: 'hidden sm:table-cell text-right tabular-nums',
      render: (u) => (
        <span className="inline-flex items-center gap-1 text-sm tabular-nums text-muted-foreground">
          <FileText className="h-3.5 w-3.5" /> {u.articleCount ?? 0}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Créé le',
      className: 'hidden lg:table-cell whitespace-nowrap',
      render: (u) => <span className="text-xs text-muted-foreground">{formatDate(u.createdAt)}</span>,
    },
    {
      key: 'active',
      header: 'Actif',
      render: (u) => <Switch checked={u.active} onCheckedChange={(c) => toggleActive(u, c)} aria-label={`Activer ${u.name}`} />,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'w-12',
      render: (u) => (
        <div className="flex gap-0.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)} aria-label={`Modifier ${u.name}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className={u.id === adminUser?.id ? 'h-8 w-8 cursor-not-allowed text-muted-foreground/40' : 'h-8 w-8 text-destructive hover:text-destructive'}
            onClick={() => {
              if (u.id === adminUser?.id) {
                toast({ variant: 'destructive', title: 'Action impossible', description: 'Vous ne pouvez pas supprimer votre propre compte.' });
                return;
              }
              setDeleteTarget(u);
            }}
            aria-label={u.id === adminUser?.id ? 'Impossible de supprimer votre compte' : `Supprimer ${u.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {users.length} membre(s) de la rédaction — les rôles contrôlent l’accès aux sections.
        </p>
        <Button size="sm" className="ml-auto" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Nouvel utilisateur
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={users}
        loading={loading}
        getRowId={(u) => u.id}
        emptyLabel="Aucun utilisateur."
      />

      {/* ─── Dialog création ─── */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o && !busy) setCreateOpen(false); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="font-editorial">Nouvel utilisateur</DialogTitle>
            <DialogDescription>Créez un accès au back-office pour un membre de l’équipe.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Nom complet" required>
              <Input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="Ex : Marie Martin" />
            </Field>
            <Field label="E-mail" required>
              <Input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="marie@businesshorizon.fr" />
            </Field>
            <Field label="Mot de passe" required hint="6 caractères minimum. À transmettre en sécurité.">
              <Input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} placeholder="••••••••" />
            </Field>
            <Field label="Rôle" required hint="Détermine les sections accessibles (voir matrice des permissions).">
              <Select value={createForm.role} onValueChange={(v) => setCreateForm({ ...createForm, role: v as AdminRole })}>
                <SelectTrigger aria-label="Rôle"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Bio" hint="Affichée sur la page auteur du site.">
              <Textarea value={createForm.bio} onChange={(e) => setCreateForm({ ...createForm, bio: e.target.value })} className="min-h-16 text-sm" placeholder="Journaliste business spécialisée…" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={busy}>Annuler</Button>
            <Button onClick={submitCreate} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Créer l’utilisateur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog édition ─── */}
      <Dialog open={editOpen} onOpenChange={(o) => { if (!o && !busy) setEditOpen(false); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="font-editorial">Modifier {editing?.name}</DialogTitle>
            <DialogDescription>{editing?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Nom complet" required>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </Field>
            <Field label="Rôle" required>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v as AdminRole })}>
                <SelectTrigger aria-label="Rôle"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Bio">
              <Textarea value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} className="min-h-16 text-sm" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Twitter / X">
                <Input value={editForm.twitter} onChange={(e) => setEditForm({ ...editForm, twitter: e.target.value })} placeholder="@mariebiz" />
              </Field>
              <Field label="LinkedIn">
                <Input value={editForm.linkedin} onChange={(e) => setEditForm({ ...editForm, linkedin: e.target.value })} placeholder="marie-martin" />
              </Field>
            </div>
            <Field label="Réinitialiser le mot de passe" hint="Laissez vide pour conserver le mot de passe actuel.">
              <div className="relative">
                <KeyRound className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="Nouveau mot de passe (optionnel)" className="pl-8" />
              </div>
            </Field>
            <label className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <span className="text-sm font-medium">Compte actif</span>
              <Switch checked={editForm.active} onCheckedChange={(v) => setEditForm({ ...editForm, active: v })} aria-label="Compte actif" />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={busy}>Annuler</Button>
            <Button onClick={submitEdit} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Supprimer cet utilisateur ?"
        description={deleteTarget ? `Le compte de ${deleteTarget.name} (${deleteTarget.email}) sera définitivement supprimé. Le dernier administrateur ne peut pas être supprimé.` : ''}
        confirmLabel="Supprimer"
        loading={busy}
        onConfirm={doDelete}
      />
    </div>
  );
}
