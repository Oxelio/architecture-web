import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { z } from "zod";
import { signIn } from "../services/api";

const signInSchema = z.object({
  email: z.string().email({ message: "Email invalide" }),
  password: z
    .string()
    .min(8, { message: "Le mot de passe doit contenir au moins 8 caractères" }),
});

type SignInFormValues = z.infer<typeof signInSchema>;

export function SignInPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = async (values: SignInFormValues) => {
    setServerError(null);
    setIsSubmitting(true);

    try {
      await signIn(values);
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      navigate("/profile", { replace: true });
    } catch (error) {
      if (error instanceof Error) {
        setServerError(error.message ?? "Erreur inconnue");
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
          Connexion
        </p>
        <h2 className="text-3xl font-semibold text-white">
          Accède à ton espace
        </h2>
        <p className="text-sm leading-7 text-slate-400">
          Utilise ton email et ton mot de passe pour te connecter au système.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-200">
            Email
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
            Mot de passe
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
          {isSubmitting ? "Connexion..." : "Se connecter"}
        </button>
      </form>

      <div className="mt-8 text-center text-sm text-slate-400">
        Pas encore de compte ?{" "}
        <Link
          to="/signup"
          className="font-semibold text-white hover:text-sky-300"
        >
          Crée-en un
        </Link>
      </div>
    </motion.div>
  );
}
