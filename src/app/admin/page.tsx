"use client";

import { useCallback, useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  Archive,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileClock,
  KeyRound,
  Lock,
  Mail,
  NotebookPen,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import MobileHeader from "@/components/MobileHeader";
import Toast from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import type { AdminUserSummary, AdminUserUsageSignal, AuditLog, RiskLevel, UserRole, UserStatus } from "@/lib/types";

type AdminTab = "users" | "audit";
type AccessWindow = "all" | "never" | "7" | "30" | "45";
type SortKey = "risk" | "recent" | "old_access" | "newest" | "status" | "role";

type CreateUserForm = {
  name: string;
  email: string;
  password: string;
  plan: "free" | "pro";
  role: UserRole;
};

type ActionIntent =
  | {
      critical: boolean;
      kind: "reset";
      reasonRequired: boolean;
      title: string;
      userId: string;
    }
  | {
      critical: boolean;
      kind: "delete";
      reasonRequired: boolean;
      title: string;
      userIds: string[];
    }
  | {
      critical: boolean;
      kind: "role";
      reasonRequired: boolean;
      role: UserRole;
      title: string;
      userIds: string[];
    }
  | {
      critical: boolean;
      kind: "status";
      reasonRequired: boolean;
      status: UserStatus;
      title: string;
      userIds: string[];
    };

const pageSize = 12;

const statusLabel: Record<UserStatus, string> = {
  pending: "Pendente",
  active: "Ativo",
  inactive: "Inativo",
};

const statusClass: Record<UserStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  active: "bg-green-50 text-green-700",
  inactive: "bg-gray-100 text-gray-700",
};

const roleLabel: Record<UserRole, string> = {
  user: "Usuario",
  support: "Suporte",
  operations: "Operacional",
  admin: "Admin",
  superadmin: "Superadm",
};

const riskLabel: Record<RiskLevel, string> = {
  low: "Baixo",
  medium: "Medio",
  high: "Alto",
};

const riskClass: Record<RiskLevel, string> = {
  low: "border-green-100 bg-green-50 text-green-700",
  medium: "border-amber-100 bg-amber-50 text-amber-700",
  high: "border-red-100 bg-red-50 text-red-600",
};

const usageSignalClass: Record<AdminUserUsageSignal, string> = {
  active: "border-green-100 bg-green-50 text-green-700",
  login_only: "border-gray-100 bg-gray-50 text-gray-700",
  no_login: "border-gray-100 bg-gray-50 text-gray-500",
  stale: "border-amber-100 bg-amber-50 text-amber-700",
  trial: "border-blue-100 bg-blue-50 text-ios-blue",
};

const sensitiveAuditActions = new Set([
  "admin.password_reset",
  "admin.user_deleted",
  "admin.user_status_changed",
  "admin.user_role_changed",
  "admin.batch_status_changed",
  "admin.batch_role_changed",
]);

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || "Nao foi possivel concluir.";
  } catch {
    return "Nao foi possivel concluir.";
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return "Nunca";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDaysAgo(days?: number | null) {
  if (days === null || days === undefined) return "Sem registro";
  if (days === 0) return "Hoje";
  if (days === 1) return "Ha 1 dia";
  return `Ha ${days} dias`;
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    "admin.batch_role_changed": "Papel alterado em lote",
    "admin.batch_status_changed": "Status alterado em lote",
    "admin.password_reset": "Senha resetada",
    "admin.superadmin_created": "Superadm criado",
    "admin.superadmin_updated": "Superadm atualizado",
    "admin.user_created": "Usuario criado",
    "admin.user_deleted": "Usuario excluido",
    "admin.user_notes_updated": "Nota interna atualizada",
    "admin.user_plan_changed": "Plano alterado",
    "admin.user_role_changed": "Papel alterado",
    "admin.user_status_changed": "Status alterado",
    insert: "Registro criado",
    update: "Registro alterado",
    delete: "Registro removido",
  };

  return labels[action] || action.replace(/^admin\./, "").replace(/_/g, " ");
}

function changedFields(log: AuditLog) {
  const oldData = log.oldData || {};
  const newData = log.newData || {};
  const keys = ["status", "role", "plan", "admin_notes", "status_reason", "name", "email"];

  return keys
    .filter((key) => oldData[key] !== newData[key] && (oldData[key] !== undefined || newData[key] !== undefined))
    .map((key) => `${key}: ${String(oldData[key] ?? "vazio")} -> ${String(newData[key] ?? "vazio")}`);
}

function auditMetadataString(log: AuditLog, key: string) {
  const value = log.metadata?.[key];

  return typeof value === "string" ? value.trim() : "";
}

function auditLogBelongsToUser(log: AuditLog, userId: string) {
  const deletedUserId = auditMetadataString(log, "deletedUserId");

  return [log.targetUserId, log.recordId, deletedUserId].some((targetId) => targetId === userId);
}

function auditReason(log: AuditLog) {
  return auditMetadataString(log, "reason");
}

function isSensitiveAuditAction(action: string) {
  return sensitiveAuditActions.has(action);
}

function isAdminAuditLog(log: AuditLog) {
  return log.action.startsWith("admin.") || log.tableName === "admin";
}

