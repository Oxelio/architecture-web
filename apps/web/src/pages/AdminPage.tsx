import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  KeyRound,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { SessionSummary } from "#components/SessionSummary";
import {
  activateUser,
  type AdminUser,
  assignUserRole,
  getUserAdministrationOverview,
  listUsers,
  listUserSessions,
  revokeUserSession,
  suspendUser,
} from "#services/api";

interface AdminPageProps {
  currentUserId: string;
}

export function AdminPage({ currentUserId }: AdminPageProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [role, setRole] = useState<AdminUser["role"] | undefined>();
  const [status, setStatus] = useState<AdminUser["status"] | undefined>();
  const [emailVerified, setEmailVerified] = useState<boolean | undefined>();
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
      setSelectedUserId(null);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const criteria = {
    search: debouncedSearch || undefined,
    role,
    status,
    emailVerified,
    page,
    pageSize,
  };
  const usersQuery = useQuery({
    queryKey: ["admin", "users", criteria],
    queryFn: () => listUsers(criteria),
  });
  const overviewQuery = useQuery({
    queryKey: ["admin", "users-overview"],
    queryFn: getUserAdministrationOverview,
  });
  const users = usersQuery.data?.users ?? [];
  const pagination = usersQuery.data?.pagination;
  const selectedUser =
    users.find((user) => user.userId === selectedUserId) ?? null;

  const stats = overviewQuery.data;

  const refreshUsers = async (message: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "users-overview"] }),
    ]);
    setNotice(message);
  };

  const resetPageAndSelection = () => {
    setPage(1);
    setSelectedUserId(null);
  };

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: Pick<AdminUser, "userId" | "role">) =>
      assignUserRole(userId, role),
    onSuccess: () => refreshUsers(t("admin.roleSuccess")),
    onError: (error: Error) =>
      setNotice(`${t("admin.error")}: ${error.message}`),
  });
  const statusMutation = useMutation({
    mutationFn: (user: AdminUser) =>
      user.status === "active"
        ? suspendUser(user.userId)
        : activateUser(user.userId),
    onSuccess: (_data, user) =>
      refreshUsers(
        t(
          user.status === "active"
            ? "admin.suspendSuccess"
            : "admin.activateSuccess",
        ),
      ),
    onError: (error: Error) =>
      setNotice(`${t("admin.error")}: ${error.message}`),
  });

  const isMutating = roleMutation.isPending || statusMutation.isPending;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-7xl"
    >
      <div className="overflow-hidden rounded-[2rem] border border-slate-800/90 bg-slate-900/70 shadow-glow">
        <div className="border-b border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/60 px-6 py-8 sm:px-9">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-sky-400">
                <ShieldCheck className="h-4 w-4" />
                {t("admin.eyebrow")}
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
                {t("admin.title")}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                {t("admin.description")}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                void Promise.all([
                  usersQuery.refetch(),
                  overviewQuery.refetch(),
                ])
              }
              disabled={usersQuery.isFetching || overviewQuery.isFetching}
              className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-sky-500/50 hover:text-white disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${usersQuery.isFetching || overviewQuery.isFetching ? "animate-spin" : ""}`}
              />
              {t("admin.refresh")}
            </button>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              icon={Users}
              label={t("admin.totalUsers")}
              value={stats?.total ?? "—"}
            />
            <Stat
              icon={UserCheck}
              label={t("admin.activeUsers")}
              value={stats?.active ?? "—"}
              tone="emerald"
            />
            <Stat
              icon={Ban}
              label={t("admin.suspendedUsers")}
              value={stats?.suspended ?? "—"}
              tone="rose"
            />
            <Stat
              icon={ShieldCheck}
              label={t("admin.adminUsers")}
              value={stats?.administrators ?? "—"}
              tone="violet"
            />
          </div>
          {overviewQuery.isError ? (
            <p className="mt-3 text-sm text-rose-300">
              {t("admin.overviewError")}
            </p>
          ) : null}
        </div>

        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <label className="relative block w-full xl:max-w-md">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <span className="sr-only">{t("admin.search")}</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("admin.searchPlaceholder")}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-500/70"
              />
            </label>
            <div
              className="flex flex-wrap gap-2"
              aria-label={t("admin.filters")}
            >
              <FilterSelect
                label={t("admin.role")}
                value={role ?? ""}
                onChange={(value) => {
                  setRole(value ? (value as AdminUser["role"]) : undefined);
                  resetPageAndSelection();
                }}
                options={[
                  ["user", t("admin.roleValue.user")],
                  ["admin", t("admin.roleValue.admin")],
                ]}
                allLabel={t("admin.filter.allRoles")}
              />
              <FilterSelect
                label={t("admin.status")}
                value={status ?? ""}
                onChange={(value) => {
                  setStatus(value ? (value as AdminUser["status"]) : undefined);
                  resetPageAndSelection();
                }}
                options={[
                  ["active", t("admin.statusValue.active")],
                  ["suspended", t("admin.statusValue.suspended")],
                ]}
                allLabel={t("admin.filter.allStatuses")}
              />
              <FilterSelect
                label={t("admin.emailVerification")}
                value={emailVerified === undefined ? "" : String(emailVerified)}
                onChange={(value) => {
                  setEmailVerified(value === "" ? undefined : value === "true");
                  resetPageAndSelection();
                }}
                options={[
                  ["true", t("admin.verified")],
                  ["false", t("admin.notVerified")],
                ]}
                allLabel={t("admin.filter.allVerification")}
              />
            </div>
          </div>

          {usersQuery.isLoading ? (
            <div className="py-20 text-center text-slate-400">
              {t("common.loading")}
            </div>
          ) : usersQuery.isError ? (
            <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200">
              {t("admin.loadError")}
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800">
              <div className="hidden grid-cols-[minmax(15rem,1fr)_9rem_9rem_11rem_3rem] gap-4 border-b border-slate-800 bg-slate-950/80 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 md:grid">
                <span>{t("admin.user")}</span>
                <span>{t("admin.role")}</span>
                <span>{t("admin.status")}</span>
                <span>{t("admin.createdAt")}</span>
                <span />
              </div>
              {users.length === 0 ? (
                <p className="px-5 py-14 text-center text-sm text-slate-500">
                  {t("admin.empty")}
                </p>
              ) : (
                users.map((user) => (
                  <button
                    key={user.userId}
                    type="button"
                    onClick={() => setSelectedUserId(user.userId)}
                    className="grid w-full gap-3 border-b border-slate-800/80 bg-slate-900/30 px-5 py-4 text-left transition last:border-b-0 hover:bg-slate-800/50 md:grid-cols-[minmax(15rem,1fr)_9rem_9rem_11rem_3rem] md:items-center md:gap-4"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sky-300">
                        <CircleUserRound className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-white">
                          {user.email}
                          {user.userId === currentUserId ? (
                            <span className="ml-2 text-xs text-sky-400">
                              {t("admin.you")}
                            </span>
                          ) : null}
                        </span>
                        <span className="block truncate font-mono text-xs text-slate-500">
                          {user.userId}
                        </span>
                      </span>
                    </span>
                    <Badge tone={user.role === "admin" ? "violet" : "slate"}>
                      {t(`admin.roleValue.${user.role}`)}
                    </Badge>
                    <Badge tone={user.status === "active" ? "emerald" : "rose"}>
                      {t(`admin.statusValue.${user.status}`)}
                    </Badge>
                    <span className="text-sm text-slate-400">
                      {new Intl.DateTimeFormat(i18n.language, {
                        dateStyle: "medium",
                      }).format(new Date(user.createdAt))}
                    </span>
                    <ChevronRight className="hidden h-5 w-5 text-slate-600 md:block" />
                  </button>
                ))
              )}
            </div>
          )}
          {usersQuery.isFetching && !usersQuery.isLoading ? (
            <p className="mt-3 text-xs text-sky-300" role="status">
              {t("admin.refreshing")}
            </p>
          ) : null}
          {pagination ? (
            <div className="mt-4 flex flex-col gap-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {t("admin.pagination.summary", {
                  from:
                    pagination.total === 0
                      ? 0
                      : (pagination.page - 1) * pagination.pageSize + 1,
                  to: Math.min(
                    pagination.page * pagination.pageSize,
                    pagination.total,
                  ),
                  total: pagination.total,
                })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || usersQuery.isFetching}
                  onClick={() => {
                    setPage((current) => current - 1);
                    setSelectedUserId(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-2 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t("admin.pagination.previous")}
                </button>
                <span>
                  {t("admin.pagination.page", {
                    page: pagination.page,
                    totalPages: Math.max(pagination.totalPages, 1),
                  })}
                </span>
                <button
                  type="button"
                  disabled={
                    page >= pagination.totalPages || usersQuery.isFetching
                  }
                  onClick={() => {
                    setPage((current) => current + 1);
                    setSelectedUserId(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-2 disabled:opacity-40"
                >
                  {t("admin.pagination.next")}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {selectedUser ? (
          <UserPanel
            key={selectedUser.userId}
            user={selectedUser}
            isSelf={selectedUser.userId === currentUserId}
            isMutating={isMutating}
            onClose={() => setSelectedUserId(null)}
            onRoleChange={(role) =>
              roleMutation.mutate({ userId: selectedUser.userId, role })
            }
            onStatusChange={() => statusMutation.mutate(selectedUser)}
          />
        ) : null}
      </AnimatePresence>

      {notice ? (
        <div className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 shadow-2xl">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label={t("admin.close")}
          >
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      ) : null}
    </motion.section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
  allLabel: string;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-full border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm text-slate-300 outline-none focus:border-sky-500"
      >
        <option value="">{allLabel}</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function UserPanel({
  user,
  isSelf,
  isMutating,
  onClose,
  onRoleChange,
  onStatusChange,
}: {
  user: AdminUser;
  isSelf: boolean;
  isMutating: boolean;
  onClose: () => void;
  onRoleChange: (role: AdminUser["role"]) => void;
  onStatusChange: () => void;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const sessionsQuery = useQuery({
    queryKey: ["admin", "sessions", user.userId],
    queryFn: () => listUserSessions(user.userId),
  });
  const revokeMutation = useMutation({
    mutationFn: (sessionId?: string) =>
      revokeUserSession(user.userId, sessionId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["admin", "sessions", user.userId],
      }),
  });

  const confirmRevoke = (sessionId?: string) => {
    const message = sessionId
      ? t("admin.confirmRevokeOne")
      : t("admin.confirmRevokeAll");
    if (window.confirm(message)) {
      revokeMutation.mutate(sessionId);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 14 }}
      className="mt-6 rounded-[2rem] border border-slate-800 bg-slate-900/90 p-6 shadow-glow sm:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-400">
            {t("admin.userDetails")}
          </p>
          <h3 className="mt-2 truncate text-2xl font-semibold text-white">
            {user.email}
          </h3>
          <p className="mt-1 break-all font-mono text-xs text-slate-500">
            {user.userId}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-700 p-2 text-slate-400 hover:text-white"
          aria-label={t("admin.close")}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
          <h4 className="font-semibold text-white">
            {t("admin.accountManagement")}
          </h4>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">{t("admin.emailVerification")}</dt>
              <dd className="mt-1 text-slate-200">
                {t(
                  user.isEmailVerified ? "admin.verified" : "admin.notVerified",
                )}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("admin.lastUpdate")}</dt>
              <dd className="mt-1 text-slate-200">
                {new Intl.DateTimeFormat(i18n.language, {
                  dateStyle: "medium",
                }).format(new Date(user.updatedAt))}
              </dd>
            </div>
          </dl>
          <label className="mt-5 block text-sm text-slate-300">
            {t("admin.role")}
            <select
              value={user.role}
              disabled={isSelf || isMutating}
              onChange={(event) =>
                onRoleChange(event.target.value as AdminUser["role"])
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-sky-500 disabled:opacity-50"
            >
              <option value="user">{t("admin.roleValue.user")}</option>
              <option value="admin">{t("admin.roleValue.admin")}</option>
            </select>
          </label>
          <button
            type="button"
            disabled={isSelf || isMutating}
            onClick={onStatusChange}
            className={`mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-40 ${user.status === "active" ? "bg-rose-500/90 hover:bg-rose-500" : "bg-emerald-500/90 hover:bg-emerald-500"}`}
          >
            {t(user.status === "active" ? "admin.suspend" : "admin.activate")}
          </button>
          {isSelf ? (
            <p className="mt-3 text-xs leading-5 text-amber-300">
              {t("admin.selfProtection")}
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="flex items-center gap-2 font-semibold text-white">
                <KeyRound className="h-4 w-4 text-sky-400" />
                {t("admin.sessions")}
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                {t("admin.sessionsDescription")}
              </p>
            </div>
            <button
              type="button"
              disabled={!sessionsQuery.data?.length || revokeMutation.isPending}
              onClick={() => confirmRevoke()}
              className="rounded-full border border-rose-500/40 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/10 disabled:opacity-40"
            >
              {t("admin.revokeAll")}
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {sessionsQuery.isLoading ? (
              <p className="py-6 text-center text-sm text-slate-500">
                {t("common.loading")}
              </p>
            ) : null}
            {sessionsQuery.data?.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                {t("admin.noSessions")}
              </p>
            ) : null}
            {sessionsQuery.data?.map((session) => (
              <div
                key={session.sessionId}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3"
              >
                <SessionSummary session={session} compact />
                <button
                  type="button"
                  disabled={revokeMutation.isPending}
                  onClick={() => confirmRevoke(session.sessionId)}
                  className="shrink-0 rounded-lg p-2 text-rose-400 hover:bg-rose-500/10"
                  title={t("admin.revokeOne")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            {sessionsQuery.isError || revokeMutation.isError ? (
              <p className="text-xs text-rose-300">
                {t("admin.sessionsError")}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "slate" | "emerald" | "rose" | "violet";
}) {
  const tones = {
    slate: "border-slate-700 bg-slate-800/70 text-slate-300",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    rose: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    violet: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  };
  return (
    <span
      className={`w-fit rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = "sky",
}: {
  icon: typeof Users;
  label: string;
  value: React.ReactNode;
  tone?: "sky" | "emerald" | "rose" | "violet";
}) {
  const tones = {
    sky: "text-sky-300 bg-sky-500/10",
    emerald: "text-emerald-300 bg-emerald-500/10",
    rose: "text-rose-300 bg-rose-500/10",
    violet: "text-violet-300 bg-violet-500/10",
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/50 p-4">
      <span className={`rounded-xl p-2.5 ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-2xl font-semibold text-white">{value}</span>
        <span className="text-xs text-slate-400">{label}</span>
      </span>
    </div>
  );
}
