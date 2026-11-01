// @file apps/web/src/pages/ProfilePage.tsx

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Copy,
  KeyRound,
  Laptop,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { SecurityCenter } from "#components/SecurityCenter";
import { SessionSummary } from "#components/SessionSummary";
import { accountDisplayIdentifier, type CurrentUser } from "#services/api";
import {
  changeEmail,
  changePassword,
  getPasswordPolicy,
  listCurrentUserSessions,
  resendEmailVerification,
  revokeCurrentUserSession,
  signOut,
} from "#services/api";

interface ProfilePageProps {
  user: CurrentUser;
}

interface Feedback {
  tone: "success" | "error";
  message: string;
}

const fieldClassName =
  "mt-2 w-full rounded-2xl border border-slate-700/80 bg-slate-950/70 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10";

export function ProfilePage({ user }: Readonly<ProfilePageProps>) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(user.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    [i18n.language],
  );
  const sessionsQuery = useQuery({
    queryKey: ["currentUserSessions"],
    queryFn: listCurrentUserSessions,
  });
  const policyQuery = useQuery({
    queryKey: ["password-policy"],
    queryFn: getPasswordPolicy,
    staleTime: 5 * 60 * 1000,
  });
  const minimumPasswordLength = policyQuery.data?.minLength ?? 15;

  const emailMutation = useMutation({
    mutationFn: changeEmail,
    onSuccess: async () => {
      setFeedback({ tone: "success", message: t("profile.successEmail") });
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
    onError: (error: unknown) => {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? `${t("profile.emailUpdateError")}: ${error.message}`
            : t("profile.emailUpdateError"),
      });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setFeedback({ tone: "success", message: t("profile.successPassword") });
      setCurrentPassword("");
      setPassword("");
      setPasswordConfirmation("");
    },
    onError: (error: unknown) => {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? `${t("profile.passwordUpdateError")}: ${error.message}`
            : t("profile.passwordUpdateError"),
      });
    },
  });

  const resendVerificationMutation = useMutation({
    mutationFn: resendEmailVerification,
    onSuccess: () => {
      setFeedback({
        tone: "success",
        message: t("profile.successVerificationEmail"),
      });
    },
    onError: (error: unknown) => {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? `${t("profile.verificationEmailError")}: ${error.message}`
            : t("profile.verificationEmailError"),
      });
    },
  });

  const revokeSessionMutation = useMutation({
    mutationFn: revokeCurrentUserSession,
    onSuccess: async (_data, revokedSessionId) => {
      const revokedCurrentSession = sessionsQuery.data?.some(
        (session) =>
          session.sessionId === revokedSessionId && session.isCurrent,
      );
      if (revokedCurrentSession) {
        queryClient.setQueryData(["currentUser"], null);
        window.location.assign("/signin");
        return;
      }
      setFeedback({
        tone: "success",
        message: t("profile.sessionRevoked"),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["currentUserSessions"] }),
        queryClient.invalidateQueries({ queryKey: ["currentUser"] }),
      ]);
    },
    onError: () => {
      setFeedback({ tone: "error", message: t("profile.sessionsError") });
    },
  });

  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.setQueryData(["currentUser"], null);
      window.location.assign("/signin");
    },
    onError: () => {
      setFeedback({ tone: "error", message: t("profile.signOutError") });
    },
  });

  const passwordScore = [
    [...password].length >= minimumPasswordLength,
    [...password].length >= 20,
    [...password].length >= 28,
    new Set(password).size >= 10,
  ].filter(Boolean).length;
  const completedSteps = user.email !== null && user.isEmailVerified ? 3 : 2;
  const profileLabel = accountDisplayIdentifier(user);
  const profileInitial = profileLabel.charAt(0).toUpperCase();

  const copyIdentifier = async () => {
    try {
      await navigator.clipboard.writeText(user.userId);
      setFeedback({ tone: "success", message: t("profile.identifierCopied") });
    } catch {
      setFeedback({ tone: "error", message: t("profile.copyError") });
    }
  };

  const handleRevokeSession = (sessionId: string) => {
    const session = sessionsQuery.data?.find(
      (candidate) => candidate.sessionId === sessionId,
    );
    const confirmationKey = session?.isCurrent
      ? "profile.confirmRevokeCurrentSession"
      : "profile.confirmRevokeSession";
    if (window.confirm(t(confirmationKey))) {
      revokeSessionMutation.mutate(sessionId);
    }
  };

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-6xl space-y-6"
    >
      {renderProfileHeader()}

      {user.email !== null && !user.isEmailVerified ? (
        <section className="flex flex-col gap-4 rounded-3xl border border-amber-400/20 bg-amber-400/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
              <CircleAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-100">
                {t("profile.verificationCalloutTitle")}
              </h3>
              <p className="mt-1 text-sm leading-6 text-amber-100/60">
                {t("profile.emailVerificationHint")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => resendVerificationMutation.mutate()}
            disabled={resendVerificationMutation.isPending}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 py-3 text-sm font-semibold text-amber-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resendVerificationMutation.isPending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            {resendVerificationMutation.isPending
              ? t("profile.resendVerificationPending")
              : t("profile.resendVerification")}
          </button>
        </section>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-6">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/75 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                  {t("profile.accountProgress")}
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {completedSteps}/3
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all"
                style={{ width: `${(completedSteps / 3) * 100}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              {user.isEmailVerified
                ? t("profile.accountReady")
                : t("profile.accountIncomplete")}
            </p>
          </section>

          <nav
            aria-label={t("profile.sections")}
            className="rounded-3xl border border-slate-800 bg-slate-900/75 p-2"
          >
            {[
              {
                href: "#iam",
                icon: UserRound,
                label: t("profile.identitySection"),
              },
              {
                href: "#security",
                icon: LockKeyhole,
                label: t("profile.securitySection"),
              },
              {
                href: "#sessions",
                icon: Laptop,
                label: t("profile.sessionsSection"),
              },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-slate-800/70 hover:text-white"
              >
                <item.icon className="h-4 w-4 text-slate-500 transition group-hover:text-sky-400" />
                <span>{item.label}</span>
                <ChevronRight className="ml-auto h-4 w-4 opacity-0 transition group-hover:opacity-100" />
              </a>
            ))}
          </nav>
        </aside>

        <div className="space-y-6">
          <section
            id="identity"
            className="scroll-mt-6 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/75"
          >
            <div className="border-b border-slate-800 p-6 sm:p-7">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {t("profile.identitySection")}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    {t("profile.identityDescription")}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {t("profile.memberSince")}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-200">
                    {dateFormatter.format(new Date(user.createdAt))}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    <RefreshCw className="h-3.5 w-3.5" />
                    {t("profile.lastUpdate")}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-200">
                    {dateFormatter.format(new Date(user.updatedAt))}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  {t("profile.identifier")}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <code className="min-w-0 flex-1 truncate text-xs text-slate-300 sm:text-sm">
                    {user.userId}
                  </code>
                  <button
                    type="button"
                    onClick={copyIdentifier}
                    aria-label={t("profile.copyIdentifier")}
                    className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-800 hover:text-white"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <form
              className="p-6 sm:p-7"
              onSubmit={(event) => {
                event.preventDefault();
                emailMutation.mutate({ email });
              }}
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <h4 className="font-semibold text-white">
                    {t("profile.updateEmailTitle")}
                  </h4>
                  <p className="mt-1 text-sm text-slate-400">
                    {t("profile.updateEmailDescription")}
                  </p>
                </div>
                <span
                  className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                    user.isEmailVerified
                      ? "bg-emerald-400/10 text-emerald-300"
                      : "bg-amber-400/10 text-amber-300"
                  }`}
                >
                  {user.isEmailVerified ? (
                    <BadgeCheck className="h-3.5 w-3.5" />
                  ) : (
                    <CircleAlert className="h-3.5 w-3.5" />
                  )}
                  {user.isEmailVerified
                    ? t("profile.emailVerified")
                    : t("profile.emailNotVerified")}
                </span>
              </div>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="block flex-1 text-sm font-medium text-slate-300">
                  {t("profile.newEmail")}
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={fieldClassName}
                  />
                </label>
                <button
                  type="submit"
                  disabled={
                    emailMutation.isPending ||
                    email.trim().toLowerCase() ===
                      (user.email?.toLowerCase() ?? "")
                  }
                  className="inline-flex h-[50px] items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {emailMutation.isPending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  {emailMutation.isPending
                    ? t("profile.updateEmailPending")
                    : t("profile.updateEmailSubmit")}
                </button>
              </div>
            </form>
          </section>

          <section
            id="security"
            className="scroll-mt-6 rounded-3xl border border-slate-800 bg-slate-900/75 p-6 sm:p-7"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-300">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {t("profile.updatePasswordTitle")}
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  {t("profile.updatePasswordDescription")}
                </p>
              </div>
            </div>

            <form
              className="mt-6"
              onSubmit={(event) => {
                event.preventDefault();
                passwordMutation.mutate({
                  currentPassword,
                  password,
                  passwordConfirmation,
                });
              }}
            >
              <label className="block text-sm font-medium text-slate-300">
                {t("profile.currentPassword")}
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className={fieldClassName}
                />
              </label>

              <label className="block text-sm font-medium text-slate-300">
                {t("profile.newPassword")}
                <input
                  type="password"
                  required
                  minLength={minimumPasswordLength}
                  maxLength={policyQuery.data?.maxLength ?? 128}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t("profile.passwordPlaceholder")}
                  className={fieldClassName}
                />
              </label>

              <label className="mt-4 block text-sm font-medium text-slate-300">
                {t("common.passwordConfirmation")}
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={passwordConfirmation}
                  onChange={(event) =>
                    setPasswordConfirmation(event.target.value)
                  }
                  className={fieldClassName}
                />
              </label>

              <div className="mt-4 grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`h-1.5 rounded-full transition ${passwordStrengthColor(
                      passwordScore,
                      level,
                    )}`}
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Check
                      className={`h-3.5 w-3.5 ${
                        [...password].length >= minimumPasswordLength
                          ? "text-emerald-400"
                          : "text-slate-700"
                      }`}
                    />
                    {t("profile.passwordLengthRule", {
                      count: minimumPasswordLength,
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles
                      className={`h-3.5 w-3.5 ${
                        passwordScore >= 3
                          ? "text-emerald-400"
                          : "text-slate-700"
                      }`}
                    />
                    {t("profile.passwordStrengthRule")}
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={
                    passwordMutation.isPending ||
                    !currentPassword ||
                    [...password].length < minimumPasswordLength ||
                    password !== passwordConfirmation
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {passwordMutation.isPending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <LockKeyhole className="h-4 w-4" />
                  )}
                  {passwordMutation.isPending
                    ? t("profile.updatePasswordPending")
                    : t("profile.updatePasswordSubmit")}
                </button>
              </div>
            </form>
          </section>

          <section
            id="sessions"
            className="scroll-mt-6 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/75"
          >
            <div className="flex flex-col gap-4 border-b border-slate-800 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                  <Laptop className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {t("profile.sessionsSection")}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    {t("profile.sessionsDescription")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => sessionsQuery.refetch()}
                disabled={sessionsQuery.isFetching}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    sessionsQuery.isFetching ? "animate-spin" : ""
                  }`}
                />
                {t("profile.refreshSessions")}
              </button>
            </div>

            <div className="p-3 sm:p-4">{renderSessions()}</div>
          </section>
        </div>
      </div>

      {renderFeedback()}
      <SecurityCenter />
    </motion.div>
  );

  function renderSessions() {
    if (sessionsQuery.isLoading) {
      return (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          {t("profile.sessionsLoading")}
        </div>
      );
    }
    if (sessionsQuery.isError) {
      return (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-5 text-sm text-rose-200">
          {t("profile.sessionsError")}
        </div>
      );
    }
    if (sessionsQuery.data?.length) {
      return (
        <div className="divide-y divide-slate-800">
          {sessionsQuery.data.map((session) => (
            <div
              key={session.sessionId}
              className="flex flex-col gap-4 rounded-2xl px-3 py-4 transition hover:bg-slate-800/30 sm:flex-row sm:items-center"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/60 text-slate-400">
                <Laptop className="h-5 w-5" />
              </div>
              <SessionSummary session={session} />
              <button
                type="button"
                onClick={() => handleRevokeSession(session.sessionId)}
                disabled={
                  revokeSessionMutation.isPending &&
                  revokeSessionMutation.variables === session.sessionId
                }
                className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:border-rose-400/40 hover:bg-rose-400/10 hover:text-rose-200 disabled:opacity-40"
              >
                {revokeSessionMutation.isPending &&
                revokeSessionMutation.variables === session.sessionId
                  ? t("profile.revokingSession")
                  : t("profile.revokeSession")}
              </button>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="py-10 text-center">
        <Laptop className="mx-auto h-6 w-6 text-slate-700" />
        <p className="mt-3 text-sm text-slate-500">{t("profile.noSessions")}</p>
      </div>
    );
  }

  function renderProfileHeader() {
    return (
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900/85 p-6 shadow-2xl shadow-slate-950/40 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="flex min-w-0 items-center gap-5">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.6rem] border border-white/10 bg-gradient-to-br from-sky-400 via-indigo-500 to-violet-600 text-3xl font-semibold text-white shadow-lg shadow-indigo-950/50">
              {profileInitial}
              <span
                className={`absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-4 border-slate-900 ${
                  user.isEmailVerified ? "bg-emerald-400" : "bg-amber-400"
                }`}
              >
                {user.isEmailVerified ? (
                  <Check className="h-3.5 w-3.5 text-emerald-950" />
                ) : (
                  <CircleAlert className="h-3.5 w-3.5 text-amber-950" />
                )}
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-400">
                  {t("profile.title")}
                </p>
                <span className="rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-[11px] font-medium text-slate-300">
                  {t(`profile.role.${user.role}`)}
                </span>
              </div>
              <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {profileLabel}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                {t("profile.description")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => signOutMutation.mutate()}
            disabled={signOutMutation.isPending}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-rose-400/50 hover:bg-rose-500/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {signOutMutation.isPending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            {signOutMutation.isPending
              ? t("profile.signOutPending")
              : t("profile.signOut")}
          </button>
        </div>
      </section>
    );
  }

  function renderFeedback() {
    if (!feedback) {
      return null;
    }
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        role="status"
        aria-live="polite"
        className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur ${
          feedback.tone === "success"
            ? "border-emerald-400/20 bg-emerald-950/95 text-emerald-100"
            : "border-rose-400/20 bg-rose-950/95 text-rose-100"
        }`}
      >
        {feedback.tone === "success" ? (
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <p className="text-sm leading-5">{feedback.message}</p>
        <button
          type="button"
          onClick={() => setFeedback(null)}
          className="ml-2 text-xs opacity-60 transition hover:opacity-100"
          aria-label={t("profile.dismissFeedback")}
        >
          ×
        </button>
      </motion.div>
    );
  }
}

function passwordStrengthColor(score: number, level: number): string {
  if (score < level) {
    return "bg-slate-800";
  }
  return score <= 2 ? "bg-amber-400" : "bg-emerald-400";
}
