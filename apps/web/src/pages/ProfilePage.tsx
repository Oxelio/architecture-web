// @file apps/web/src/pages/ProfilePage.tsx

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { CurrentUser } from "../services/api";
import {
  changeEmail,
  changePassword,
  resendEmailVerification,
  signOut,
} from "../services/api";

interface ProfilePageProps {
  user: CurrentUser;
}

export function ProfilePage({ user }: Readonly<ProfilePageProps>) {
  const { t } = useTranslation();
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const emailMutation = useMutation({
    mutationFn: changeEmail,
    onSuccess: () => {
      setServerMessage(t("profile.successEmail"));
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
    onError: (error: unknown) => {
      setServerMessage(
        error instanceof Error
          ? `${t("profile.emailUpdateError")}: ${error.message}`
          : t("profile.emailUpdateError"),
      );
    },
  });

  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setServerMessage(t("profile.successPassword"));
      setPassword("");
    },
    onError: (error: unknown) => {
      setServerMessage(
        error instanceof Error
          ? `${t("profile.passwordUpdateError")}: ${error.message}`
          : t("profile.passwordUpdateError"),
      );
    },
  });

  const signOutMutation = useMutation({
    mutationFn: async () => signOut(),
    onSuccess: () => {
      queryClient.setQueryData(["currentUser"], null);
    },
    onError: () => {
      setServerMessage(t("profile.signOutError"));
    },
  });

  const handleSignOut = async () => {
    try {
      await signOutMutation.mutateAsync();
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      window.location.assign("/signin");
    } catch {
      setServerMessage(t("profile.signOutError"));
    }
  };

  const resendVerificationMutation = useMutation({
    mutationFn: resendEmailVerification,
    onSuccess: () => {
      setServerMessage(t("profile.successVerificationEmail"));
    },
    onError: (error: unknown) => {
      setServerMessage(
        error instanceof Error
          ? `${t("profile.verificationEmailError")}: ${error.message}`
          : t("profile.verificationEmailError"),
      );
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto max-w-5xl space-y-10 rounded-[2rem] border border-slate-800/90 bg-slate-900/80 p-10 shadow-glow"
    >
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-sky-400/80">
              {t("profile.title")}
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-white">
              {t("profile.welcome", { email: user.email })}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              {t("profile.description")}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
              {t("profile.identifier")}
            </p>
            <p className="mt-3 text-xl font-semibold text-white break-words">
              {user.userId}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
              {t("profile.email")}
            </p>
            <p className="mt-3 text-xl font-semibold text-white break-words">
              {user.email}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
              {t("profile.emailVerification")}
            </p>

            <div className="mt-3 flex items-center gap-3">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                  user.isEmailVerified
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-amber-500/20 text-amber-300"
                }`}
              >
                {user.isEmailVerified
                  ? t("profile.emailVerified")
                  : t("profile.emailNotVerified")}
              </span>
            </div>

            {!user.isEmailVerified ? (
              <div className="mt-5">
                <p className="text-sm text-slate-400">
                  {t("profile.emailVerificationHint")}
                </p>

                <button
                  type="button"
                  onClick={() => resendVerificationMutation.mutate()}
                  disabled={resendVerificationMutation.isPending}
                  className="mt-4 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resendVerificationMutation.isPending
                    ? t("profile.resendVerificationPending")
                    : t("profile.resendVerification")}
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center justify-center rounded-full bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={signOutMutation.isPending}
          >
            {signOutMutation.isPending
              ? t("profile.signOutPending")
              : t("profile.signOut")}
          </button>
        </div>

        <div className="space-y-8">
          <section className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
                  {t("profile.updateEmailTitle")}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {t("profile.updateEmailDescription")}
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-slate-200">
                {t("profile.newEmail")}
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/80 focus:ring-2 focus:ring-sky-400/20"
                />
              </label>
              <button
                type="button"
                onClick={() => emailMutation.mutate({ email })}
                disabled={emailMutation.isPending}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {emailMutation.isPending
                  ? t("profile.updateEmailPending")
                  : t("profile.updateEmailSubmit")}
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
                  {t("profile.updatePasswordTitle")}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {t("profile.updatePasswordDescription")}
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-slate-200">
                {t("profile.newPassword")}
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/80 focus:ring-2 focus:ring-sky-400/20"
                />
              </label>
              <button
                type="button"
                onClick={() => passwordMutation.mutate({ password })}
                disabled={passwordMutation.isPending || password.length < 8}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {passwordMutation.isPending
                  ? t("profile.updatePasswordPending")
                  : t("profile.updatePasswordSubmit")}
              </button>
              {password.length > 0 && password.length < 8 ? (
                <p className="text-sm text-amber-300">
                  {t("profile.passwordHint")}
                </p>
              ) : null}
            </div>
          </section>

          {serverMessage ? (
            <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-5 text-sm text-slate-200">
              {serverMessage}
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
