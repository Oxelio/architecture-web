// @file apps/web/src/pages/SignUpPage.tsx

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import {
  getPasswordPolicy,
  getPublicCapabilities,
  signUp,
} from "#services/api";

interface SignUpFormValues {
  loginKind: "username" | "email";
  loginValue: string;
  password: string;
  passwordConfirmation: string;
}

type SignUpError = "accountAlreadyExists" | "generic";

export function SignUpPage() {
  const { t } = useTranslation();
  const policyQuery = useQuery({
    queryKey: ["password-policy"],
    queryFn: getPasswordPolicy,
    staleTime: 5 * 60 * 1000,
  });
  const capabilitiesQuery = useQuery({
    queryKey: ["public-capabilities"],
    queryFn: getPublicCapabilities,
    staleTime: 60_000,
  });
  const registrationAvailable =
    capabilitiesQuery.data?.publicRegistration !== false;
  const minimumLength = policyQuery.data?.minLength ?? 15;
  const maximumLength = policyQuery.data?.maxLength ?? 128;
  const signUpSchema = useMemo(
    () =>
      z
        .object({
          loginKind: z.enum(["username", "email"]),
          loginValue: z.string().min(1),
          password: z
            .string()
            .min(minimumLength, {
              message: t("auth.passwordMin", { count: minimumLength }),
            })
            .max(maximumLength),
          passwordConfirmation: z.string(),
        })
        .refine((values) => values.password === values.passwordConfirmation, {
          path: ["passwordConfirmation"],
          message: t("auth.passwordConfirmationMismatch"),
        })
        .refine(
          (values) =>
            values.loginKind !== "email" ||
            z.email().safeParse(values.loginValue).success,
          { path: ["loginValue"], message: t("auth.invalidEmail") },
        )
        .refine(
          (values) =>
            values.loginKind !== "username" ||
            /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}$/.test(values.loginValue),
          {
            path: ["loginValue"],
            message: "Le pseudonyme doit contenir entre 3 et 32 caractères.",
          },
        ),
    [maximumLength, minimumLength, t],
  );
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [serverError, setServerError] = useState<SignUpError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { loginKind: "email" },
  });

  useEffect(() => {
    const allowed = capabilitiesQuery.data?.allowedLoginIdentifiers;
    if (allowed?.length && !allowed.includes(getValues("loginKind"))) {
      setValue("loginKind", allowed[0], { shouldValidate: true });
    }
  }, [capabilitiesQuery.data, getValues, setValue]);

  const onSubmit = async (values: SignUpFormValues) => {
    setIsSuccessful(false);
    setServerError(null);
    setIsSubmitting(true);

    try {
      await signUp({
        login: { kind: values.loginKind, value: values.loginValue },
        password: values.password,
        passwordConfirmation: values.passwordConfirmation,
      });
      setIsSuccessful(true);
      setTimeout(() => navigate("/signin", { replace: true }), 2500);
    } catch (error) {
      setServerError(
        error instanceof Error && error.message === "USER_ALREADY_EXISTS"
          ? "accountAlreadyExists"
          : "generic",
      );
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
        {!registrationAvailable ? (
          <p
            role="status"
            className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-200"
          >
            {t("auth.signUpUnavailable", {
              defaultValue:
                "L’inscription publique est actuellement désactivée.",
            })}
          </p>
        ) : null}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-200">
            Identifiant de connexion
            {(capabilitiesQuery.data?.allowedLoginIdentifiers.length ?? 0) >
            1 ? (
              <select
                className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-white"
                {...register("loginKind")}
              >
                {capabilitiesQuery.data?.allowedLoginIdentifiers.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind === "email" ? t("common.email") : "Pseudonyme"}
                  </option>
                ))}
              </select>
            ) : null}
            <input
              type="text"
              autoComplete="username"
              className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/80 focus:ring-2 focus:ring-sky-400/20"
              {...register("loginValue")}
            />
            {errors.loginValue && (
              <p className="mt-2 text-sm text-rose-400">
                {errors.loginValue.message}
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
            <p className="mt-2 text-xs text-slate-500">
              {t("auth.passwordPolicyHint", {
                min: minimumLength,
                max: maximumLength,
              })}
            </p>
          </label>

          <label className="block text-sm font-medium text-slate-200">
            {t("common.passwordConfirmation")}
            <input
              type="password"
              autoComplete="new-password"
              className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/80 focus:ring-2 focus:ring-sky-400/20"
              {...register("passwordConfirmation")}
            />
            {errors.passwordConfirmation && (
              <p className="mt-2 text-sm text-rose-400">
                {errors.passwordConfirmation.message}
              </p>
            )}
          </label>
        </div>

        {serverError ? (
          <p className="text-sm text-rose-400">
            {t(
              serverError === "accountAlreadyExists"
                ? "auth.accountAlreadyExists"
                : "auth.signUpError",
            )}
          </p>
        ) : null}
        {isSuccessful ? (
          <p className="text-sm text-sky-300">{t("auth.signUpSuccess")}</p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || !registrationAvailable}
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
