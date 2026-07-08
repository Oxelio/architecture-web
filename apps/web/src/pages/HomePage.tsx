import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { CurrentUser } from "../services/api";

interface HomePageProps {
  user: CurrentUser | null | undefined;
  loading: boolean;
}

export function HomePage({ user, loading }: Readonly<HomePageProps>) {
  const { t } = useTranslation();

  let primaryActionLabel: string;
  if (loading) {
    primaryActionLabel = t("common.loading");
  } else if (user) {
    primaryActionLabel = t("home.primaryAction");
  } else {
    primaryActionLabel = t("home.primaryActionGuest");
  }

  let statusText: string;
  if (loading) {
    statusText = t("home.statusChecking");
  } else if (user) {
    statusText = t("home.statusConnected", { email: user.email });
  } else {
    statusText = t("home.statusDisconnected");
  }

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
            {t("home.eyebrow")}
          </span>
          <div className="space-y-4">
            <h2 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {t("home.heroTitle")}
            </h2>
            <p className="mx-auto max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              {t("home.heroSubtitle")}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to={user ? "/profile" : "/signup"}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-sky-500 px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
            >
              {primaryActionLabel}
            </Link>
            <Link
              to={user ? "/profile" : "/signin"}
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/80 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-900"
            >
              {user
                ? t("home.secondaryAction")
                : t("home.secondaryActionGuest")}
            </Link>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          {
            title: t("home.featureTitle"),
            description: t("home.featureDescription"),
          },
          {
            title: t("home.featureTitleTwo"),
            description: t("home.featureDescriptionTwo"),
          },
          {
            title: t("home.featureTitleThree"),
            description: t("home.featureDescriptionThree"),
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
              {t("home.sectionEyebrow")}
            </p>
            <h3 className="mt-4 text-3xl font-semibold text-white">
              {t("home.sectionTitle")}
            </h3>
            <p className="mt-4 max-w-xl text-base leading-8 text-slate-300">
              {t("home.sectionDescription")}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-800/90 bg-slate-950/70 p-6">
            <div className="space-y-4 text-slate-200">
              <div>
                <p className="text-sm uppercase text-slate-500">
                  {t("home.statusLabel")}
                </p>
                <p className="mt-2 text-lg font-semibold">{statusText}</p>
              </div>
              <div>
                <p className="text-sm uppercase text-slate-500">
                  {t("home.apiLabel")}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {t("home.apiHelp")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
