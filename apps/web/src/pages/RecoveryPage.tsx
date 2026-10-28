import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";

import {
  getPasswordPolicy,
  requestAccountRecovery,
  resetRecoveredPassword,
} from "#services/api";

export function RecoveryPage() {
  const { t } = useTranslation();
  const [parameters] = useSearchParams();
  const token = parameters.get("token");
  const policy = useQuery({
    queryKey: ["password-policy"],
    queryFn: getPasswordPolicy,
    enabled: Boolean(token),
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  const submit = async () => {
    setState("pending");
    setError("");
    try {
      if (token) {
        await resetRecoveredPassword(token, password, confirmation);
      } else {
        await requestAccountRecovery(email);
      }
      setState("success");
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "UNKNOWN_ERROR";
      setError(
        code.startsWith("password.")
          ? t(`passwordFeedback.${code.slice(9)}`, {
              defaultValue: t("passwordFeedback.invalid"),
            })
          : code === "RECOVERY_TOKEN_INVALID"
            ? t("passwordFeedback.recovery_invalid")
            : code === "EMAIL_INVALID"
              ? t("auth.invalidEmail")
              : t("passwordFeedback.unavailable"),
      );
      setState("error");
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-lg rounded-[2rem] border border-slate-800 bg-slate-900/80 p-8 shadow-glow"
    >
      <p className="text-sm uppercase tracking-[0.25em] text-sky-400">
        Récupération sécurisée
      </p>
      <h2 className="mt-3 text-3xl font-semibold text-white">
        {token ? "Choisir un nouveau mot de passe" : "Retrouver votre compte"}
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        {token
          ? "Le lien est temporaire et ne pourra être utilisé qu’une fois."
          : "Si le compte est éligible, nous enverrons des instructions. La réponse reste identique pour toutes les adresses."}
      </p>
      {state === "success" ? (
        <div className="mt-7 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm text-emerald-200">
          {token
            ? "Mot de passe remplacé. Toutes les sessions ont été révoquées."
            : "Si le compte est éligible, les instructions ont été envoyées."}
          <Link to="/signin" className="mt-4 block font-semibold text-white">
            Retour à la connexion
          </Link>
        </div>
      ) : (
        <div className="mt-7 space-y-4">
          {token ? (
            <>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Nouveau mot de passe"
                autoComplete="new-password"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
              />
              <input
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="Confirmation"
                autoComplete="new-password"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
              />
            </>
          ) : (
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Adresse e-mail"
              autoComplete="email"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
            />
          )}
          {state === "error" ? (
            <p className="text-sm text-rose-300">{error}</p>
          ) : null}
          {token && policy.data ? (
            <p className="text-sm text-slate-400">
              {t("auth.passwordPolicyHint", {
                min: policy.data.minLength,
                max: policy.data.maxLength,
              })}{" "}
              {t("passwordFeedback.privileged")}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={
              state === "pending" ||
              (token ? !password || !confirmation : !email)
            }
            className="w-full rounded-full bg-gradient-to-r from-violet-500 to-sky-500 px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {state === "pending"
              ? "Traitement…"
              : token
                ? "Réinitialiser"
                : "Envoyer les instructions"}
          </button>
        </div>
      )}
    </motion.section>
  );
}
