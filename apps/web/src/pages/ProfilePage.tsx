import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import type { CurrentUser } from "../services/api";
import { changeEmail, changePassword, signOut } from "../services/api";

interface ProfilePageProps {
  user: CurrentUser;
}

export function ProfilePage({ user }: ProfilePageProps) {
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const emailMutation = useMutation({
    mutationFn: changeEmail,
    onSuccess: () => {
      setServerMessage("Adresse e-mail mise à jour avec succès.");
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
    onError: (error: unknown) => {
      setServerMessage(
        error instanceof Error
          ? `Impossible de mettre à jour l'adresse e-mail : ${error.message}`
          : "Impossible de mettre à jour l'adresse e-mail.",
      );
    },
  });

  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setServerMessage("Mot de passe modifié avec succès.");
      setPassword("");
    },
    onError: (error: unknown) => {
      setServerMessage(
        error instanceof Error
          ? `Impossible de modifier le mot de passe : ${error.message}`
          : "Impossible de modifier le mot de passe.",
      );
    },
  });

  const signOutMutation = useMutation({
    mutationFn: async () => signOut(),
    onSuccess: () => {
      queryClient.setQueryData(["currentUser"], null);
    },
    onError: () => {
      setServerMessage("Impossible de se déconnecter. Réessaie.");
    },
  });

  const handleSignOut = async () => {
    try {
      await signOutMutation.mutateAsync();
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      window.location.assign("/signin");
    } catch {
      setServerMessage("Impossible de se déconnecter. Réessaie.");
    }
  };

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
              Profil utilisateur
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-white">
              Bienvenue, {user.email}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Voici ton compte. Tu peux mettre à jour ton adresse email, changer
              ton mot de passe ou te déconnecter.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
              Identifiant
            </p>
            <p className="mt-3 text-xl font-semibold text-white break-words">
              {user.userId}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
              Email
            </p>
            <p className="mt-3 text-xl font-semibold text-white break-words">
              {user.email}
            </p>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center justify-center rounded-full bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={signOutMutation.isPending}
          >
            {signOutMutation.isPending ? "Déconnexion..." : "Se déconnecter"}
          </button>
        </div>

        <div className="space-y-8">
          <section className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
                  Mettre à jour l'email
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Change ton adresse e-mail de connexion.
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-slate-200">
                Nouvelle adresse email
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
                  ? "Enregistrement..."
                  : "Mettre à jour l'email"}
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
                  Modifier le mot de passe
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Choisis un mot de passe plus sécurisé.
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-slate-200">
                Nouveau mot de passe
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
                  ? "Mise à jour..."
                  : "Changer le mot de passe"}
              </button>
              {password.length > 0 && password.length < 8 ? (
                <p className="text-sm text-amber-300">
                  Le mot de passe doit comporter au moins 8 caractères.
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
