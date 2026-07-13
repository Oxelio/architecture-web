// @file apps/web/src/pages/VerifyEmailPage.tsx

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { verifyEmail } from "../services/api";

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const hasToken = Boolean(token);
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    hasToken ? "loading" : "error",
  );
  const [message, setMessage] = useState<string>(
    hasToken ? t("verify.loading") : t("verify.invalidLink"),
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    verifyEmail(token)
      .then(() => {
        setStatus("success");
        setMessage(t("verify.success"));
      })
      .catch(() => {
        setStatus("error");
        setMessage(t("verify.error"));
      });
  }, [t, token]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto max-w-2xl rounded-[2rem] border border-slate-800/90 bg-slate-900/80 p-10 shadow-glow"
    >
      <div className="space-y-4 text-center">
        <p className="text-sm uppercase tracking-[0.28em] text-sky-400/80">
          {t("verify.eyebrow")}
        </p>
        <h2 className="text-3xl font-semibold text-white">
          {t("verify.title")}
        </h2>
        <p className="text-sm leading-7 text-slate-400">{message}</p>
      </div>

      <div
        className={`mt-8 rounded-3xl border px-6 py-5 text-sm ${
          status === "success"
            ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
            : "border-rose-500 bg-rose-500/10 text-rose-200"
        }`}
      >
        {status === "loading" ? t("verify.waiting") : message}
      </div>
    </motion.div>
  );
}
