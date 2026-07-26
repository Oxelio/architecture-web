// @file apps/web/src/pages/SignUpPage.tsx

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { signUp } from "#services/api";

interface SignUpFormValues {
  email: string;
  password: string;
}

export function SignUpPage() {
  const { t } = useTranslation();
  const signUpSchema = useMemo(
    () =>
      z.object({
        email: z.email({ message: t("auth.invalidEmail") }),
        password: z.string().min(8, { message: t("auth.passwordMin") }),
      }),
    [t],
  );
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = async (values: SignUpFormValues) => {
    setServerMessage(null);
    setServerError(null);
    setIsSubmitting(true);

    try {
      await signUp(values);
      setServerMessage(t("auth.signUpSuccess"));
      setTimeout(() => navigate("/signin", { replace: true }), 2500);
    } catch (error) {
      if (error instanceof Error) {
        setServerError(error.message ?? t("common.unknownError"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto max-w-lg rounded-[2rem] border border-slate-800/90 bg-slate-900/80 p-10 shadow-glow"
    >
      <div className="space-y-4 text-center">
        <p className="text-sm uppercase tracking-[0.28em] text-sky-400/80">
          {t("nav.signUp")}
        </p>
        <h2 className="text-3xl font-semibold text-white">
          {t("auth.signUpTitle")}
        </h2>
        <p className="text-sm leading-7 text-slate-400">
          {t("auth.signUpDescription")}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-200">
            {t("common.email")}
            <input
              type="email"
              autoComplete="email"
              className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/80 focus:ring-2 focus:ring-sky-400/20"
              {...register("email")}
            />
            {errors.email && (
              <p className="mt-2 text-sm text-rose-400">
                {errors.email.message}
              </p>
            )}
          </label>

          <label className="block text-sm font-medium text-slate-200">
            {t("common.password")}
            <input
              type="password"
              autoComplete="new-password"
              className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/80 focus:ring-2 focus:ring-sky-400/20"
              {...register("password")}
            />
            {errors.password && (
              <p className="mt-2 text-sm text-rose-400">
                {errors.password.message}
              </p>
            )}
          </label>
        </div>

        {serverError ? (
          <p className="text-sm text-rose-400">{serverError}</p>
        ) : null}
        {serverMessage ? (
          <p className="text-sm text-sky-300">{serverMessage}</p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? t("auth.signUpPending") : t("auth.signUpSubmit")}
        </button>
      </form>

      <div className="mt-8 text-center text-sm text-slate-400">
        {t("auth.signUpLinkText")} {""}
        <Link
          to="/signin"
          className="font-semibold text-white hover:text-sky-300"
        >
          {t("auth.signUpLinkAction")}
        </Link>
      </div>
    </motion.div>
  );
}
