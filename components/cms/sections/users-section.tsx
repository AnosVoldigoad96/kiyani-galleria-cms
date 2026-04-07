"use client";

import { useMemo, useState } from "react";

import { motion } from "framer-motion";
import { Pencil, Plus, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";

import { CmsModal } from "@/components/cms/cms-modal";
import { FilterBar } from "@/components/cms/ui/filter-bar";
import {
  ActionButton,
  StatusBadge,
  sectionTone,
  surfaceClassName,
} from "@/components/cms/cms-shared";
import { Button } from "@/components/ui/button";
import type { CmsUser } from "@/lib/cms-data";

import { updateUserProfile, type UserRole } from "@/components/cms/users/users-api";

type UsersSectionProps = {
  users: CmsUser[];
  onRefresh?: () => void;
};

type UserDraft = {
  fullName: string;
  email: string;
  role: UserRole;
  status: string;
};

const inputClassName =
  "w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

function draftFromUser(user: CmsUser): UserDraft {
  return {
    fullName: user.fullName || user.name,
    email: user.email === "No email" ? "" : user.email,
    role: user.roleCode,
    status: user.statusCode || "active",
  };
}

export function UsersSection({ users, onRefresh }: UsersSectionProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorUser, setEditorUser] = useState<CmsUser | null>(null);
  const [draft, setDraft] = useState<UserDraft>({
    fullName: "",
    email: "",
    role: "customer",
    status: "active",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "all" && u.roleCode !== roleFilter) return false;
      if (statusFilter !== "all" && (u.statusCode || "active") !== statusFilter) return false;
      return true;
    });
  }, [users, roleFilter, statusFilter]);

  const hasFilters = roleFilter !== "all" || statusFilter !== "all";

  const openEditor = (user: CmsUser) => {
    setError(null);
    setEditorUser(user);
    setDraft(draftFromUser(user));
    setEditorOpen(true);
  };

  const saveUser = async () => {
    if (!editorUser) {
      return;
    }

    if (!draft.fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await updateUserProfile(editorUser.id, {
        full_name: draft.fullName.trim(),
        email: draft.email.trim() || null,
        role: draft.role,
        status: draft.status.trim() || "active",
      });

      toast.success("User profile updated.");
      setEditorOpen(false);
      setEditorUser(null);
      onRefresh?.();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Failed to update user.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const quickStatus = async (user: CmsUser, status: string) => {
    setIsSaving(true);
    setError(null);
    try {
      await updateUserProfile(user.id, { status });
      toast.success(`User status set to ${status}.`);
      onRefresh?.();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Failed to update status.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Users</h2>
          <p className="mt-1 text-sm text-muted-foreground">Manage team roles and customer accounts.</p>
        </div>
        <Button
          onClick={() => {
            const invited = users.find((user) => user.statusCode === "invited");
            if (invited) openEditor(invited);
            else if (users[0]) openEditor(users[0]);
          }}
        >
          <Plus className="mr-1.5 size-4" />
          Manage Users
        </Button>
      </div>

      <FilterBar
        filters={[
          {
            label: "Role",
            value: roleFilter,
            options: [
              { label: "All roles", value: "all" },
              { label: "Admin", value: "admin" },
              { label: "Manager", value: "manager" },
              { label: "Customer", value: "customer" },
            ],
            onChange: setRoleFilter,
          },
          {
            label: "Status",
            value: statusFilter,
            options: [
              { label: "All statuses", value: "all" },
              { label: "Active", value: "active" },
              { label: "Invited", value: "invited" },
              { label: "Muted", value: "muted" },
            ],
            onChange: setStatusFilter,
          },
        ]}
        hasActiveFilters={hasFilters}
        onClearAll={() => { setRoleFilter("all"); setStatusFilter("all"); }}
      />

      <div className={surfaceClassName("p-4 sm:p-6")}>
        <div className="w-full">
          <div className="hidden lg:grid grid-cols-[1.2fr_1fr_0.8fr_0.7fr_0.8fr_0.8fr_1.2fr] gap-4 border-b border-[var(--border)]/50 pb-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Orders</span>
            <span>Total Spend</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-[var(--border)]/30">
            {filteredUsers.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                className="flex flex-col gap-4 py-6 transition-colors hover:bg-black/[0.01] lg:grid lg:grid-cols-[1.2fr_1fr_0.8fr_0.7fr_0.8fr_0.8fr_1.2fr] lg:items-center"
              >
                <div className="flex items-center justify-between lg:block">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)] lg:hidden">User</span>
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-black/5 font-bold text-[var(--foreground)]">
                      {user.name[0]}
                    </div>
                    <div>
                      <p className="font-bold text-[var(--foreground)]">{user.name}</p>
                      <p className="mt-0.5 text-xs font-bold uppercase tracking-tight text-[var(--muted-foreground)]">
                        Joined {user.joined}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between lg:block">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)] lg:hidden">Email</span>
                  <span className="text-sm font-medium text-[var(--muted-foreground)]">{user.email}</span>
                </div>
                <div className="flex items-center justify-between lg:block">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)] lg:hidden">Role</span>
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--foreground)]/80">{user.role}</span>
                </div>
                <div className="flex items-center justify-between lg:block">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)] lg:hidden">Orders</span>
                  <span className="text-sm font-bold text-[var(--foreground)]">{user.orders}</span>
                </div>
                <div className="flex items-center justify-between lg:block">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)] lg:hidden">Spend</span>
                  <span className="text-sm font-bold text-[var(--primary)]">{user.spendPkr}</span>
                </div>
                <div className="flex items-center justify-between lg:block">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)] lg:hidden">Status</span>
                  <div className="flex justify-end lg:justify-start">
                    <StatusBadge tone={sectionTone(user.status)}>{user.status}</StatusBadge>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <ActionButton onClick={() => openEditor(user)} disabled={isSaving}>
                    <Pencil className="size-3" />
                    Edit
                  </ActionButton>
                  <ActionButton onClick={() => quickStatus(user, "active")} disabled={isSaving}>
                    <UserCheck className="size-3" />
                    Activate
                  </ActionButton>
                  <ActionButton tone="danger" onClick={() => quickStatus(user, "muted")} disabled={isSaving}>
                    <UserX className="size-3" />
                    Mute
                  </ActionButton>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <CmsModal
        open={editorOpen}
        title="Edit user"
        description={editorUser ? `Profile ${editorUser.id}` : ""}
        onClose={() => {
          setEditorOpen(false);
          setError(null);
        }}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={saveUser} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save user"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Full name</span>
            <input
              value={draft.fullName}
              onChange={(event) => setDraft((current) => ({ ...current, fullName: event.target.value }))}
              className={inputClassName}
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</span>
            <input
              type="email"
              value={draft.email}
              onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
              className={inputClassName}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</span>
            <select
              value={draft.role}
              onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value as UserRole }))}
              className={inputClassName}
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="customer">Customer</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
            <select
              value={draft.status}
              onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}
              className={inputClassName}
            >
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="muted">Muted</option>
            </select>
          </label>
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </CmsModal>
    </section>
  );
}
