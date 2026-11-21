// @file apps/web/src/pages/VerifyEmailPage.tsx

import { motion } from "framer-motion";
import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { apiErrorKey, errorMessage } from "#app/lib/error-feedback";
import { verifyEmail } from "#services/api";

type VerificationState =
  | { status: "awaiting" }
  | { status: "submitting" }
  | { status: "success" }
  | { status: "error"; key: string };

function readFragmentToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.hash.slice(1));
  const values = params.getAll("token");
  return params.size === 1 && values.length === 1 && values[0]
    ? values[0]
    : null;
}

function verificationMessageKey(
  token: string | null,
  state: VerificationState,
): string {
  if (!token) {
    return "verify.invalidLink";
  }

  switch (state.status) {
    case "awaiting":
      return "verify.awaiting";
    case "submitting":
      return "verify.waiting";
    case "success":
      return "verify.success";
    case "error":
      return state.key;
  }
}

function verificationFeedbackClass(
  isSuccess: boolean,
  isError: boolean,
): string {
  if (isSuccess) {
    return "border-emerald-500 bg-emerald-500/10 text-emerald-200";
  }
  if (isError) {
    return "border-rose-500 bg-rose-500/10 text-rose-200";
  }
  return "border-sky-500 bg-sky-500/10 text-sky-100";
}

export function VerifyEmailPage() {
  const { t } = useTranslation();
  // Read once, without a render-time side effect. StrictMode may render twice.
  const [token] = useState(readFragmentToken);
  const [state, setState] = useState<VerificationState>({ status: "awaiting" });
  const submitted = useRef(false);

  useLayoutEffect(() => {
    // Scrub the fragment before paint; leave unrelated URL anchors intact.
    if (new URLSearchParams(window.location.hash.slice(1)).has("token")) {
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }, []);

  async function confirm() {
    if (!token || submitted.current || state.status !== "awaiting") {
      return;
    }

    submitted.current = true;
    setState({ status: "submitting" });
    try {
      await verifyEmail(token);
      setState({ status: "success" });
    } catch (error: unknown) {
      // A lost response may mean the token has already been consumed.
      // Never retry automatically.
      setState({ status: "error", key: apiErrorKey(error, "verifyEmail") });
    }
  }

  const isSubmitting = state.status === "submitting";
  const isSuccess = state.status === "success";
  const isError = !token || state.status === "error";
  const message = verificationMessageKey(token, state);
  const feedbackClassName = verificationFeedbackClass(isSuccess, isError);

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
      </div>

      <div
        role={isError ? "alert" : "status"}
        className={`mt-8 rounded-3xl border px-6 py-5 text-sm ${feedbackClassName}`}
      >
        {errorMessage(t, message)}
      </div>

      {token && (state.status === "awaiting" || isSubmitting) ? (
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={isSubmitting}
          className="mt-6 w-full rounded-full bg-sky-500 px-6 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t(isSubmitting ? "verify.loading" : "verify.confirm")}
        </button>
      ) : null}

      {(isError || isSuccess) && (
        <Link
          to="/signin"
          className="mt-6 inline-block text-sm font-semibold text-sky-300 underline underline-offset-4"
        >
          {t("verify.signIn")}
        </Link>
      )}
    </motion.div>
  );
}
