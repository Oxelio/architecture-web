import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { activateUser, assignUserRole, suspendUser } from "#services/api";

export function AdminPage() {
  const { t } = useTranslation();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [message, setMessage] = useState<string | null>(null);

  const roleMutation = useMutation({
    mutationFn: () => assignUserRole(userId, role),
    onSuccess: () => setMessage(t("admin.roleSuccess")),
    onError: (error: unknown) =>
      setMessage(
        `${t("admin.error")}: ${error instanceof Error ? error.message : ""}`,
      ),
  });
  const suspendMutation = useMutation({
    mutationFn: () => suspendUser(userId),
    onSuccess: () => setMessage(t("admin.suspendSuccess")),
    onError: (error: unknown) =>
      setMessage(
        `${t("admin.error")}: ${error instanceof Error ? error.message : ""}`,
      ),
  });
  const activateMutation = useMutation({
    mutationFn: () => activateUser(userId),
    onSuccess: () => setMessage(t("admin.activateSuccess")),
    onError: (error: unknown) =>
      setMessage(
        `${t("admin.error")}: ${error instanceof Error ? error.message : ""}`,
      ),
  });
  const isPending =
    roleMutation.isPending ||
    suspendMutation.isPending ||
    activateMutation.isPending;

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-3xl rounded-[2rem] border border-slate-800/90 bg-slate-900/80 p-8 shadow-glow sm:p-10"
    >
      <p className="text-sm uppercase tracking-[0.3em] text-sky-400/80">
        {t("admin.eyebrow")}
      </p>
      <h2 className="mt-3 text-3xl font-semibold text-white">
        {t("admin.title")}
      </h2>
      <p className="mt-3 text-sm leading-7 text-slate-300">
        {t("admin.description")}
      </p>
      <div className="mt-8 space-y-6">
        <label className="block text-sm font-medium text-slate-200">
          {t("admin.userId")}
          <input
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-white outline-none focus:border-sky-400/80"
          />
        </label>
        <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6">
          <label className="block text-sm font-medium text-slate-200">
            {t("admin.role")}
            <select
              value={role}
              onChange={(event) =>
                setRole(event.target.value as "user" | "admin")
              }
              className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-sky-400/80"
            >
              <option value="user">{t("admin.roleUser")}</option>
              <option value="admin">{t("admin.roleAdmin")}</option>
            </select>
          </label>
          <button
            type="button"
            disabled={!userId || isPending}
            onClick={() => roleMutation.mutate()}
            className="mt-4 rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t("admin.assignRole")}
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!userId || isPending}
            onClick={() => suspendMutation.mutate()}
            className="rounded-full bg-rose-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t("admin.suspend")}
          </button>
          <button
            type="button"
            disabled={!userId || isPending}
            onClick={() => activateMutation.mutate()}
            className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t("admin.activate")}
          </button>
        </div>
      </div>
      {message ? (
        <p className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-200">
          {message}
        </p>
      ) : null}
    </motion.section>
  );
}
