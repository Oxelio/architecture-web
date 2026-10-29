// @file apps/web/src/pages/SignInPage.tsx

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import {
  getPublicCapabilities,
  signIn,
  verifyMfaChallenge,
} from "#services/api";

interface SignInFormValues {
  loginKind: "username" | "email";
  loginValue: string;
  password: string;
}

export function SignInPage() {
  const { t } = useTranslation();
  const signInSchema = useMemo(
    () =>
      z.object({
        loginKind: z.enum(["username", "email"]),
        loginValue: z.string().min(1),
        password: z.string().min(8, { message: t("auth.passwordMin") }),
      }),
    [t],
  );
  const [serverError, setServerError] = useState<string | null>(null);
  const capabilitiesQuery = useQuery({
    queryKey: ["public-capabilities"],
    queryFn: getPublicCapabilities,
    staleTime: 60_000,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { loginKind: "email" },
  });

  useEffect(() => {
    const allowed = capabilitiesQuery.data?.allowedLoginIdentifiers;
    if (allowed?.length && !allowed.includes(getValues("loginKind"))) {
      setValue("loginKind", allowed[0], { shouldValidate: true });
    }
  }, [capabilitiesQuery.data, getValues, setValue]);

  const onSubmit = async (values: SignInFormValues) => {
    setServerError(null);
    setIsSubmitting(true);

    try {
      const result = await signIn({
        login: { kind: values.loginKind, value: values.loginValue },
        password: values.password,
      });
      if (result?.mfaRequired) {
        setChallengeId(result.challengeId);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      navigate("/profile", { replace: true });
    } catch (error) {
      if (error instanceof Error) {
        setServerError(error.message ?? t("common.unknownError"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitSecondFactor = async () => {
    if (!challengeId) {
      return;
    }
    setServerError(null);
    setIsSubmitting(true);
    try {
      await verifyMfaChallenge(challengeId, mfaCode);
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      navigate("/profile", { replace: true });
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : t("common.unknownError"),
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
          {t("nav.signIn")}
        </p>
        <h2 className="text-3xl font-semibold text-white">
          {t("auth.signInTitle")}
        </h2>
        <p className="text-sm leading-7 text-slate-400">
          {t("auth.signInDescription")}
        </p>
      </div>

      {challengeId ? (
        <div className="mt-8 space-y-5">
          <label className="block text-sm font-medium text-slate-200">
            Code de l’application ou code de secours
            <input
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value)}
              autoComplete="one-time-code"
              inputMode="numeric"
              className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-center font-mono text-lg tracking-[0.3em] text-white outline-none focus:border-sky-400/80"
            />
          </label>
          {serverError ? (
            <p className="text-sm text-rose-400">{serverError}</p>
          ) : null}
          <button
            type="button"
            disabled={isSubmitting || mfaCode.length < 6}
            onClick={() => void submitSecondFactor()}
            className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-sky-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Vérifier le second facteur
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-200">
              Identifiant de connexion
              {(capabilitiesQuery.data?.allowedLoginIdentifiers.length ?? 0) >
              1 ? (
                <select
                  className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-white"
                  {...register("loginKind")}
                >
                  {capabilitiesQuery.data?.allowedLoginIdentifiers.map(
                    (kind) => (
                      <option key={kind} value={kind}>
                        {kind === "email" ? t("common.email") : "Pseudonyme"}
                      </option>
                    ),
                  )}
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
                autoComplete="current-password"
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? t("auth.signInPending") : t("auth.signInSubmit")}
          </button>
        </form>
      )}

      <div className="mt-8 text-center text-sm text-slate-400">
        {t("auth.signInLinkText")} {""}
        <Link
          to="/signup"
          className="font-semibold text-white hover:text-sky-300"
        >
          {t("auth.signInLinkAction")}
        </Link>
        <span className="mx-2">·</span>
        <Link
          to="/recovery"
          className="font-semibold text-white hover:text-sky-300"
        >
          Mot de passe oublié
        </Link>
      </div>
    </motion.div>
  );
}