function downloadCsv(users: AdminUserSummary[]) {
  const header = ["nome", "email", "status", "plano", "perfil", "ultimo_acesso", "risco", "marcadores"];
  const rows = users.map((user) =>
    [
      user.name,
      user.email,
      statusLabel[user.status],
      user.plan,
      roleLabel[user.role],
      formatDateTime(user.lastSignInAt),
      riskLabel[user.riskLevel],
      user.riskTags.join("; "),
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `usuarios-admin-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("all");
  const [planFilter, setPlanFilter] = useState<"all" | "free" | "pro">("all");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");
  const [accessFilter, setAccessFilter] = useState<AccessWindow>("all");
  const [sortBy, setSortBy] = useState<SortKey>("risk");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focusedUserId, setFocusedUserId] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [actionIntent, setActionIntent] = useState<ActionIntent | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionConfirmation, setActionConfirmation] = useState("");
  const [schemaReady, setSchemaReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "info" | "error">("success");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [form, setForm] = useState<CreateUserForm>({
    name: "",
    email: "",
    password: "",
    plan: "free",
    role: "user",
  });

  const adminFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!user) throw new Error("Sessao ausente.");

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) throw new Error("Sessao expirada. Entre novamente.");

      const response = await fetch(path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(init?.headers || {}),
        },
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      return response.json();
    },
    [user],
  );

  const loadAdminData = useCallback(async () => {
    if (!user) return;

    setLoading(true);

    try {
      const [usersPayload, logsPayload] = await Promise.all([
        adminFetch("/api/admin/users"),
        adminFetch("/api/admin/audit-logs"),
      ]);

      setUsers(usersPayload.users || []);
      setSchemaReady(usersPayload.schemaReady !== false);
      setLogs(logsPayload.logs || []);
    } catch (error) {
      setNoticeTone("error");
      setNotice(error instanceof Error ? error.message : "Nao foi possivel carregar o painel.");
    } finally {
      setLoading(false);
    }
  }, [adminFetch, user]);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  useEffect(() => {
    setPage(1);
  }, [accessFilter, planFilter, query, riskFilter, roleFilter, sortBy, statusFilter]);

  const stats = useMemo(() => {
    return users.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.status] += 1;
        if (item.riskLevel === "high") acc.highRisk += 1;
        if (item.role !== "user") acc.privileged += 1;
        return acc;
      },
      { active: 0, highRisk: 0, inactive: 0, pending: 0, privileged: 0, total: 0 },
    );
  }, [users]);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return users
      .filter((item) => {
        if (statusFilter !== "all" && item.status !== statusFilter) return false;
        if (planFilter !== "all" && item.plan !== planFilter) return false;
        if (roleFilter !== "all" && item.role !== roleFilter) return false;
        if (riskFilter !== "all" && item.riskLevel !== riskFilter) return false;
        if (accessFilter === "never" && item.daysSinceLastSignIn !== null) return false;
        if (accessFilter !== "all" && accessFilter !== "never") {
          const days = Number(accessFilter);
          if (item.daysSinceLastSignIn === null || item.daysSinceLastSignIn < days) return false;
        }
        if (!needle) return true;

        return [item.name, item.email, statusLabel[item.status], roleLabel[item.role], item.riskTags.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => {
        if (sortBy === "risk") return b.riskScore - a.riskScore;
        if (sortBy === "recent") return (b.recentSensitiveActionAt || b.updatedAt || "").localeCompare(a.recentSensitiveActionAt || a.updatedAt || "");
        if (sortBy === "old_access") return (b.daysSinceLastSignIn ?? 9999) - (a.daysSinceLastSignIn ?? 9999);
        if (sortBy === "newest") return (b.createdAt || b.authCreatedAt || "").localeCompare(a.createdAt || a.authCreatedAt || "");
        if (sortBy === "role") return roleLabel[a.role].localeCompare(roleLabel[b.role]);
        return statusLabel[a.status].localeCompare(statusLabel[b.status]);
      });
  }, [accessFilter, planFilter, query, riskFilter, roleFilter, sortBy, statusFilter, users]);

  const visibleUsers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, page]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const focusedUser = users.find((item) => item.id === focusedUserId) || visibleUsers[0] || null;
  const selectedUsers = users.filter((item) => selectedIds.includes(item.id));
  const focusedUserAuditLogs = useMemo(() => {
    if (!focusedUser) return [];

    return logs.filter((log) => isAdminAuditLog(log) && auditLogBelongsToUser(log, focusedUser.id)).slice(0, 6);
  }, [focusedUser, logs]);

  useEffect(() => {
    setNotesDraft(focusedUser?.adminNotes || "");
  }, [focusedUser?.adminNotes, focusedUser?.id]);

  function showNotice(message: string, tone: "success" | "info" | "error" = "success") {
    setNoticeTone(tone);
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  }

  function toggleSelected(userId: string) {
    setSelectedIds((current) => (current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]));
  }

  function openDetail(userId: string) {
    setFocusedUserId(userId);
    setDetailOpen(true);
  }

  function openAction(intent: ActionIntent) {
    setActionIntent(intent);
    setActionReason("");
    setActionConfirmation("");
  }

  async function patchUsers(payload: Record<string, unknown>, successMessage: string) {
    setActionBusy(true);
    setTemporaryPassword("");

    try {
      const response = await adminFetch("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      if (response.temporaryPassword) {
        setTemporaryPassword(response.temporaryPassword);
      }

      showNotice(successMessage, response.temporaryPassword ? "info" : "success");
      await loadAdminData();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Nao foi possivel concluir.", "error");
    } finally {
      setActionBusy(false);
    }
  }

  function updateStatus(targetIds: string[], status: UserStatus) {
    openAction({
      critical: false,
      kind: "status",
      reasonRequired: status !== "active",
      status,
      title: `${statusLabel[status]} ${targetIds.length} usuario(s)`,
      userIds: targetIds,
    });
  }

  function deleteUsers(targetIds: string[]) {
    openAction({
      critical: true,
      kind: "delete",
      reasonRequired: true,
      title: `Excluir definitivamente ${targetIds.length} usuario(s)`,
      userIds: targetIds,
    });
  }

  function updateRole(targetIds: string[], role: UserRole) {
    openAction({
      critical: role === "superadmin",
      kind: "role",
      reasonRequired: role !== "user",
      role,
      title: `Alterar perfil para ${roleLabel[role]}`,
      userIds: targetIds,
    });
  }

  async function updatePlan(targetIds: string[], plan: "free" | "pro") {
    await patchUsers({ plan, reason: "Alteracao de plano", userIds: targetIds }, "Plano atualizado.");
  }

  function resetPassword(userId: string) {
    openAction({
      critical: true,
      kind: "reset",
      reasonRequired: true,
      title: "Resetar senha",
      userId,
    });
  }

  async function executeAction() {
    if (!actionIntent) return;

    if (actionIntent.reasonRequired && !actionReason.trim()) {
      showNotice("Informe o motivo da acao.", "error");
      return;
    }

    if (actionIntent.critical && actionConfirmation.trim() !== "CONFIRMAR") {
      showNotice("Digite CONFIRMAR para executar a acao critica.", "error");
      return;
    }

    const reason = actionReason.trim() || "Acao administrativa";

    if (actionIntent.kind === "status") {
      await patchUsers(
        {
          confirmation: actionConfirmation.trim(),
          reason,
          status: actionIntent.status,
          userIds: actionIntent.userIds,
        },
        `${actionIntent.userIds.length} usuario(s) atualizado(s).`,
      );
      setSelectedIds([]);
    }

    if (actionIntent.kind === "delete") {
      await patchUsers(
        {
          action: "delete",
          confirmation: actionConfirmation.trim(),
          reason,
          userIds: actionIntent.userIds,
        },
        `${actionIntent.userIds.length} usuario(s) excluido(s) definitivamente.`,
      );
      setSelectedIds([]);
    }

    if (actionIntent.kind === "role") {
      await patchUsers(
        {
          confirmation: actionConfirmation.trim(),
          reason,
          role: actionIntent.role,
          userIds: actionIntent.userIds,
        },
        "Perfil atualizado.",
      );
    }

    if (actionIntent.kind === "reset") {
      await patchUsers(
        {
          action: "reset-password",
          confirmation: actionConfirmation.trim(),
          reason,
          userId: actionIntent.userId,
        },
        "Senha temporaria gerada.",
      );
    }

    setActionIntent(null);
    setActionReason("");
    setActionConfirmation("");
  }

  async function saveNotes(userId: string) {
    await patchUsers(
      {
        adminNotes: notesDraft,
        reason: "Atualizacao de nota interna",
        userId,
      },
      "Nota interna salva.",
    );
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setTemporaryPassword("");

    if (form.role === "superadmin") {
      showNotice("Crie o usuario comum primeiro e promova para Superadm pelo fluxo com confirmacao forte.", "error");
      setCreating(false);
      return;
    }

    try {
      const payload = (await adminFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ ...form, confirmation: "", reason: "Criacao administrativa" }),
      })) as { temporaryPassword: string };

      setTemporaryPassword(payload.temporaryPassword);
      setForm({ name: "", email: "", password: "", plan: "free", role: "user" });
      showNotice("Usuario criado.");
      await loadAdminData();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Nao foi possivel criar.", "error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 page-transition">
      <Toast message={notice} tone={noticeTone} />
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-3 space-y-5">
        <MobileHeader
          title="Governanca"
          subtitle="Acessos, suporte e auditoria"
          fallbackHref="/admin"
          showBack={false}
          action={
            <button
              type="button"
              onClick={loadAdminData}
              className="w-10 h-10 rounded-xl bg-white text-gray-700 flex items-center justify-center btn-press border border-gray-100"
              aria-label="Atualizar"
            >
              <RefreshCw size={18} />
            </button>
          }
        />

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile icon={Users} label="Usuarios" value={stats.total} onClick={() => setStatusFilter("all")} />
          <StatTile icon={CheckCircle2} label="Ativos" tone="green" value={stats.active} onClick={() => setStatusFilter("active")} />
          <StatTile icon={Archive} label="Inativos" value={stats.inactive} onClick={() => setStatusFilter("inactive")} />
          <StatTile icon={Clock3} label="Pendentes" tone="amber" value={stats.pending} onClick={() => setStatusFilter("pending")} />
          <StatTile icon={ShieldAlert} label="Risco alto" tone="red" value={stats.highRisk} onClick={() => setRiskFilter("high")} />
          <StatTile icon={Lock} label="Privilegiados" tone="blue" value={stats.privileged} onClick={() => setRoleFilter("admin")} />
        </section>

        {temporaryPassword && (
          <section className="rounded-[14px] border border-gray-900 bg-gray-950 p-4 text-white shadow-ios">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Senha temporaria</p>
            <p className="mt-2 break-all text-lg font-bold tracking-wide">{temporaryPassword}</p>
          </section>
        )}

        {!schemaReady && (
          <section className="rounded-[14px] border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <p className="text-sm font-bold">Schema administrativo pendente</p>
            <p className="mt-1 text-xs leading-relaxed">
              O painel carregou os usuarios, mas notas internas, inativacao, exclusao definitiva e motivos dependem do SQL atualizado no Supabase.
            </p>
          </section>
        )}

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-4">
            <form onSubmit={createUser} className="card rounded-[14px] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-gray-900 text-white flex items-center justify-center">
                  <UserPlus size={18} />
                </div>
                <h2 className="font-semibold text-sm text-gray-900">Novo usuario</h2>
              </div>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Nome"
                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-ios-blue/20"
              />
              <input
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                required
                type="email"
                placeholder="email@exemplo.com"
                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-ios-blue/20"
              />
              <input
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                minLength={6}
                type="password"
                placeholder="Senha inicial ou vazio para gerar"
                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-ios-blue/20"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={form.plan}
                  onChange={(event) => setForm((current) => ({ ...current, plan: event.target.value as "free" | "pro" }))}
                  className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm"
                >
                  <option value="free">Gratis</option>
                  <option value="pro">Pro</option>
                </select>
                <select
                  value={form.role}
                  onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserRole }))}
                  className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm"
                >
                  {Object.entries(roleLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                disabled={creating}
                className="w-full p-3 rounded-xl bg-gray-900 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 btn-press"
              >
                <UserPlus size={16} />
                {creating ? "Criando..." : "Criar usuario"}
              </button>
            </form>

            {focusedUser && (
              <section className="card rounded-[14px] p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-ios-blue flex items-center justify-center">
                    <UserCog size={18} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-sm text-gray-900 truncate">{focusedUser.name}</h2>
                    <p className="text-xs text-gray-400 truncate">{focusedUser.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <InfoPill label="Status" value={statusLabel[focusedUser.status]} />
                  <InfoPill label="Perfil" value={roleLabel[focusedUser.role]} />
                  <InfoPill label="Plano" value={focusedUser.plan === "pro" ? "Pro" : "Gratis"} />
                  <InfoPill label="Risco" value={riskLabel[focusedUser.riskLevel]} />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Marcadores</p>
                  <div className="flex flex-wrap gap-2">
                    {focusedUser.riskTags.length > 0 ? (
                      focusedUser.riskTags.map((tag) => (
                        <span key={tag} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">Sem alertas</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Nota interna</label>
                  <textarea
                    value={notesDraft}
                    onChange={(event) => setNotesDraft(event.target.value)}
                    disabled={!schemaReady}
                    rows={4}
                    className="w-full resize-none rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm outline-none focus:ring-2 focus:ring-ios-blue/20 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => saveNotes(focusedUser.id)}
                    disabled={actionBusy || !schemaReady}
                    className="w-full rounded-xl bg-gray-900 p-3 text-sm font-semibold text-white disabled:opacity-50 btn-press"
                  >
                    Salvar nota
                  </button>
                </div>
              </section>
            )}
          </aside>

          <main className="space-y-4">
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-2xl">
              <button
                type="button"
                onClick={() => setActiveTab("users")}
                className={`py-3 rounded-xl text-sm font-semibold transition ${
                  activeTab === "users" ? "bg-white shadow-ios text-gray-950" : "text-ios-gray"
                }`}
              >
                Usuarios
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("audit")}
                className={`py-3 rounded-xl text-sm font-semibold transition ${
                  activeTab === "audit" ? "bg-white shadow-ios text-gray-950" : "text-ios-gray"
                }`}
              >
                Auditoria
              </button>
            </div>

            {activeTab === "users" ? (
              <section className="space-y-3">
                <div className="card rounded-[14px] p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal size={18} className="text-gray-400" />
                    <h2 className="text-sm font-semibold text-gray-900">Filtros</h2>
                    <button
                      type="button"
                      onClick={() => {
                        setAccessFilter("all");
                        setPlanFilter("all");
                        setQuery("");
                        setRiskFilter("all");
                        setRoleFilter("all");
                        setStatusFilter("all");
                      }}
                      className="ml-auto text-xs font-semibold text-ios-blue"
                    >
                      Limpar
                    </button>
                  </div>
                  <label className="block relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Buscar usuario, email ou marcador"
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-ios-blue/20"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    <FilterSelect value={statusFilter} onChange={(value) => setStatusFilter(value as UserStatus | "all")}>
                      <option value="all">Todos status</option>
                      {Object.entries(statusLabel).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </FilterSelect>
                    <FilterSelect value={roleFilter} onChange={(value) => setRoleFilter(value as UserRole | "all")}>
                      <option value="all">Todos perfis</option>
                      {Object.entries(roleLabel).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </FilterSelect>
                    <FilterSelect value={planFilter} onChange={(value) => setPlanFilter(value as "all" | "free" | "pro")}>
                      <option value="all">Todos planos</option>
                      <option value="free">Gratis</option>
                      <option value="pro">Pro</option>
                    </FilterSelect>
                    <FilterSelect value={riskFilter} onChange={(value) => setRiskFilter(value as RiskLevel | "all")}>
                      <option value="all">Todo risco</option>
                      <option value="high">Alto</option>
                      <option value="medium">Medio</option>
                      <option value="low">Baixo</option>
                    </FilterSelect>
                    <FilterSelect value={accessFilter} onChange={(value) => setAccessFilter(value as AccessWindow)}>
                      <option value="all">Qualquer acesso</option>
                      <option value="never">Nunca acessou</option>
                      <option value="7">Sem acesso 7d</option>
                      <option value="30">Sem acesso 30d</option>
                      <option value="45">Sem acesso 45d</option>
                    </FilterSelect>
                    <FilterSelect value={sortBy} onChange={(value) => setSortBy(value as SortKey)}>
                      <option value="risk">Maior risco</option>
                      <option value="recent">Acao recente</option>
                      <option value="old_access">Acesso antigo</option>
                      <option value="newest">Mais novos</option>
                      <option value="status">Status</option>
                      <option value="role">Perfil</option>
                    </FilterSelect>
                  </div>
                </div>

                {selectedIds.length > 0 && (
                  <div className="sticky top-[72px] z-20 card rounded-[14px] p-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-gray-700">{selectedIds.length} selecionado(s)</span>
                    <button onClick={() => updateStatus(selectedIds, "active")} className="admin-action bg-green-50 text-green-700">
                      Ativar
                    </button>
                    <button onClick={() => updateStatus(selectedIds, "inactive")} disabled={!schemaReady} className="admin-action bg-gray-100 text-gray-700 disabled:opacity-40">
                      Inativar
                    </button>
                    <button onClick={() => updatePlan(selectedIds, "pro")} className="admin-action bg-blue-50 text-ios-blue">
                      Pro
                    </button>
                    <button onClick={() => deleteUsers(selectedIds)} disabled={!schemaReady} className="admin-action bg-zinc-900 text-white disabled:opacity-40">
                      Excluir
                    </button>
                    <button onClick={() => downloadCsv(selectedUsers)} className="admin-action bg-gray-100 text-gray-700">
                      Exportar
                    </button>
                  </div>
                )}

                {loading ? (
                  <div className="space-y-3">
                    <div className="h-28 skeleton rounded-[14px]" />
                    <div className="h-28 skeleton rounded-[14px]" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="ios-tile p-6 text-center">
                    <p className="font-semibold text-gray-900">Nenhum usuario encontrado</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleUsers.map((item) => (
                      <article key={item.id} className="card rounded-[14px] p-4 space-y-4">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(item.id)}
                            onChange={() => toggleSelected(item.id)}
                            className="mt-3 h-4 w-4 accent-gray-900"
                            aria-label={`Selecionar ${item.name}`}
                          />
                          <button
                            type="button"
                            onClick={() => openDetail(item.id)}
                            className="w-11 h-11 rounded-xl bg-gray-900 text-white flex items-center justify-center font-semibold shrink-0 btn-press"
                          >
                            {item.name.slice(0, 1).toUpperCase() || "U"}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-sm text-gray-900 truncate">{item.name}</h3>
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${statusClass[item.status]}`}>
                                {statusLabel[item.status]}
                              </span>
                              <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-ios-blue">
                                {roleLabel[item.role]}
                              </span>
                              {item.riskLevel === "high" && (
                                <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-600">Risco alto</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 truncate mt-1">{item.email}</p>
                            <p className="text-[11px] text-gray-400 mt-1">
                              Criado: {formatDateTime(item.createdAt || item.authCreatedAt)} | Ultimo acesso: {formatDateTime(item.lastSignInAt)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <Metric label="Plano" value={item.plan === "pro" ? "Pro" : "Gratis"} />
                          <Metric label="Risco" value={riskLabel[item.riskLevel]} />
                          <Metric label="Acoes sensiveis" value={item.recentSensitiveActionAt ? formatDateTime(item.recentSensitiveActionAt) : "Sem recente"} />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => openDetail(item.id)} className="admin-action bg-gray-100 text-gray-700">
                            <Eye size={14} /> Detalhe
                          </button>
                          <button onClick={() => updateStatus([item.id], "active")} disabled={item.status === "active"} className="admin-action bg-green-50 text-green-700 disabled:opacity-40">
                            <CheckCircle2 size={14} /> Ativar
                          </button>
                          <button onClick={() => updateStatus([item.id], "inactive")} disabled={!schemaReady || item.status === "inactive"} className="admin-action bg-gray-100 text-gray-700 disabled:opacity-40">
                            <Archive size={14} /> Inativar
                          </button>
                          <button onClick={() => resetPassword(item.id)} className="admin-action bg-amber-50 text-amber-700">
                            <KeyRound size={14} /> Reset
                          </button>
                          <button onClick={() => deleteUsers([item.id])} disabled={!schemaReady} className="admin-action bg-zinc-900 text-white disabled:opacity-40">
                            <Trash2 size={14} /> Excluir
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={item.role}
                            onChange={(event) => updateRole([item.id], event.target.value as UserRole)}
                            disabled={actionBusy}
                            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm"
                          >
                            {Object.entries(roleLabel).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <select
                            value={item.plan}
                            onChange={(event) => updatePlan([item.id], event.target.value as "free" | "pro")}
                            disabled={actionBusy}
                            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm"
                          >
                            <option value="free">Gratis</option>
                            <option value="pro">Pro</option>
                          </select>
                        </div>
                      </article>
                    ))}

                    <div className="flex items-center justify-between rounded-[14px] bg-white p-3 border border-gray-100">
                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={page === 1}
                        className="admin-action bg-gray-100 text-gray-700 disabled:opacity-40"
                      >
                        <ChevronLeft size={14} /> Anterior
                      </button>
                      <span className="text-xs font-semibold text-gray-500">
                        {page} / {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        disabled={page === totalPages}
                        className="admin-action bg-gray-100 text-gray-700 disabled:opacity-40"
                      >
                        Proxima <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </section>
            ) : (
              <section className="space-y-3">
                {loading ? (
                  <div className="space-y-3">
                    <div className="h-20 skeleton rounded-[14px]" />
                    <div className="h-20 skeleton rounded-[14px]" />
                  </div>
                ) : logs.length === 0 ? (
                  <div className="ios-tile p-6 text-center">
                    <p className="font-semibold text-gray-900">Nenhum log registrado</p>
                  </div>
                ) : (
                  logs.map((log) => {
                    const diffs = changedFields(log);

                    return (
                      <article key={log.id} className="card rounded-[14px] p-4 flex gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-ios-blue flex items-center justify-center shrink-0">
                          <FileClock size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="font-semibold text-sm text-gray-900 truncate">{actionLabel(log.action)}</h3>
                            <span className="text-[10px] text-gray-400 shrink-0">{formatDateTime(log.createdAt)}</span>
                          </div>
                          <p className="text-xs text-gray-400 truncate mt-1">{log.actorEmail || "Sistema"}</p>
                          <p className="text-[11px] text-gray-400 mt-1 truncate">Alvo: {log.targetUserId || log.recordId || "sem alvo"}</p>
                          {typeof log.metadata?.reason === "string" && log.metadata.reason && (
                            <p className="mt-2 rounded-xl bg-gray-50 p-2 text-xs text-gray-600">{log.metadata.reason}</p>
                          )}
                          {diffs.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {diffs.slice(0, 4).map((diff) => (
                                <p key={diff} className="rounded-lg bg-gray-50 px-2 py-1 text-[11px] text-gray-500">
                                  {diff}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })
                )}
              </section>
            )}
          </main>
        </div>
      </div>

      {focusedUser && detailOpen && (
        <AdminModal title="Detalhe do usuario" size="lg" onClose={() => setDetailOpen(false)}>
          <UserDetailContent
            actionBusy={actionBusy}
            auditLogs={focusedUserAuditLogs}
            notesDraft={notesDraft}
            onDelete={() => deleteUsers([focusedUser.id])}
            onNotesChange={setNotesDraft}
            onResetPassword={() => resetPassword(focusedUser.id)}
            onSaveNotes={() => saveNotes(focusedUser.id)}
            onStatusChange={(status) => updateStatus([focusedUser.id], status)}
            schemaReady={schemaReady}
            user={focusedUser}
          />
        </AdminModal>
      )}

      {actionIntent && (
        <AdminModal title={actionIntent.title} onClose={() => setActionIntent(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Esta acao sera registrada no historico de auditoria. {actionIntent.critical ? "Por ser critica, exige confirmacao forte." : ""}
            </p>

            {actionIntent.reasonRequired && (
              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Motivo</span>
                <textarea
                  value={actionReason}
                  onChange={(event) => setActionReason(event.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm outline-none focus:ring-2 focus:ring-ios-blue/20"
                  placeholder="Ex.: solicitado pelo suporte, atividade suspeita, revisao operacional"
                />
              </label>
            )}

            {actionIntent.critical && (
              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Confirmacao</span>
                <input
                  value={actionConfirmation}
                  onChange={(event) => setActionConfirmation(event.target.value)}
                  className="w-full rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm outline-none focus:ring-2 focus:ring-ios-blue/20"
                  placeholder="Digite CONFIRMAR"
                />
              </label>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setActionIntent(null)} className="rounded-xl bg-gray-100 p-3 text-sm font-semibold text-gray-700 btn-press">
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeAction}
                disabled={actionBusy}
                className="rounded-xl bg-gray-900 p-3 text-sm font-semibold text-white disabled:opacity-50 btn-press"
              >
                {actionBusy ? "Executando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

function UserDetailContent({
  actionBusy,
  auditLogs,
  notesDraft,
  onDelete,
  onNotesChange,
  onResetPassword,
  onSaveNotes,
  onStatusChange,
  schemaReady,
  user,
}: {
  actionBusy: boolean;
  auditLogs: AuditLog[];
  notesDraft: string;
  onDelete: () => void;
  onNotesChange: (value: string) => void;
  onResetPassword: () => void;
  onSaveNotes: () => void;
  onStatusChange: (status: UserStatus) => void;
  schemaReady: boolean;
  user: AdminUserSummary;
}) {
  const createdAt = user.createdAt || user.authCreatedAt;
  const planLabel = user.plan === "pro" ? "Pro" : "Gratis";
  const activity = user.activity;

  return (
    <div className="space-y-5">
      <section className="rounded-[18px] bg-gray-950 p-4 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-lg font-bold text-gray-950">
              {user.name.slice(0, 1).toUpperCase() || "U"}
            </div>
            <div className="min-w-0">
              <h3 className="break-words text-xl font-extrabold leading-tight">{user.name}</h3>
              <p className="mt-1 break-all text-sm text-white/62">{user.email || "Email nao informado"}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusClass[user.status]}`}>{statusLabel[user.status]}</span>
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-ios-blue">{roleLabel[user.role]}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <DetailMetric label="Plano" value={planLabel} dark />
          <DetailMetric label="Risco" value={`${riskLabel[user.riskLevel]} (${user.riskScore})`} dark />
          <DetailMetric label="Criacao" value={formatDaysAgo(user.daysSinceCreated)} dark />
          <DetailMetric label="Ultimo acesso" value={formatDaysAgo(user.daysSinceLastSignIn)} dark />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-3 rounded-[16px] border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-gray-700 shadow-sm">
              <Activity size={17} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-950">Dados e acesso</h3>
              <p className="text-xs text-gray-400">Identificacao, datas e autenticacao</p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <DetailLine icon={Mail} label="Email" value={user.email || "Nao informado"} />
            <DetailLine icon={ShieldCheck} label="Email confirmado" value={formatDateTime(user.emailConfirmedAt)} />
            <DetailLine icon={CalendarDays} label="Conta criada" value={formatDateTime(createdAt)} detail={formatDaysAgo(user.daysSinceCreated)} />
            <DetailLine icon={Clock3} label="Ultimo login" value={formatDateTime(user.lastSignInAt)} detail={formatDaysAgo(user.daysSinceLastSignIn)} />
            <DetailLine icon={RefreshCw} label="Ultima atualizacao" value={formatDateTime(user.updatedAt)} />
            <DetailLine icon={UserCog} label="ID do usuario" value={<span className="font-mono text-[11px]">{user.id}</span>} />
          </div>
        </section>

        <section className={`rounded-[16px] border p-4 ${riskClass[user.riskLevel]}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide opacity-70">Risco administrativo</p>
              <h3 className="mt-1 text-2xl font-extrabold leading-none">{riskLabel[user.riskLevel]}</h3>
            </div>
            <div className="rounded-2xl bg-white/70 px-3 py-2 text-right shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-60">Score</p>
              <p className="text-lg font-extrabold">{user.riskScore}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {user.riskTags.length > 0 ? (
              user.riskTags.map((tag) => (
                <span key={tag} className="rounded-full bg-white/72 px-3 py-1 text-xs font-bold shadow-sm">
                  {tag}
                </span>
              ))
            ) : (
              <span className="rounded-full bg-white/72 px-3 py-1 text-xs font-bold shadow-sm">Sem alertas</span>
            )}
          </div>

          <p className="mt-4 text-xs font-semibold leading-relaxed opacity-75">
            Use este bloco para priorizar revisoes. Contas com acesso maximo, email sem confirmacao ou acoes sensiveis recentes aparecem com mais peso.
          </p>
        </section>
      </div>

      <section className="rounded-[16px] border border-gray-100 bg-white p-4">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
            <Activity size={17} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-950">Atividade do app</h3>
            <p className="text-xs text-gray-400">Contagens sem valores financeiros</p>
          </div>
        </div>

        <div className={`mb-3 rounded-xl border p-3 ${usageSignalClass[activity.usageSignal]}`}>
          <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">Sinal de uso</p>
          <p className="mt-1 text-lg font-extrabold leading-tight">{activity.usageLabel}</p>
          <p className="mt-1 text-xs font-semibold leading-relaxed opacity-75">{activity.usageDescription}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <DetailMetric label="Dividas cadastradas" value={activity.debtCount} />
          <DetailMetric label="Em aberto" value={activity.openDebtCount} />
          <DetailMetric label="Pagas" value={activity.paidDebtCount} />
          <DetailMetric label="Clientes" value={activity.customerCount} />
          <DetailMetric label="Cobrancas" value={activity.chargeLogCount} />
          <DetailMetric label="Pagamentos" value={activity.paymentCount} />
        </div>

        <div className="mt-3 rounded-xl bg-gray-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Ultima acao do usuario</p>
          <p className="mt-1 text-sm font-extrabold text-gray-900">{activity.lastUserActionLabel}</p>
          <p className="mt-0.5 text-xs font-medium text-gray-400">
            {activity.lastUserActionAt ? formatDateTime(activity.lastUserActionAt) : "Sem registro"}
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-[16px] border border-gray-100 bg-white p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
              <ShieldAlert size={17} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-950">Controle administrativo</h3>
              <p className="text-xs text-gray-400">Status, perfil e motivo registrado</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <DetailMetric label="Status" value={statusLabel[user.status]} />
            <DetailMetric label="Perfil" value={roleLabel[user.role]} />
            <DetailMetric label="Plano" value={planLabel} />
            <DetailMetric label="Status alterado" value={formatDateTime(user.statusChangedAt)} />
          </div>

          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Motivo do status</p>
            <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-gray-700">
              {user.statusReason || "Nenhum motivo registrado."}
            </p>
            {user.statusChangedBy && <p className="mt-2 break-all text-[11px] text-gray-400">Alterado por: {user.statusChangedBy}</p>}
          </div>

          {user.deletedAt && (
            <DetailLine icon={Trash2} label="Exclusao registrada" value={formatDateTime(user.deletedAt)} detail="Registro marcado como excluido" />
          )}
        </div>

        <div className="space-y-3 rounded-[16px] border border-gray-100 bg-white p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
              <NotebookPen size={17} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-950">Nota interna</h3>
              <p className="text-xs text-gray-400">Visivel apenas para administracao</p>
            </div>
          </div>

          <textarea
            value={notesDraft}
            onChange={(event) => onNotesChange(event.target.value)}
            disabled={!schemaReady}
            rows={6}
            className="min-h-[148px] w-full resize-none rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm leading-relaxed text-gray-700 outline-none focus:ring-2 focus:ring-ios-blue/20 disabled:opacity-50"
            placeholder="Adicione contexto de suporte, revisao ou combinados internos."
          />
          <button
            type="button"
            onClick={onSaveNotes}
            disabled={actionBusy || !schemaReady}
            className="w-full rounded-xl bg-gray-900 p-3 text-sm font-semibold text-white disabled:opacity-50 btn-press"
          >
            {actionBusy ? "Salvando..." : "Salvar nota interna"}
          </button>
        </div>
      </section>

      <section className="rounded-[16px] border border-gray-100 bg-white p-4">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
            <FileClock size={17} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-950">Historico administrativo recente</h3>
            <p className="text-xs text-gray-400">Eventos de governanca sobre esta conta</p>
          </div>
        </div>

        {auditLogs.length === 0 ? (
          <div className="rounded-xl bg-gray-50 p-3 text-sm font-semibold text-gray-500">Nenhum evento recente encontrado.</div>
        ) : (
          <ol className="relative space-y-3 border-l border-gray-200 pl-4">
            {auditLogs.map((log) => {
              const reason = auditReason(log);
              const sensitive = isSensitiveAuditAction(log.action);

              return (
                <li key={log.id} className="relative">
                  <span className={`absolute -left-[21px] top-4 h-3 w-3 rounded-full border-2 border-white ${sensitive ? "bg-amber-500" : "bg-gray-900"}`} />
                  <article className="rounded-xl bg-gray-50 p-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h4 className="break-words text-sm font-bold text-gray-900">{actionLabel(log.action)}</h4>
                        {sensitive && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">Sensivel</span>}
                      </div>
                      <time dateTime={log.createdAt} className="shrink-0 text-[11px] font-semibold text-gray-400">
                        {formatDateTime(log.createdAt)}
                      </time>
                    </div>
                    <p className="mt-1 break-all text-xs font-medium text-gray-500">Ator: {log.actorEmail || "Sistema"}</p>
                    {reason && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-2 text-xs leading-relaxed text-gray-600">{reason}</p>}
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="rounded-[16px] border border-gray-100 bg-gray-50 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-gray-950">Acoes rapidas</h3>
            <p className="text-xs text-gray-400">Mudancas criticas ainda exigem confirmacao</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => onStatusChange("active")}
            disabled={actionBusy || user.status === "active"}
            className="admin-action bg-green-50 text-green-700 disabled:opacity-40"
          >
            <CheckCircle2 size={14} /> Ativar
          </button>
          <button
            type="button"
            onClick={() => onStatusChange("inactive")}
            disabled={actionBusy || !schemaReady || user.status === "inactive"}
            className="admin-action bg-gray-100 text-gray-700 disabled:opacity-40"
          >
            <Archive size={14} /> Inativar
          </button>
          <button type="button" onClick={onResetPassword} disabled={actionBusy} className="admin-action bg-amber-50 text-amber-700 disabled:opacity-40">
            <KeyRound size={14} /> Reset senha
          </button>
          <button type="button" onClick={onDelete} disabled={actionBusy || !schemaReady} className="admin-action bg-zinc-900 text-white disabled:opacity-40">
            <Trash2 size={14} /> Excluir
          </button>
        </div>
      </section>
    </div>
  );
}

function AdminModal({
  children,
  onClose,
  size = "md",
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  size?: "lg" | "md";
  title: string;
}) {
  const titleId = useId();
  const sizeClass = size === "lg" ? "max-w-3xl" : "max-w-lg";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="app-modal z-[130]">
      <button type="button" aria-label="Fechar modal" className="app-modal__backdrop z-0" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={`app-modal__panel relative z-10 w-full ${sizeClass} rounded-[18px] bg-white p-4 shadow-2xl`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-bold text-gray-950">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-600 btn-press">
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function DetailLine({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail?: ReactNode;
  icon: typeof Users;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex min-w-0 gap-3 rounded-xl bg-white p-3 shadow-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
        <p className="mt-1 break-words text-sm font-bold text-gray-900">{value}</p>
        {detail && <p className="mt-0.5 break-words text-[11px] font-medium text-gray-400">{detail}</p>}
      </div>
    </div>
  );
}

function DetailMetric({ dark = false, label, value }: { dark?: boolean; label: string; value: ReactNode }) {
  return (
    <div className={`min-w-0 rounded-xl p-3 ${dark ? "bg-white/10" : "bg-gray-50"}`}>
      <p className={`truncate text-[10px] font-bold uppercase tracking-wide ${dark ? "text-white/45" : "text-gray-400"}`}>{label}</p>
      <p className={`mt-1 break-words text-sm font-extrabold ${dark ? "text-white" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}

function FilterSelect({
  children,
  onChange,
  value,
}: {
  children: ReactNode;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm">
      {children}
    </select>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 truncate">{label}</p>
      <p className="text-sm font-bold text-gray-900 mt-1 truncate">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 truncate">{label}</p>
      <p className="text-sm font-bold text-gray-900 mt-1 truncate">{value}</p>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  onClick,
  tone = "gray",
  value,
}: {
  icon: typeof Users;
  label: string;
  onClick?: () => void;
  tone?: "amber" | "blue" | "dark" | "gray" | "green" | "red";
  value: number | string;
}) {
  const toneClass =
    tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : tone === "blue"
        ? "bg-blue-50 text-ios-blue"
        : tone === "dark"
          ? "bg-zinc-900 text-white"
          : tone === "green"
            ? "bg-green-50 text-green-700"
            : tone === "red"
              ? "bg-red-50 text-red-600"
              : "bg-gray-100 text-gray-700";

  return (
    <button type="button" onClick={onClick} className="ios-tile p-4 bg-white min-h-[104px] flex flex-col justify-between text-left btn-press">
      <div className={`w-9 h-9 rounded-lg ${toneClass} flex items-center justify-center`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-950 mt-0.5 truncate">{value}</p>
      </div>
    </button>
  );
}
