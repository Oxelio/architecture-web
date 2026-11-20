// @file apps/web/src/pages/VerifyEmailPage.tsx

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { apiErrorKey, errorMessage } from "#app/lib/error-feedback";
import { verifyEmail } from "#services/api";

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const requests = useRef(new Map<string, Promise<string>>());
  const [result, setResult] = useState<{ token: string; key: string } | null>(
    null,
  );
  const key = token
    ? result?.token === token
      ? result.key
      : "verify.loading"
    : "verify.invalidLink";
  const isLoading = key === "verify.loading";
  const isSuccess = key === "verify.success";

  useEffect(() => {
    if (!token) {
      return;
    }

    // A single-use token shares its request across effect cleanup and setup.
    let request = requests.current.get(token);
    if (!request) {
      request = verifyEmail(token).then(
        () => "verify.success",
        (error: unknown) => apiErrorKey(error, "verifyEmail"),
      );
      requests.current.set(token, request);
    }
    let active = true;
    void request.then((key) => {
      if (active) {
        setResult({ token, key });
      }
    });
    return () => {
      active = false;
    };
  }, [token]);

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
        {isLoading ? (
          <p className="text-sm leading-7 text-slate-400">
            {t("verify.loading")}
          </p>
        ) : null}
      </div>

      <div
        role={isLoading || isSuccess ? "status" : "alert"}
        className={`mt-8 rounded-3xl border px-6 py-5 text-sm ${
          isSuccess
            ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
            : "border-rose-500 bg-rose-500/10 text-rose-200"
        }`}
      >
        {isLoading ? t("verify.waiting") : errorMessage(t, key)}
      </div>
    </motion.div>
  );
}
