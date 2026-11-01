// @file apps/web/src/App.tsx

import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { useCurrentUser } from "./hooks/useCurrentUser";
import { cn } from "./lib/cn";
import { getUnreadNotificationCount } from "./services/api";

const HomePage = lazy(() =>
  import("./pages/HomePage").then((mod) => ({ default: mod.HomePage })),
);
const SignInPage = lazy(() =>
  import("./pages/SignInPage").then((mod) => ({ default: mod.SignInPage })),
);
const SignUpPage = lazy(() =>
  import("./pages/SignUpPage").then((mod) => ({ default: mod.SignUpPage })),
);
const VerifyEmailPage = lazy(() =>
  import("./pages/VerifyEmailPage").then((mod) => ({
    default: mod.VerifyEmailPage,
  })),
);
const RecoveryPage = lazy(() =>
  import("./pages/RecoveryPage").then((mod) => ({
    default: mod.RecoveryPage,
  })),
);
const CancelDeletionPage = lazy(() =>
  import("./pages/CancelDeletionPage").then((mod) => ({
    default: mod.CancelDeletionPage,
  })),
);
const ProfilePage = lazy(() =>
  import("./pages/ProfilePage").then((mod) => ({ default: mod.ProfilePage })),
);
const AdminPage = lazy(() =>
  import("./pages/AdminPage").then((mod) => ({ default: mod.AdminPage })),
);
const NotificationsPage = lazy(() =>
  import("./pages/NotificationsPage").then((mod) => ({
    default: mod.NotificationsPage,
  })),
);

function App() {
  const location = useLocation();
  const { data: user, isLoading } = useCurrentUser();
  const { t } = useTranslation();
  const unread = useQuery({
    queryKey: ["notification-unread"],
    queryFn: getUnreadNotificationCount,
    enabled: Boolean(user),
    refetchInterval: 15_000,
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {renderHeader()}

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Suspense
          fallback={
            <div className="rounded-3xl border border-slate-800/90 bg-slate-900/80 p-10 text-center text-slate-300">
              {t("common.loading")}
            </div>
          }
        >
          <Routes location={location}>
            <Route
              path="/"
              element={<HomePage user={user} loading={isLoading} />}
            />
            <Route
              path="/admin"
              element={
                user?.role === "admin" ? (
                  <AdminPage currentUserId={user.userId} />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/signin"
              element={
                user ? <Navigate to="/profile" replace /> : <SignInPage />
              }
            />
            <Route
              path="/signup"
              element={
                user ? <Navigate to="/profile" replace /> : <SignUpPage />
              }
            />
            <Route path="/verify" element={<VerifyEmailPage />} />
            <Route path="/recovery" element={<RecoveryPage />} />
            <Route path="/cancel-deletion" element={<CancelDeletionPage />} />
            <Route
              path="/profile"
              element={
                user ? (
                  <ProfilePage user={user} />
                ) : (
                  <Navigate to="/signin" replace />
                )
              }
            />
            <Route
              path="/notifications"
              element={
                user ? <NotificationsPage /> : <Navigate to="/signin" replace />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
  function renderHeader() {
    return (
      <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 via-indigo-500 to-sky-500 shadow-lg shadow-violet-500/20">
              <span className="text-xl font-semibold text-white">A</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                Architecture
              </p>
              <h1 className="text-lg font-semibold text-white">IAM Studio</h1>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher />
            <Link
              to="/"
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition hover:bg-slate-800/80",
                location.pathname === "/"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400",
              )}
            >
              {t("nav.home")}
            </Link>
            {user ? (
              <>
                <Link
                  to="/profile"
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition hover:bg-slate-800/80",
                    location.pathname === "/profile"
                      ? "bg-slate-800 text-white"
                      : "text-slate-400",
                  )}
                >
                  {t("nav.profile")}
                </Link>
                <Link
                  to="/notifications"
                  className={cn(
                    "relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition hover:bg-slate-800/80",
                    location.pathname === "/notifications"
                      ? "bg-slate-800 text-white"
                      : "text-slate-400",
                  )}
                >
                  <Bell className="h-4 w-4" />
                  {t("nav.notifications")}
                  {(unread.data?.count ?? 0) > 0 ? (
                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">
                      {unread.data?.count}
                    </span>
                  ) : null}
                </Link>
                {user.role === "admin" ? (
                  <Link
                    to="/admin"
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-medium transition hover:bg-slate-800/80",
                      location.pathname === "/admin"
                        ? "bg-slate-800 text-white"
                        : "text-slate-400",
                    )}
                  >
                    {t("nav.admin")}
                  </Link>
                ) : null}
              </>
            ) : (
              <>
                <Link
                  to="/signin"
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition hover:bg-slate-800/80",
                    location.pathname === "/signin"
                      ? "bg-slate-800 text-white"
                      : "text-slate-400",
                  )}
                >
                  {t("nav.signIn")}
                </Link>
                <Link
                  to="/signup"
                  className={cn(
                    "rounded-full border border-slate-700 bg-slate-950/80 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-900",
                    location.pathname === "/signup"
                      ? "bg-slate-800 text-white"
                      : "text-slate-200",
                  )}
                >
                  {t("nav.signUp")}
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
    );
  }
}

export default App;
