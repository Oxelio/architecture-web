import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import type { CurrentUser } from "../services/api";

interface HomePageProps {
  user: CurrentUser | null | undefined;
  loading: boolean;
}

export function HomePage({ user, loading }: HomePageProps) {
  return (
    <div className="space-y-12">
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-[2rem] border border-slate-800/90 bg-slate-900/80 p-8 shadow-glow"
      >
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <span className="inline-flex rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-4 py-1 text-sm font-semibold uppercase tracking-[0.26em] text-white/90 shadow-sm shadow-sky-500/20">
            Identity platform
          </span>
          <div className="space-y-4">
            <h2 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Un portail élégant et fiable pour votre authentification.
            </h2>
            <p className="mx-auto max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              Connecte ton front React à l’API Fastify, avec un design clair,
              réactif et animé.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to={user ? "/profile" : "/signup"}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-sky-500 px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
            >
              {loading
                ? "Chargement..."
                : user
                  ? "Voir mon profil"
                  : "Créer un compte"}
            </Link>
            <Link
              to={user ? "/profile" : "/signin"}
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/80 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-900"
            >
              {user ? "Mon espace" : "Connexion"}
            </Link>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          {
            title: "Sécurité robuste",
            description:
              "Session cookie, gestion d’erreur claire et validation côté serveur.",
          },
          {
            title: "Expérience fluide",
            description:
              "Animations subtiles, chargement optimisé et navigation instantanée.",
          },
          {
            title: "Code maintenable",
            description:
              "TypeScript, React Query et composants petits et réutilisables.",
          },
        ].map((item) => (
          <motion.article
            key={item.title}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-3xl border border-slate-800/90 bg-slate-900/80 p-6 shadow-lg shadow-slate-950/40"
          >
            <h3 className="text-xl font-semibold text-white">{item.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              {item.description}
            </p>
          </motion.article>
        ))}
      </section>

      <section className="rounded-[2rem] border border-slate-800/90 bg-slate-900/80 p-8 shadow-glow">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-sky-400/80">
              Bienvenue
            </p>
            <h3 className="mt-4 text-3xl font-semibold text-white">
              Une interface moderne pour ton identité
            </h3>
            <p className="mt-4 max-w-xl text-base leading-8 text-slate-300">
              Explore comment un front React bien structuré peut exploiter ton
              API d’authentification, tout en gardant une UI élégante et
              accessible.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-800/90 bg-slate-950/70 p-6">
            <div className="space-y-4 text-slate-200">
              <div>
                <p className="text-sm uppercase text-slate-500">Statut</p>
                <p className="mt-2 text-lg font-semibold">
                  {loading
                    ? "Vérification en cours"
                    : user
                      ? `Connecté en tant que ${user.email}`
                      : "Non connecté"}
                </p>
              </div>
              <div>
                <p className="text-sm uppercase text-slate-500">Clé API</p>
                <p className="mt-2 text-sm text-slate-400">
                  Utilise l’API `GET /identity/me` pour récupérer le profil
                  utilisateur.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
