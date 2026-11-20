import { useId } from "react";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { fieldErrorMessage } from "#app/lib/error-feedback";
import type { PublicCapabilities } from "#services/api";

interface LoginIdentifierFieldProps {
  allowedKinds: PublicCapabilities["allowedLoginIdentifiers"] | undefined;
  register: <Name extends "loginKind" | "loginValue">(
    name: Name,
  ) => UseFormRegisterReturn<Name>;
  error: FieldError | undefined;
  announceError?: boolean;
}

export function LoginIdentifierField({
  allowedKinds = [],
  register,
  error,
  announceError,
}: Readonly<LoginIdentifierFieldProps>) {
  const { t } = useTranslation();
  const loginValueId = useId();
  const loginKindId = useId();
  const loginErrorId = useId();

  return (
    <div className="text-sm font-medium text-slate-200">
      <label htmlFor={loginValueId} className="block">
        {t("auth.identifier")}
      </label>
      {allowedKinds.length > 1 ? (
        <>
          <label htmlFor={loginKindId} className="sr-only">
            {t("auth.identifierType")}
          </label>
          <select
            id={loginKindId}
            className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-white"
            {...register("loginKind")}
          >
            {allowedKinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind === "email" ? t("common.email") : t("auth.username")}
              </option>
            ))}
          </select>
        </>
      ) : null}
      <input
        id={loginValueId}
        type="text"
        autoComplete="username"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? loginErrorId : undefined}
        className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/80 focus:ring-2 focus:ring-sky-400/20"
        {...register("loginValue")}
      />
      {error && (
        <p
          id={loginErrorId}
          role={announceError ? "alert" : undefined}
          className="mt-2 text-sm text-rose-400"
        >
          {fieldErrorMessage(t, error.message)}
        </p>
      )}
    </div>
  );
}
